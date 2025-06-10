require("dotenv").config();
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { User } = require("../models"); // ✅ make sure this path is correct
const jwt = require("jsonwebtoken");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/users/authGoogle/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Generate a username based on the user's name
        let username = profile.displayName.toLowerCase().replace(/\s+/g, "_"); // Replace spaces with underscores
        username = username + profile.id.slice(-4); // Add the last 4 digits of the Google ID to make it unique

        const email = profile.emails
          ? profile.emails[0].value
          : "noemail@google.com";
        const avatarUrl = profile.photos
          ? profile.photos[0].value
          : "default-avatar-url";

        // Check if the username already exists in the database
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
          // If the username already exists, generate a new one
          username = username + "_" + Date.now(); // Append a timestamp to make it unique
        }

        const [user] = await User.findOrCreate({
          where: { googleId: profile.id },
          defaults: {
            name: profile.displayName,
            username: username,
            email: email,
            avatarUrl: avatarUrl,
          },
        });

        // Generate a JWT token with Google profile info and session ID
        const token = jwt.sign(
          {
            userId: user.id, // Store user ID
            username: user.username, // Store username (or other details you want)
            email: user.email, // Store email
          },
          process.env.JWT_SECRET, // Secret to sign the JWT
          { expiresIn: "1h" } // Set expiration time for the JWT
        );

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id); // Store user ID in session
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user); // Make user available in req.user
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
