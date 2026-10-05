const nodemailer = require('nodemailer');

/**
 * Creates and returns the active Nodemailer transporter.
 * Supports production SMTP via environment variables and graceful development mock fallback.
 */
function createTransporter() {
  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const service = process.env.EMAIL_SERVICE;

  // If live credentials are provided via environment variables:
  if (user && pass) {
    const config = service
      ? { service, auth: { user, pass } }
      : {
          host: host || 'smtp.gmail.com',
          port: port,
          secure: port === 465,
          auth: { user, pass }
        };
    return nodemailer.createTransport(config);
  }

  // Safe development/test fallback: Mock transporter that simulates sending & logs safely
  return {
    isMock: true,
    sendMail: async (mailOptions) => {
      if (!mailOptions || !mailOptions.to) {
        throw new Error('No recipients defined');
      }
      console.log(`\n📨 [EmailService: DEV MOCK] -----------------------------------------`);
      console.log(`   To:      ${mailOptions.to}`);
      console.log(`   From:    ${mailOptions.from || process.env.EMAIL_FROM || 'notifications@wanderstay.com'}`);
      console.log(`   Subject: ${mailOptions.subject}`);
      console.log(`   Preview: ${mailOptions.text ? mailOptions.text.slice(0, 140) + '...' : '(HTML Email Body)'}`);
      console.log(`--------------------------------------------------------------------\n`);
      return {
        messageId: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        response: '250 Message accepted (Mock Transporter)'
      };
    }
  };
}

const defaultFrom = process.env.EMAIL_FROM || '"WanderStay" <notifications@wanderstay.com>';
const appUrl = process.env.APP_URL || 'http://localhost:8080';

/**
 * Master HTML Email Template Wrapper
 * Injects responsive WanderStay luxury styling, SVG emblem, and brand header/footer.
 */
function buildHtmlEmail({ title, preheader, bodyHtml, ctaText, ctaUrl, accentColor = '#FF385C' }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1E293B; }
    .email-container { max-width: 600px; margin: 30px auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06); border: 1px solid #E2E8F0; }
    .email-header { background: linear-gradient(135deg, #FF5A5F 0%, #FF385C 55%, #FF7A45 100%); padding: 32px 30px; text-align: center; }
    .brand-title { color: #FFFFFF; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
    .brand-tagline { color: rgba(255, 255, 255, 0.9); font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 6px; font-weight: 600; }
    .email-body { padding: 36px 32px; }
    .headline { font-size: 22px; font-weight: 700; color: #0F172A; margin: 0 0 16px 0; line-height: 1.3; }
    .text-content { font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 20px 0; }
    .info-card { background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #EDF2F7; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748B; font-weight: 500; }
    .info-val { color: #0F172A; font-weight: 600; text-align: right; }
    .cta-container { text-align: center; margin: 32px 0 16px 0; }
    .cta-btn { display: inline-block; background-color: ${accentColor}; color: #FFFFFF !important; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 34px; border-radius: 50px; box-shadow: 0 4px 14px rgba(255, 56, 92, 0.3); }
    .email-footer { background-color: #F1F5F9; padding: 24px 30px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; }
    .footer-links a { color: #64748B; text-decoration: underline; margin: 0 8px; }
    .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
  </style>
</head>
<body>
  ${preheader ? `<span class="preheader">${preheader}</span>` : ''}
  <div class="email-container">
    <!-- Header with WanderStay Emblem -->
    <div class="email-header">
      <div style="display: inline-block; width: 42px; height: 42px; background: #FFFFFF; border-radius: 12px; padding: 8px; margin-bottom: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
        <svg viewBox="0 0 48 48" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 5C15.7 5 9 11.7 9 20C9 29.2 21.4 41.6 23.1 43.1C23.6 43.6 24.4 43.6 24.9 43.1C26.6 41.6 39 29.2 39 20C39 11.7 32.3 5 24 5Z" fill="#FF385C" />
          <path d="M24 13L15.5 25H20.2L24 19.2L27.8 25H32.5L24 13Z" fill="#FFFFFF" />
          <path d="M24 21.5L18.8 29.2H29.2L24 21.5Z" fill="#111622" />
        </svg>
      </div>
      <h1 class="brand-title">WanderStay</h1>
      <div class="brand-tagline">Wander Far • Stay Extraordinary</div>
    </div>

    <!-- Main Content -->
    <div class="email-body">
      ${bodyHtml}

      ${ctaText && ctaUrl ? `
        <div class="cta-container">
          <a href="${ctaUrl}" class="cta-btn" target="_blank">${ctaText}</a>
        </div>
      ` : ''}
    </div>

    <!-- Brand Footer -->
    <div class="email-footer">
      <p style="margin: 0 0 10px 0; font-weight: 600; color: #334155;">Need assistance with your reservation?</p>
      <p style="margin: 0 0 14px 0;">Our 24/7 guest concierge is here to help at <a href="mailto:support@wanderstay.com" style="color: #FF385C; text-decoration: none; font-weight: 600;">support@wanderstay.com</a></p>
      <div class="footer-links">
        <a href="${appUrl}/listings">Explore Stays</a>
        <a href="${appUrl}/bookings/history">My Bookings</a>
        <a href="${appUrl}/help">Help Center</a>
      </div>
      <p style="margin: 16px 0 0 0; font-size: 11px; color: #94A3B8;">&copy; ${new Date().getFullYear()} WanderStay, Inc. All rights reserved. Handpicked luxury accommodations worldwide.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Universal safe send wrapper.
 * Logs on the server and catches all failures so booking flow never crashes.
 */
async function sendSafeMail(mailOptions) {
  try {
    const transporter = createTransporter();
    const finalOptions = {
      from: mailOptions.from || defaultFrom,
      ...mailOptions
    };
    const result = await transporter.sendMail(finalOptions);
    console.log(`✅ [EmailService] Email sent successfully to ${mailOptions.to} (Subject: "${mailOptions.subject}")`);
    return { success: true, messageId: result.messageId };
  } catch (err) {
    console.error(`❌ [EmailService] Error sending email to ${mailOptions.to}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// 1. SIGNUP / WELCOME EMAIL
// ============================================================================
async function sendWelcomeEmail(user) {
  if (!user || !user.email) return;

  const displayName = user.fullName || user.username || 'Traveler';
  const isHost = user.role === 'host';

  const bodyHtml = `
    <h2 class="headline">Welcome to WanderStay, ${displayName}! ✈️</h2>
    <p class="text-content">
      We are thrilled to welcome you to the WanderStay community. Whether you are looking for private beachfront villas, secluded alpine chalets, or modern urban lofts, extraordinary travel begins right here.
    </p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">Account Username:</span>
        <span class="info-val">@${user.username}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Account Role:</span>
        <span class="info-val" style="text-transform: capitalize;">${user.role || 'Traveler'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Member Since:</span>
        <span class="info-val">${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
      </div>
    </div>

    ${isHost ? `
      <p class="text-content">
        As an authorized WanderStay Host, you can now publish your properties, manage reservation calendars, and welcome verified travelers from around the world.
      </p>
    ` : `
      <p class="text-content">
        Ready to embark on your next adventure? Browse handpicked luxury stays, save favorites to your wishlist, or use our intelligent AI itinerary planner to craft your perfect getaway.
      </p>
    `}
  `;

  return sendSafeMail({
    to: user.email,
    subject: `Welcome to WanderStay, ${displayName}!`,
    html: buildHtmlEmail({
      title: 'Welcome to WanderStay',
      preheader: 'Your extraordinary journey starts here. Welcome to WanderStay!',
      bodyHtml,
      ctaText: isHost ? 'Go to Host Dashboard' : 'Explore Extraordinary Stays',
      ctaUrl: isHost ? `${appUrl}/dashboard/host` : `${appUrl}/listings`
    })
  });
}

// ============================================================================
// 2. BOOKING CONFIRMATION EMAIL (TO GUEST)
// ============================================================================
async function sendBookingConfirmationEmail({ booking, listing, guest, host }) {
  if (!guest || !guest.email || !booking || !listing) return;

  const guestName = guest.fullName || guest.username || 'Traveler';
  const hostName = host ? (host.fullName || host.username) : 'WanderStay Verified Host';
  const bookingRef = `#${booking._id.toString().slice(-8).toUpperCase()}`;

  const checkInStr = new Date(booking.checkIn).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const checkOutStr = new Date(booking.checkOut).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const bodyHtml = `
    <h2 class="headline">Your reservation is confirmed! 🎉</h2>
    <p class="text-content">
      Hello ${guestName}, your stay at <strong>${listing.title}</strong> has been confirmed. Get ready for an unforgettable experience!
    </p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">Booking Reference:</span>
        <span class="info-val" style="font-family: monospace; color: #FF385C;">${bookingRef}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Property:</span>
        <span class="info-val">${listing.title}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Location:</span>
        <span class="info-val">${listing.location}, ${listing.country}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Check-in:</span>
        <span class="info-val">${checkInStr} (From 3:00 PM)</span>
      </div>
      <div class="info-row">
        <span class="info-label">Check-out:</span>
        <span class="info-val">${checkOutStr} (By 11:00 AM)</span>
      </div>
      <div class="info-row">
        <span class="info-label">Duration &amp; Guests:</span>
        <span class="info-val">${booking.nights} nights • ${booking.guests || 1} travelers</span>
      </div>
      <div class="info-row">
        <span class="info-label">Host:</span>
        <span class="info-val">${hostName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Total Amount:</span>
        <span class="info-val" style="color: #059669; font-size: 16px;">₹${Number(booking.totalPrice).toLocaleString('en-IN')}</span>
      </div>
    </div>

    <p class="text-content">
      You can coordinate self check-in directions and house access with your host directly via our secure messaging portal.
    </p>
  `;

  return sendSafeMail({
    to: guest.email,
    subject: `Reservation Confirmed: ${listing.title} (${bookingRef})`,
    html: buildHtmlEmail({
      title: 'Booking Confirmed - WanderStay',
      preheader: `Your reservation at ${listing.title} is confirmed. Booking ID: ${bookingRef}`,
      bodyHtml,
      ctaText: 'View Reservation Details & Invoice',
      ctaUrl: `${appUrl}/bookings/${booking._id}`
    })
  });
}

// ============================================================================
// 3. PAYMENT CONFIRMATION EMAIL (TO GUEST)
// ============================================================================
async function sendPaymentConfirmationEmail({ booking, listing, guest }) {
  if (!guest || !guest.email || !booking) return;

  const guestName = guest.fullName || guest.username || 'Traveler';
  const bookingRef = `#${booking._id.toString().slice(-8).toUpperCase()}`;
  const paymentId = booking.razorpayPaymentId || 'Verified Online';

  const bodyHtml = `
    <h2 class="headline">Payment Received &amp; Verified 💳</h2>
    <p class="text-content">
      Hi ${guestName}, your payment for reservation <strong>${bookingRef}</strong> has been successfully processed and verified.
    </p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">Amount Paid:</span>
        <span class="info-val" style="color: #059669; font-size: 17px;">₹${Number(booking.totalPrice).toLocaleString('en-IN')}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Payment Status:</span>
        <span class="info-val" style="color: #059669;">✓ Verified &amp; Paid (INR)</span>
      </div>
      <div class="info-row">
        <span class="info-label">Payment ID:</span>
        <span class="info-val" style="font-family: monospace;">${paymentId}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Gateway:</span>
        <span class="info-val">Razorpay Secure Checkout</span>
      </div>
      <div class="info-row">
        <span class="info-label">Property:</span>
        <span class="info-val">${listing ? listing.title : 'WanderStay Accommodation'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Transaction Date:</span>
        <span class="info-val">${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>

    <p class="text-content">
      Your official tax invoice has been generated and is available for instant download in PDF format.
    </p>
  `;

  return sendSafeMail({
    to: guest.email,
    subject: `Payment Receipt: ₹${Number(booking.totalPrice).toLocaleString('en-IN')} for ${bookingRef}`,
    html: buildHtmlEmail({
      title: 'Payment Confirmation - WanderStay',
      preheader: `Payment received for booking ${bookingRef}. Total: ₹${Number(booking.totalPrice).toLocaleString('en-IN')}`,
      bodyHtml,
      ctaText: 'Download Official PDF Invoice',
      ctaUrl: `${appUrl}/bookings/${booking._id}/invoice`
    })
  });
}

// ============================================================================
// 4. HOST RECEIVES BOOKING NOTIFICATION (TO HOST)
// ============================================================================
async function sendHostBookingNotificationEmail({ booking, listing, host, guest }) {
  if (!host || !host.email || !booking || !listing) return;

  const hostName = host.fullName || host.username || 'Host';
  const guestName = guest ? (guest.fullName || guest.username) : 'A traveler';
  const bookingRef = `#${booking._id.toString().slice(-8).toUpperCase()}`;

  const checkInStr = new Date(booking.checkIn).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const checkOutStr = new Date(booking.checkOut).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const bodyHtml = `
    <h2 class="headline">New Booking Received! 🏠</h2>
    <p class="text-content">
      Great news, ${hostName}! <strong>${guestName}</strong> just confirmed a stay at your property <strong>${listing.title}</strong>.
    </p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">Guest Name:</span>
        <span class="info-val">${guestName} (${booking.guests || 1} travelers)</span>
      </div>
      <div class="info-row">
        <span class="info-label">Property:</span>
        <span class="info-val">${listing.title}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Check-in:</span>
        <span class="info-val">${checkInStr}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Check-out:</span>
        <span class="info-val">${checkOutStr}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Nights:</span>
        <span class="info-val">${booking.nights} nights</span>
      </div>
      <div class="info-row">
        <span class="info-label">Payout Total:</span>
        <span class="info-val" style="color: #059669; font-size: 16px;">₹${Number(booking.totalPrice).toLocaleString('en-IN')}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Booking ID:</span>
        <span class="info-val" style="font-family: monospace;">${bookingRef}</span>
      </div>
    </div>

    <p class="text-content">
      The calendar dates have been automatically blocked for this stay. Feel free to send a warm welcome message to your guest before their arrival.
    </p>
  `;

  return sendSafeMail({
    to: host.email,
    subject: `New Reservation: ${guestName} booked ${listing.title} (${bookingRef})`,
    html: buildHtmlEmail({
      title: 'New Reservation - WanderStay',
      preheader: `New booking at ${listing.title} from ${checkInStr} to ${checkOutStr}`,
      bodyHtml,
      ctaText: 'Open Host Management Panel',
      ctaUrl: `${appUrl}/dashboard/host`
    })
  });
}

// ============================================================================
// 5. BOOKING CANCELLATION EMAIL (TO GUEST AND/OR HOST)
// ============================================================================
async function sendBookingCancellationEmail({ booking, listing, recipientUser, isHost = false, refundAmount = 0 }) {
  if (!recipientUser || !recipientUser.email || !booking || !listing) return;

  const recipientName = recipientUser.fullName || recipientUser.username || 'User';
  const bookingRef = `#${booking._id.toString().slice(-8).toUpperCase()}`;

  const bodyHtml = `
    <h2 class="headline" style="color: #DC2626;">Reservation Cancelled 🛑</h2>
    <p class="text-content">
      Hello ${recipientName}, reservation <strong>${bookingRef}</strong> for <strong>${listing.title}</strong> has been cancelled.
    </p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">Booking ID:</span>
        <span class="info-val" style="font-family: monospace;">${bookingRef}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Property:</span>
        <span class="info-val">${listing.title}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Dates:</span>
        <span class="info-val">${new Date(booking.checkIn).toLocaleDateString()} — ${new Date(booking.checkOut).toLocaleDateString()}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Booking Status:</span>
        <span class="info-val" style="color: #DC2626;">Cancelled</span>
      </div>
      ${!isHost && refundAmount > 0 ? `
        <div class="info-row">
          <span class="info-label">Refund Initiated:</span>
          <span class="info-val" style="color: #059669; font-weight: 700;">₹${Number(refundAmount).toLocaleString('en-IN')} (Full Refund)</span>
        </div>
      ` : ''}
    </div>

    ${isHost ? `
      <p class="text-content">
        The calendar dates have been unblocked and are once again available for other travelers to book.
      </p>
    ` : `
      <p class="text-content">
        If eligible, your refund has been processed back to your original payment method. Depending on your financial provider, the funds should reflect within 3-5 business days.
      </p>
    `}
  `;

  return sendSafeMail({
    to: recipientUser.email,
    subject: `Reservation Cancelled: ${listing.title} (${bookingRef})`,
    html: buildHtmlEmail({
      title: 'Booking Cancelled - WanderStay',
      preheader: `Booking ${bookingRef} has been cancelled.`,
      bodyHtml,
      ctaText: isHost ? 'View Host Calendar' : 'Explore Other Stays',
      ctaUrl: isHost ? `${appUrl}/dashboard/host` : `${appUrl}/listings`,
      accentColor: '#DC2626'
    })
  });
}

// ============================================================================
// 6. PASSWORD RESET EMAIL & PASSWORD CHANGED ALERT
// ============================================================================
async function sendPasswordResetEmail({ user, resetUrl }) {
  if (!user || !user.email || !resetUrl) return;

  const displayName = user.fullName || user.username || 'Traveler';

  const bodyHtml = `
    <h2 class="headline">Password Reset Request 🔐</h2>
    <p class="text-content">
      Hello ${displayName}, we received a request to reset your password for your WanderStay account.
    </p>
    <p class="text-content">
      Click the button below to choose a new password. This reset link is valid for <strong>1 hour</strong>.
    </p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">Account:</span>
        <span class="info-val">${user.email}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Requested At:</span>
        <span class="info-val">${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>

    <p class="text-content" style="font-size: 13px; color: #64748B;">
      If you did not request a password reset, you can safely disregard this email. Your password will remain unchanged and secure.
    </p>
  `;

  return sendSafeMail({
    to: user.email,
    subject: 'Reset Your WanderStay Password',
    html: buildHtmlEmail({
      title: 'Password Reset - WanderStay',
      preheader: 'Reset your WanderStay account password. Link expires in 1 hour.',
      bodyHtml,
      ctaText: 'Reset Password',
      ctaUrl: resetUrl
    })
  });
}

async function sendPasswordChangedEmail(user) {
  if (!user || !user.email) return;

  const displayName = user.fullName || user.username || 'Traveler';

  const bodyHtml = `
    <h2 class="headline">Security Alert: Password Updated 🛡️</h2>
    <p class="text-content">
      Hello ${displayName}, the password for your WanderStay account (@${user.username}) was recently changed.
    </p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">Account Email:</span>
        <span class="info-val">${user.email}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Updated On:</span>
        <span class="info-val">${new Date().toLocaleString()}</span>
      </div>
    </div>

    <p class="text-content" style="color: #DC2626;">
      If you did not make this change, please contact our emergency security team immediately at <a href="mailto:support@wanderstay.com" style="color: #DC2626; font-weight: 700;">support@wanderstay.com</a> to secure your account.
    </p>
  `;

  return sendSafeMail({
    to: user.email,
    subject: 'Security Alert: Your WanderStay password was updated',
    html: buildHtmlEmail({
      title: 'Security Alert - WanderStay',
      preheader: 'Your WanderStay password was recently updated.',
      bodyHtml,
      ctaText: 'Review Account Security',
      ctaUrl: `${appUrl}/profile#security`
    })
  });
}

// ============================================================================
// 7. IMPORTANT BOOKING UPDATES EMAIL
// ============================================================================
async function sendBookingUpdateEmail({ booking, listing, user, updateTitle, updateMessage, ctaUrl, ctaText }) {
  if (!user || !user.email || !booking) return;

  const userName = user.fullName || user.username || 'Traveler';
  const bookingRef = `#${booking._id.toString().slice(-8).toUpperCase()}`;

  const bodyHtml = `
    <h2 class="headline">${updateTitle || 'Important Booking Update ℹ️'}</h2>
    <p class="text-content">
      Hello ${userName}, there is an update regarding your reservation <strong>${bookingRef}</strong>${listing ? ` at <strong>${listing.title}</strong>` : ''}:
    </p>

    <div class="info-card">
      <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #1E293B;">
        ${updateMessage}
      </p>
    </div>

    <div class="info-card" style="margin-top: 10px;">
      <div class="info-row">
        <span class="info-label">Booking Reference:</span>
        <span class="info-val" style="font-family: monospace;">${bookingRef}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Stay Dates:</span>
        <span class="info-val">${new Date(booking.checkIn).toLocaleDateString()} → ${new Date(booking.checkOut).toLocaleDateString()}</span>
      </div>
    </div>
  `;

  return sendSafeMail({
    to: user.email,
    subject: `${updateTitle || 'Booking Update'}: ${bookingRef}`,
    html: buildHtmlEmail({
      title: 'Reservation Update - WanderStay',
      preheader: updateMessage.slice(0, 100),
      bodyHtml,
      ctaText: ctaText || 'View Booking Details',
      ctaUrl: ctaUrl || `${appUrl}/bookings/${booking._id}`
    })
  });
}

module.exports = {
  createTransporter,
  sendSafeMail,
  sendWelcomeEmail,
  sendBookingConfirmationEmail,
  sendPaymentConfirmationEmail,
  sendHostBookingNotificationEmail,
  sendBookingCancellationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendBookingUpdateEmail
};
