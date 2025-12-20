const User = require("../models/user");

// Render Signup Form
module.exports.renderSignupForm = (req, res) => {
    res.render("users/signup.ejs");
};

// Signup Controller
module.exports.signup = async (req, res, next) => {
    try {
        const { username, password, email } = req.body;
        const newUser = new User({ email, username });
        const registeredUser = await User.register(newUser, password);
        console.log(registeredUser);

        req.login(registeredUser, (err) => {
            if (err) return next(err);

            req.flash("success", "Welcome to Wanderlust!");

            // Use session redirectUrl if set, otherwise default to "/listings"
            const redirectUrl = req.session.redirectUrl || "/listings";
            delete req.session.redirectUrl; // Clean up
            res.redirect(redirectUrl);
        });
    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/signup");
    }
};

// Render Login Form
module.exports.renderLoginForm = (req, res) => {
    res.render("users/login.ejs");
};

// Login Controller
module.exports.login = (req, res) => {
    req.flash("success", "Welcome back to Wanderlust!");

    // Use session redirectUrl if set, otherwise default to "/listings"
    const redirectUrl = req.session.redirectUrl || "/listings";
    delete req.session.redirectUrl; // Clean up
    res.redirect(redirectUrl);
};

// Logout Controller
module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err){
             return next(err);
        } 
        req.flash("success", "You are logged out!");
        res.redirect("/listings");
    });
};
