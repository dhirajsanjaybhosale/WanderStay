
const express = require("express");
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const { isLoggedIn, saveRedirectUrl } = require("../middleware.js");
const userController = require("../controllers/users.js");


// ================== BECOME HOST ==================
router.get("/become-host", isLoggedIn, wrapAsync(userController.becomeHost));
router.post("/become-host", isLoggedIn, wrapAsync(userController.becomeHost));


// ================== SIGNUP ==================
router
  .route("/signup")
  .get(userController.renderSignup)
  .post(wrapAsync(userController.signup));


// ================== LOGIN ==================
router
  .route("/login")
  .get(userController.renderLoginForm)
  .post(
    saveRedirectUrl,
    passport.authenticate("local", {
      failureRedirect: "/login",
      failureFlash: true,
    }),
    userController.login
  );


// ================== LOGOUT ==================
router.get("/logout", userController.logout);


// ================== PROFILE MANAGEMENT ==================
const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPG, JPEG, PNG, WEBP) are allowed!"), false);
    }
  }
});

router
  .route("/profile")
  .get(isLoggedIn, wrapAsync(userController.renderProfile))
  .post(isLoggedIn, wrapAsync(userController.updateProfile));

router.post(
  "/profile/photo",
  isLoggedIn,
  upload.single("avatar"),
  wrapAsync(userController.updateProfilePhoto)
);

router.post(
  "/profile/password",
  isLoggedIn,
  wrapAsync(userController.updatePassword)
);


module.exports = router;
