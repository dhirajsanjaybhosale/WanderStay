if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection:", reason?.message || reason);
});

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError");

const session = require("express-session");
const connectMongo = require("connect-mongo");
const MongoStore = connectMongo.default || connectMongo.MongoStore || connectMongo;
const flash = require("connect-flash");
const cookieParser = require("cookie-parser");
const { i18nMiddleware, setLanguageHandler } = require("./utils/i18n");
const { currencyMiddleware, setCurrencyHandler } = require("./utils/currency");

const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user");

const listingRouter = require("./routes/listing");
const reviewRouter = require("./routes/review");
const bookingRouter = require("./routes/booking");
const wishlistRouter = require("./routes/wishlist");
const dashboardRouter = require("./routes/dashboard");
const adminRouter = require("./routes/admin");
const userRouter = require("./routes/user");
const aiPlannerRouter = require("./routes/aiPlanner");
const tripsRouter = require("./routes/trips");
const messageRouter = require("./routes/message");
const notificationRouter = require("./routes/notification");
const Notification = require("./models/notification");
const { getNotificationMeta } = require("./utils/notificationHelper");
const Listing = require("./models/listing");

/* =======================
   APP VIEW ENGINE & PROXY
======================= */
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

/* =======================
   ENV VALIDATION HELPERS
======================= */
function getValidatedMongoUrl() {
  const isProduction = process.env.NODE_ENV === "production";
  let rawUrl = process.env.MONGO_URL;

  if (typeof rawUrl === "string") {
    rawUrl = rawUrl.trim();
    // Strip accidental wrapping quotes (e.g., from Render env inputs or .env copies)
    if (
      (rawUrl.startsWith('"') && rawUrl.endsWith('"')) ||
      (rawUrl.startsWith("'") && rawUrl.endsWith("'"))
    ) {
      rawUrl = rawUrl.slice(1, -1).trim();
    }
  }

  if (!rawUrl) {
    if (isProduction) {
      throw new Error(
        "FATAL: 'MONGO_URL' environment variable is required in production but was not provided. Please configure MONGO_URL in your Render Environment settings."
      );
    }
    console.log("ℹ️ No MONGO_URL provided, defaulting to local MongoDB in development mode.");
    return "mongodb://127.0.0.1:27017/wanderstays";
  }

  // Validate scheme
  if (!rawUrl.startsWith("mongodb://") && !rawUrl.startsWith("mongodb+srv://")) {
    throw new Error(
      "FATAL: Invalid MONGO_URL scheme. The connection string must start with 'mongodb://' or 'mongodb+srv://'. Check your Render environment settings."
    );
  }

  // Check for common Atlas placeholder mistake
  if (rawUrl.includes("<password>")) {
    throw new Error(
      "FATAL: MONGO_URL contains the placeholder '<password>'. Please replace it with your actual MongoDB Atlas database user password in Render environment settings."
    );
  }

  return rawUrl;
}

function getSanitizedSecret() {
  let secret = process.env.SECRET;
  if (typeof secret === "string") {
    secret = secret.trim();
    if (
      (secret.startsWith('"') && secret.endsWith('"')) ||
      (secret.startsWith("'") && secret.endsWith("'"))
    ) {
      secret = secret.slice(1, -1).trim();
    }
  }

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.warn("⚠️ Warning: 'SECRET' environment variable is not set in production. Using fallback secret. For security, please set SECRET in Render Environment settings.");
    }
    return "wanderstay_secret_key_default";
  }
  return secret;
}

/* =======================
   MIDDLEWARE & ROUTES SETUP
======================= */
function setupApp(store, secret) {
  // 1. Parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(methodOverride("_method"));

  // 2. Static files
  app.use(express.static(path.join(__dirname, "public")));

  // 3. Cookie parser
  app.use(cookieParser(secret));

  // 4. Session middleware (using single MongoStore instance)
  const sessionOptions = {
    store,
    secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
    },
  };
  app.use(session(sessionOptions));

  // 5. Flash
  app.use(flash());

  // 6. Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // 7. i18n & currency
  app.use(i18nMiddleware);
  app.use(currencyMiddleware);

  // 8. Custom locals middleware
  app.use(async (req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    res.locals.CurrUser = req.user;
    res.locals.mapToken = process.env.MAP_TOKEN || "";
    res.locals.getNotificationMeta = getNotificationMeta;

    if (req.user) {
      try {
        const [unreadCount, recentNotifs] = await Promise.all([
          Notification.countDocuments({ user: req.user._id, isRead: false }),
          Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(6)
        ]);
        res.locals.unreadNotificationCount = unreadCount;
        res.locals.recentNotifications = recentNotifs;
      } catch (err) {
        res.locals.unreadNotificationCount = 0;
        res.locals.recentNotifications = [];
      }
    } else {
      res.locals.unreadNotificationCount = 0;
      res.locals.recentNotifications = [];
    }
    next();
  });

  // Passport LocalStrategy & Serialization
  passport.use(new LocalStrategy({
    usernameField: 'username'
  }, async (username, password, done) => {
    try {
      // First try to find by username
      let user = await User.findOne({ username: username });
      
      // If not found, try to find by email
      if (!user) {
        user = await User.findOne({ email: username });
      }
      
      if (!user) {
        return done(null, false, { message: 'Incorrect username or email.' });
      }

      if (user.isSuspended) {
        return done(null, false, { message: 'Your account has been suspended by an administrator.' });
      }
      
      // Validate password using our custom method
      const isValid = await user.validatePassword(password);
      if (!isValid) {
        return done(null, false, { message: 'Incorrect password.' });
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      if (user && user.isSuspended) {
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  // 9. Routes
  app.post("/set-language", setLanguageHandler);
  app.get("/set-language", setLanguageHandler);
  app.post("/set-currency", setCurrencyHandler);
  app.get("/set-currency", setCurrencyHandler);

  app.use("/admin", adminRouter);
  app.use("/listings", listingRouter);
  app.use("/listings/:id/reviews", reviewRouter);
  app.use("/bookings", bookingRouter);
  app.use("/wishlist", wishlistRouter);
  app.use("/dashboard", dashboardRouter);
  app.use("/", userRouter);
  app.use("/ai-planner", aiPlannerRouter);
  app.use("/trips", tripsRouter);
  app.use("/messages", messageRouter);
  app.use("/notifications", notificationRouter);

  // Homepage - premium landing
  app.get('/', async (req, res, next) => {
    try {
      const featured = await Listing.find({ isAvailable: true })
        .sort({ averageRating: -1, createdAt: -1 })
        .limit(8)
        .populate('owner');
      const destinations = [
        { name: 'Goa', country: 'India', avgCostBaseINR: 3500, image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80', avgCost: '₹3,500', attractions: ['Baga Beach','Fort Aguada'], trending: true, count: '180+ stays', category: 'Beach' },
        { name: 'Manali', country: 'India', avgCostBaseINR: 4200, image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80', avgCost: '₹4,200', attractions: ['Solang Valley','Hadimba Temple'], trending: true, count: '145+ stays', category: 'Mountain' },
        { name: 'Kashmir', country: 'India', avgCostBaseINR: 5000, image: 'https://images.unsplash.com/photo-1549887534-3f9f2f1b64d3?auto=format&fit=crop&w=1400&q=80', avgCost: '₹5,000', attractions: ['Dal Lake','Gulmarg'], trending: false, count: '90+ stays', category: 'Lake' },
        { name: 'Dubai', country: 'United Arab Emirates', avgCostBaseINR: 10000, image: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1400&q=80', avgCost: 'AED 425', attractions: ['Burj Khalifa','Desert Safari'], trending: true, count: '230+ stays', category: 'Desert' },
        { name: 'Bali', country: 'Indonesia', avgCostBaseINR: 7500, image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1400&q=80', avgCost: 'Rp 1,413,750', attractions: ['Uluwatu','Rice Terraces'], trending: true, count: '310+ stays', category: 'Beach' },
        { name: 'Paris', country: 'France', avgCostBaseINR: 12500, image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1400&q=80', avgCost: '€135', attractions: ['Eiffel Tower','Louvre'], trending: true, count: '420+ stays', category: 'City' },
        { name: 'Swiss Alps', country: 'Switzerland', avgCostBaseINR: 16000, image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1400&q=80', avgCost: 'CHF 168', attractions: ['Matterhorn','Zermatt'], trending: true, count: '160+ stays', category: 'Ski' },
        { name: 'Tuscany', country: 'Italy', avgCostBaseINR: 11500, image: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1400&q=80', avgCost: '€124', attractions: ['Florence','Chianti'], trending: false, count: '215+ stays', category: 'Villa' }
      ];

      res.render('home/index', { featured, destinations });
    } catch (e) {
      next(e);
    }
  });

  // 10. 404 handler
  app.all("*", (req, res, next) => {
    next(new ExpressError(404, "Page Not Found!"));
  });

  // 11. Error handler
  app.use((err, req, res, next) => {
    console.error("❌ Express Error Handler:", err.stack || err);
    const { statusCode = 500, message = "Something went wrong!" } = err;
    res.status(statusCode).render("error.ejs", { err: { statusCode, message } });
  });
}

/* =======================
   SERVER STARTUP
======================= */
async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";
  try {
    const dbUrl = getValidatedMongoUrl();
    const secret = getSanitizedSecret();

    // 1. Connect Mongoose to MongoDB
    await mongoose.connect(dbUrl, {
      serverSelectionTimeoutMS: 10000,
    });
    const isAtlas = dbUrl.startsWith("mongodb+srv://") || dbUrl.includes("@");
    console.log(`✅ Connected to MongoDB: ${isAtlas ? "Atlas Cluster" : "Local Database"}`);

    // 2. Initialize session store reusing the connected Mongoose client
    const store = MongoStore.create({
      client: mongoose.connection.getClient(),
      dbName: mongoose.connection.name,
      crypto: { secret },
      touchAfter: 24 * 3600,
    });

    store.on("error", (e) => {
      console.error("❌ Session Store Error:", e?.message || e);
    });

    // 3. Register middleware pipeline and routes in correct order
    setupApp(store, secret);

    // 4. Start HTTP listener only after database and store are fully ready
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`✅ Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Fatal Startup Error:", err.message);
    if (isProduction) {
      console.error("💡 Atlas Troubleshooting Checklist for Render:");
      console.error("   1. Verify MONGO_URL in Render Environment settings (ensure no wrapping quotes or whitespace).");
      console.error("   2. In MongoDB Atlas > Network Access, ensure 0.0.0.0/0 (allow access from anywhere) is active.");
      console.error("   3. Verify database username and password in connection string.");
      console.error("   4. Verify database user privileges in Atlas.");
    }
    process.exit(1);
  }
}

startServer();

module.exports = app;
