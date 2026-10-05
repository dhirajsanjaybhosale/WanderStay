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
const MongoStore = require("connect-mongo").default;
const flash = require("connect-flash");

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
   ENV CHECK & DB
======================= */
const dburl = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/wanderstays";
const SECRET = process.env.SECRET || "wanderstay_secret_key_default";

async function connectDB() {
  try {
    await mongoose.connect(dburl);
    console.log("✅ Connected to MongoDB:", dburl.includes("@") ? "Atlas Cluster" : "Local Database");
  } catch (err) {
    console.error("❌ DB Connection Error:", err.message);
    if (dburl !== "mongodb://127.0.0.1:27017/wanderstays") {
      console.log("🔄 Retrying with local MongoDB fallback...");
      try {
        await mongoose.connect("mongodb://127.0.0.1:27017/wanderstays");
        console.log("✅ Connected to Local MongoDB fallback");
      } catch (localErr) {
        console.error("❌ Local MongoDB fallback failed:", localErr.message);
      }
    }
  }
}
connectDB();


/* =======================
   APP CONFIG
======================= */
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

/* =======================
   SESSION CONFIG
======================= */
const store = MongoStore.create({
  mongoUrl: dburl,
  crypto: { secret: SECRET },
  touchAfter: 24 * 3600,
});

store.on("error", (e) => {
  console.log("❌ Session Store Error", e);
});

const sessionOptions = {
  store,
  secret: SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};
app.use(session(sessionOptions));

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

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

/* =======================
   ROUTE HANDLERS
======================= */
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
      { name: 'Goa', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80', avgCost: '₹3,500', attractions: ['Baga Beach','Fort Aguada'], trending: true, count: '180+ stays', category: 'Beach' },
      { name: 'Manali', image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80', avgCost: '₹4,200', attractions: ['Solang Valley','Hadimba Temple'], trending: true, count: '145+ stays', category: 'Mountain' },
      { name: 'Kashmir', image: 'https://images.unsplash.com/photo-1549887534-3f9f2f1b64d3?auto=format&fit=crop&w=1400&q=80', avgCost: '₹5,000', attractions: ['Dal Lake','Gulmarg'], trending: false, count: '90+ stays', category: 'Lake' },
      { name: 'Dubai', image: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1400&q=80', avgCost: '$120', attractions: ['Burj Khalifa','Desert Safari'], trending: true, count: '230+ stays', category: 'Desert' },
      { name: 'Bali', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1400&q=80', avgCost: '$90', attractions: ['Uluwatu','Rice Terraces'], trending: true, count: '310+ stays', category: 'Beach' },
      { name: 'Paris', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1400&q=80', avgCost: '€140', attractions: ['Eiffel Tower','Louvre'], trending: true, count: '420+ stays', category: 'City' },
      { name: 'Swiss Alps', image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1400&q=80', avgCost: '€180', attractions: ['Matterhorn','Zermatt'], trending: true, count: '160+ stays', category: 'Ski' },
      { name: 'Tuscany', image: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1400&q=80', avgCost: '€130', attractions: ['Florence','Chianti'], trending: false, count: '215+ stays', category: 'Villa' }
    ];

    res.render('home/index', { featured, destinations });
  } catch (e) {
    next(e);
  }
});

/* =======================
   404 & ERROR HANDLER
======================= */
app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found!"));
});

app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something went wrong!" } = err;
  res.status(statusCode).render("error.ejs", { err: { statusCode, message } });
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
