const Conversation = require('../models/conversation');
const Listing = require('../models/listing');
const Booking = require('../models/booking');
const User = require('../models/user');
const mongoose = require('mongoose');
const { createNotification } = require('../utils/notificationHelper');

/**
 * List all conversations and render active chat window
 */
module.exports.index = async (req, res) => {
  const currentUserId = req.user._id;
  const activeId = req.query.activeId || req.params.id;

  // Find all conversations where current user is a participant
  const conversations = await Conversation.find({
    participants: currentUserId
  })
    .sort({ updatedAt: -1 })
    .populate('participants', 'username firstName lastName avatar role')
    .populate('listing', 'title location country image price')
    .populate('booking', 'checkIn checkOut nights totalPrice status paymentStatus');

  let activeConversation = null;

  if (activeId && mongoose.Types.ObjectId.isValid(activeId)) {
    activeConversation = await Conversation.findById(activeId)
      .populate('participants', 'username firstName lastName avatar role phone email')
      .populate('listing', 'title location country image price owner')
      .populate('booking', 'checkIn checkOut nights totalPrice status paymentStatus')
      .populate('messages.sender', 'username firstName lastName avatar');

    // Strict Authorization check
    if (activeConversation) {
      const isParticipant = activeConversation.participants.some((p) =>
        p._id.equals(currentUserId)
      );

      if (!isParticipant) {
        req.flash('error', 'You do not have permission to view this conversation.');
        return res.redirect('/messages');
      }

      // Mark unread messages sent by others as read
      let hasUpdates = false;
      activeConversation.messages.forEach((msg) => {
        if (!msg.sender._id.equals(currentUserId)) {
          const alreadyRead = msg.readBy && msg.readBy.some((id) => id.equals(currentUserId));
          if (!alreadyRead) {
            msg.readBy.push(currentUserId);
            hasUpdates = true;
          }
        }
      });

      if (hasUpdates) {
        await activeConversation.save();
      }
    }
  } else if (conversations.length > 0) {
    // Default to first conversation on larger screens if no activeId specified
    const firstId = conversations[0]._id;
    activeConversation = await Conversation.findById(firstId)
      .populate('participants', 'username firstName lastName avatar role phone email')
      .populate('listing', 'title location country image price owner')
      .populate('booking', 'checkIn checkOut nights totalPrice status paymentStatus')
      .populate('messages.sender', 'username firstName lastName avatar');

    if (activeConversation) {
      let hasUpdates = false;
      activeConversation.messages.forEach((msg) => {
        if (!msg.sender._id.equals(currentUserId)) {
          const alreadyRead = msg.readBy && msg.readBy.some((id) => id.equals(currentUserId));
          if (!alreadyRead) {
            msg.readBy.push(currentUserId);
            hasUpdates = true;
          }
        }
      });
      if (hasUpdates) await activeConversation.save();
    }
  }

  // Pre-calculate other user and unread counts for sidebar
  const formattedConversations = conversations.map((conv) => {
    const otherParticipant = conv.participants.find((p) => !p._id.equals(currentUserId)) || conv.participants[0];
    const unreadCount = conv.messages.filter(
      (m) => !m.sender.equals(currentUserId) && (!m.readBy || !m.readBy.some((id) => id.equals(currentUserId)))
    ).length;

    return {
      _id: conv._id,
      otherParticipant,
      listing: conv.listing,
      booking: conv.booking,
      lastMessage: conv.lastMessage,
      updatedAt: conv.updatedAt,
      unreadCount
    };
  });

  const totalUnread = formattedConversations.reduce((sum, c) => sum + c.unreadCount, 0);

  res.render('messages/index.ejs', {
    conversations: formattedConversations,
    activeConversation,
    totalUnread,
    currentUserId
  });
};

/**
 * Send a reply in an existing conversation
 */
module.exports.sendMessage = async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const currentUserId = req.user._id;

  if (!content || !content.trim()) {
    req.flash('error', 'Message content cannot be blank.');
    return res.redirect(`/messages?activeId=${id}`);
  }

  const conversation = await Conversation.findById(id);
  if (!conversation) {
    req.flash('error', 'Conversation not found.');
    return res.redirect('/messages');
  }

  // Authorization check
  const isParticipant = conversation.participants.some((p) => p.equals(currentUserId));
  if (!isParticipant) {
    req.flash('error', 'Unauthorized to send message in this conversation.');
    return res.redirect('/messages');
  }

  const newMessage = {
    sender: currentUserId,
    content: content.trim(),
    readBy: [currentUserId],
    createdAt: new Date()
  };

  conversation.messages.push(newMessage);
  conversation.lastMessage = {
    content: content.trim(),
    sender: currentUserId,
    createdAt: new Date()
  };
  conversation.updatedAt = new Date();

  await conversation.save();

  // Dispatch in-app notification to the recipient(s)
  const senderName = req.user.firstName || req.user.username || 'A traveler';
  const preview = content.trim().length > 60 ? content.trim().slice(0, 57) + '...' : content.trim();
  conversation.participants.forEach(participantId => {
    if (!participantId.equals(currentUserId)) {
      createNotification({
        userId: participantId,
        type: 'new_message',
        title: `New message from ${senderName}`,
        message: `"${preview}"`,
        link: `/messages?activeId=${conversation._id}`
      });
    }
  });

  if (req.xhr || req.headers.accept?.includes('json')) {
    return res.json({ success: true, message: newMessage });
  }

  res.redirect(`/messages?activeId=${id}`);
};

/**
 * Start a conversation or route to an existing conversation for a listing/host
 */
module.exports.startConversation = async (req, res) => {
  const { listingId, bookingId, recipientId, initialMessage } = req.body;
  const currentUserId = req.user._id;

  if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
    req.flash('error', 'Invalid listing ID provided.');
    return res.redirect('/listings');
  }

  const listing = await Listing.findById(listingId);
  if (!listing) {
    req.flash('error', 'Listing not found.');
    return res.redirect('/listings');
  }

  // Determine recipient (usually listing owner)
  let targetRecipientId = recipientId;
  if (!targetRecipientId) {
    targetRecipientId = listing.owner;
  }

  if (!targetRecipientId) {
    req.flash('error', 'Recipient not found for this property.');
    return res.redirect(`/listings/${listingId}`);
  }

  // Prohibit messaging oneself
  if (currentUserId.equals(targetRecipientId)) {
    req.flash('error', 'You cannot message yourself.');
    return res.redirect(`/listings/${listingId}`);
  }

  // Check if a conversation between these users for this listing already exists
  let conversation = await Conversation.findOne({
    participants: { $all: [currentUserId, targetRecipientId] },
    listing: listingId
  });

  if (!conversation) {
    conversation = new Conversation({
      participants: [currentUserId, targetRecipientId],
      listing: listingId,
      booking: (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) ? bookingId : null,
      messages: [],
      updatedAt: new Date()
    });
  } else if (bookingId && !conversation.booking) {
    conversation.booking = bookingId;
  }

  if (initialMessage && initialMessage.trim()) {
    const msg = {
      sender: currentUserId,
      content: initialMessage.trim(),
      readBy: [currentUserId],
      createdAt: new Date()
    };
    conversation.messages.push(msg);
    conversation.lastMessage = {
      content: initialMessage.trim(),
      sender: currentUserId,
      createdAt: new Date()
    };
    conversation.updatedAt = new Date();

    // Dispatch in-app notification to the target host/recipient
    const senderName = req.user.firstName || req.user.username || 'A traveler';
    const preview = initialMessage.trim().length > 60 ? initialMessage.trim().slice(0, 57) + '...' : initialMessage.trim();
    createNotification({
      userId: targetRecipientId,
      type: 'new_message',
      title: `New inquiry from ${senderName}`,
      message: `"${preview}"`,
      link: `/messages?activeId=${conversation._id}`
    });
  }

  await conversation.save();
  res.redirect(`/messages?activeId=${conversation._id}`);
};

/**
 * Handle direct "Contact Host" GET request from listing or booking
 */
module.exports.initiateContact = async (req, res) => {
  const { listingId, bookingId } = req.query;
  const currentUserId = req.user._id;

  if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
    req.flash('error', 'Invalid listing specified.');
    return res.redirect('/listings');
  }

  const listing = await Listing.findById(listingId);
  if (!listing) {
    req.flash('error', 'Listing not found.');
    return res.redirect('/listings');
  }

  if (listing.owner && listing.owner.equals(currentUserId)) {
    req.flash('error', 'You cannot message yourself as the host of this property.');
    return res.redirect(`/listings/${listingId}`);
  }

  // Check if conversation already exists
  let conversation = await Conversation.findOne({
    participants: { $all: [currentUserId, listing.owner] },
    listing: listingId
  });

  if (!conversation) {
    conversation = new Conversation({
      participants: [currentUserId, listing.owner],
      listing: listingId,
      booking: (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) ? bookingId : null,
      messages: [
        {
          sender: currentUserId,
          content: 'Hi! I am interested in this stay and have a few questions.',
          readBy: [currentUserId],
          createdAt: new Date()
        }
      ],
      lastMessage: {
        content: 'Hi! I am interested in this stay and have a few questions.',
        sender: currentUserId,
        createdAt: new Date()
      },
      updatedAt: new Date()
    });
    await conversation.save();
  } else if (bookingId && !conversation.booking) {
    conversation.booking = bookingId;
    await conversation.save();
  }

  res.redirect(`/messages?activeId=${conversation._id}`);
};
