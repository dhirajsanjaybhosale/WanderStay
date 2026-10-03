
const User = require("../models/user");
const bcrypt = require("bcrypt");

// ================== RENDER SIGNUP ==================
module.exports.renderSignup = (req, res) => {
  const selectedRole = req.query.role === 'host' ? 'host' : 'guest';
  res.render("users/signup.ejs", { selectedRole });
};


// ================== SIGNUP ==================
module.exports.signup = async (req, res, next) => {
  try {
    console.log('SIGNUP REQUEST BODY:', req.body);
    const { username, password, email, role, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      req.flash("error", "Username or email already exists");
      return res.redirect("/signup");
    }

    const assignedRole = (role === 'host') ? 'host' : 'guest';
    const newUser = new User({
      email,
      username,
      firstName: firstName || '',
      lastName: lastName || '',
      role: assignedRole,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'
    });
    await newUser.setPassword(password);

    console.log('CREATING USER:', { email, username, role: assignedRole });
    const savedUser = await newUser.save();
    console.log('USER SAVED SUCCESSFULLY:', savedUser.username);

    if (typeof req.login !== "function") {
      throw new Error("Passport login is not configured.");
    }

    await new Promise((resolve, reject) => {
      req.login(savedUser, (err) => {
        if (err) {
          console.log('LOGIN ERROR:', err);
          return reject(err);
        }
        console.log('USER LOGGED IN SUCCESSFULLY');
        resolve();
      });
    });

    if (assignedRole === 'host') {
      req.flash("success", "Welcome to WanderStay! Your host account has been created.");
      return res.redirect("/listings/new");
    }

    req.flash("success", "Welcome to Wanderstays!");
    console.log('FLASH SUCCESS SET, REDIRECTING TO LISTINGS');
    const redirectUrl = req.session.redirectUrl || "/listings";
    delete req.session.redirectUrl;

    res.redirect(redirectUrl);
  } catch (err) {
    console.error('SIGNUP CATCH ERROR:', err);
    req.flash("error", err.message);
    res.redirect("/signup");
  }
};


// ================== BECOME HOST ==================
module.exports.becomeHost = async (req, res) => {
  try {
    if (!req.user) {
      req.flash("error", "Please log in first to become a host.");
      return res.redirect("/login");
    }
    await User.findByIdAndUpdate(req.user._id, { role: "host" });
    req.user.role = "host";
    req.flash("success", "🎉 You are now registered as a WanderStay Host! Welcome to hosting.");
    res.redirect("/dashboard/host");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/listings");
  }
};


// ================== RENDER LOGIN ==================
module.exports.renderLoginForm = (req, res) => {
  res.render("users/login.ejs");
};


// ================== LOGIN ==================
module.exports.login = (req, res) => {
  req.flash("success", "Welcome back to Wanderstays!");

  const redirectUrl = req.session.redirectUrl || "/listings";
  delete req.session.redirectUrl;

  res.redirect(redirectUrl);
};


// ================== LOGOUT ==================
module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);

    req.flash("success", "You are logged out!");
    res.redirect("/listings");
  });
};


// ================== RENDER PROFILE ==================
module.exports.renderProfile = async (req, res) => {
  const Listing = require("../models/listing");
  const Booking = require("../models/booking");
  
  const user = await User.findById(req.user._id).populate("wishlist");
  if (!user) {
    req.flash("error", "User not found.");
    return res.redirect("/login");
  }

  // Fetch contextual user data for deep dashboard integration
  const myPropertiesCount = await Listing.countDocuments({ owner: user._id });
  const myBookingsCount = await Booking.countDocuments({ user: user._id });
  const wishlistCount = user.wishlist ? user.wishlist.length : 0;

  res.render("users/profile.ejs", {
    user,
    stats: {
      properties: myPropertiesCount,
      bookings: myBookingsCount,
      wishlist: wishlistCount
    }
  });
};


// ================== UPDATE PROFILE DETAILS ==================
module.exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, dateOfBirth, gender, country, city, bio } = req.body;

    const updateData = {
      firstName: typeof firstName === 'string' ? firstName.trim() : '',
      lastName: typeof lastName === 'string' ? lastName.trim() : '',
      phone: typeof phone === 'string' ? phone.trim() : '',
      gender: gender || '',
      country: typeof country === 'string' ? country.trim() : '',
      city: typeof city === 'string' ? city.trim() : '',
      bio: typeof bio === 'string' ? bio.trim() : ''
    };

    if (dateOfBirth && dateOfBirth.trim() !== '') {
      updateData.dateOfBirth = new Date(dateOfBirth);
    } else {
      updateData.dateOfBirth = null;
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true
    });

    // Update passport session user details
    if (req.user) {
      req.user.firstName = updatedUser.firstName;
      req.user.lastName = updatedUser.lastName;
      req.user.phone = updatedUser.phone;
      req.user.city = updatedUser.city;
      req.user.country = updatedUser.country;
      req.user.bio = updatedUser.bio;
    }

    req.flash("success", "✓ Profile updated successfully");
    res.redirect("/profile");
  } catch (err) {
    console.error("Profile update error:", err);
    req.flash("error", err.message || "⚠ Unable to update profile. Please try again.");
    res.redirect("/profile");
  }
};


// ================== UPDATE PROFILE PHOTO ==================
module.exports.updateProfilePhoto = async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      if (req.xhr || req.headers.accept?.includes("application/json")) {
        return res.status(400).json({ success: false, message: "No image file provided." });
      }
      req.flash("error", "⚠ Unable to update photo. Please select an image file.");
      return res.redirect("/profile");
    }

    const avatarUrl = req.file.path;
    const user = await User.findById(req.user._id);
    if (!user) {
      if (req.xhr || req.headers.accept?.includes("application/json")) {
        return res.status(404).json({ success: false, message: "User not found." });
      }
      req.flash("error", "User not found.");
      return res.redirect("/login");
    }

    user.avatar = avatarUrl;
    await user.save();

    // Keep session user synchronized
    if (req.user) {
      req.user.avatar = avatarUrl;
    }

    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.json({
        success: true,
        message: "✓ Profile photo updated successfully",
        avatarUrl
      });
    }

    req.flash("success", "✓ Profile photo updated successfully");
    res.redirect("/profile");
  } catch (err) {
    console.error("Profile photo upload error:", err);
    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return res.status(500).json({ success: false, message: err.message || "Failed to upload photo." });
    }
    req.flash("error", "⚠ Unable to update profile photo. Please try again.");
    res.redirect("/profile");
  }
};


// ================== UPDATE PASSWORD ==================
module.exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      req.flash("error", "⚠ All password fields are required.");
      return res.redirect("/profile#security");
    }

    if (newPassword !== confirmPassword) {
      req.flash("error", "⚠ New password and confirmation do not match.");
      return res.redirect("/profile#security");
    }

    if (newPassword.length < 6) {
      req.flash("error", "⚠ New password must be at least 6 characters long.");
      return res.redirect("/profile#security");
    }

    const user = await User.findById(req.user._id);
    await user.changePassword(currentPassword, newPassword);

    req.flash("success", "✓ Password updated successfully!");
    res.redirect("/profile#security");
  } catch (err) {
    console.error("Password change error:", err);
    req.flash("error", `⚠ ${err.message || "Unable to change password. Please check your current password."}`);
    res.redirect("/profile#security");
  }
};
