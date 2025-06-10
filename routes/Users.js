require("dotenv").config();
const express = require("express");
const bcrypt = require("bcrypt");
const { User } = require("../models");
const jwt = require("jsonwebtoken");
const verifyToken = require("../middleware/authVerify");
const passport = require("../config/passport");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const cloudinary = require("../config/cloudinaryConfig");
const upload = multer({ storage: multer.memoryStorage() });

router.post("/register", async (req, res) => {
  try {
    const { email, password, username, name } = req.body;
    console.log(req.body);

    // Basic validation
    if (!email || !password || !username || !name) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      email,
      password_hash: hashedPassword,
      username,
      name,
    });

    // Create JWT
    const token = jwt.sign(
      { userId: newUser.id, username: username, email: newUser.email },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    // Set JWT in cookie
    res.cookie("jwt", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" ? true : false, // Set to true in production
      sameSite: "lax",
      maxAge: 3600000,
    });

    res.status(201).json({ message: "User registered successfully." });
  } catch (err) {
    console.error("Error during registration:", err);
    res.status(500).json({ error: "Server error." });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email } });

    if (!user || !user.password_hash) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("jwt", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 3600000,
    });

    res.json({
      message: "Logged in successfully.",
      userId: user.id,
      username: user.username,
    });
  } catch (err) {
    console.error("Error during login:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

// routes/Users.js
router.get(
  "/authGoogle",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

router.get(
  "/authGoogle/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: false,
  }),
  (req, res) => {
    // Optionally set JWT here too
    const token = jwt.sign(
      {
        userId: req.user.id,
        username: req.user.username,
        email: req.user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("jwt", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 3600000,
    });

    // Redirect to frontend
    res.redirect("http://localhost:5173");
  }
);

router.post("/logout", (req, res) => {
  res.clearCookie("jwt", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" ? true : false,
  });
  res.json({ message: "Logged out successfully" });
});

// GET /users/profile
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userId, {
      attributes: ["id", "username", "email", "name", "avatar_url", "bio"],
      include: [
        { model: User, as: "followers", attributes: ["id"] },
        { model: User, as: "following", attributes: ["id"] },
      ],
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /profile – with either file upload or direct URL
router.put(
  "/profile",
  verifyToken,
  upload.single("avatarFile"), // Input field for file upload
  async (req, res) => {
    try {
      const { name, bio, avatar_url: providedAvatarUrl } = req.body; // `avatar_url` from body
      const userId = req.user.userId;

      const user = await User.findByPk(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      let finalAvatarUrl = user.avatar_url; // Default to current avatar

      // --- Determine the final avatar URL ---
      if (req.file) {
        // Scenario 1: User uploaded a new file (highest priority)
        // Delete old avatar from Cloudinary (if applicable)
        if (user.avatar_url && user.avatar_url.includes("cloudinary.com")) {
          try {
            const publicId = user.avatar_url.split("/").pop().split(".")[0];
            await cloudinary.uploader.destroy(`avatars/${publicId}`); // Adjust folder if needed
            console.log("Old Cloudinary avatar deleted:", publicId);
          } catch (cloudinaryErr) {
            console.warn(
              "Failed to delete old avatar from Cloudinary:",
              cloudinaryErr.message
            );
          }
        }
        // Upload new file to Cloudinary
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
        const cloudinaryUploadResult = await cloudinary.uploader.upload(
          dataURI,
          {
            folder: "avatars_hangouts", // Specific folder for avatars
            transformation: [
              { width: 200, height: 200, crop: "fill", gravity: "face" },
            ], // Example transformation
          }
        );
        finalAvatarUrl = cloudinaryUploadResult.secure_url;
        console.log("Cloudinary Avatar Upload Result:", finalAvatarUrl);
      } else if (providedAvatarUrl && providedAvatarUrl.startsWith("http")) {
        // Scenario 2: User provided a direct URL (if no file was uploaded)
        // If old avatar was a local file, delete it
        if (user.avatar_url?.startsWith("/uploads/")) {
          const oldPath = path.join(__dirname, "..", user.avatar_url);
          fs.unlink(oldPath, (err) => {
            if (err) console.warn("Failed to delete old local avatar:", err);
          });
        }
        // If old avatar was Cloudinary and different from provided, consider deleting it (optional, for cleanup)
        // For now, we simply overwrite with the new URL
        finalAvatarUrl = providedAvatarUrl;
        console.log("Using provided avatar URL:", finalAvatarUrl);
      } else if (providedAvatarUrl === "") {
        // Scenario 3: User explicitly wants to remove their avatar (by sending an empty string)
        if (user.avatar_url && user.avatar_url.includes("cloudinary.com")) {
          try {
            const publicId = user.avatar_url.split("/").pop().split(".")[0];
            await cloudinary.uploader.destroy(`avatars/${publicId}`);
            console.log(
              "Old Cloudinary avatar removed (empty string provided):",
              publicId
            );
          } catch (cloudinaryErr) {
            console.warn(
              "Failed to delete old avatar from Cloudinary (empty string provided):",
              cloudinaryErr.message
            );
          }
        } else if (user.avatar_url?.startsWith("/uploads/")) {
          const oldPath = path.join(__dirname, "..", user.avatar_url);
          fs.unlink(oldPath, (err) => {
            if (err)
              console.warn(
                "Failed to delete old local avatar (empty string provided):",
                err
              );
          });
        }
        finalAvatarUrl = null; // Set avatar to null
      } else if (providedAvatarUrl) {
        // Scenario 4: User provided a URL but it doesn't start with http(s)
        return res.status(400).json({
          message:
            "Invalid avatar URL provided. Must start with http:// or https://, or be empty to remove.",
        });
      }
      // If neither req.file nor providedAvatarUrl is present/valid, finalAvatarUrl remains its original value

      // --- End Determine the final avatar URL ---

      // Update user fields
      user.name = name ?? user.name;
      user.bio = bio ?? user.bio;
      user.avatar_url = finalAvatarUrl; // Use the determined URL

      await user.save();

      res.json({
        message: "Profile updated successfully",
        user: {
          id: user.id,
          name: user.name,
          avatar_url: user.avatar_url,
          bio: user.bio,
        },
      });
    } catch (err) {
      console.error("Error updating profile:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

router.get("/auth", verifyToken, (req, res) => {
  console.log("Cookies:", req.cookies); // <-- Add this
  const token = req.cookies.jwt;
  if (!token) return res.status(401).json({ message: "Not logged in" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token:", decoded); // <-- Add this
    res.json({
      id: decoded.userId,
      email: decoded.email,
      username: decoded.username,
    });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.get("/profile/:username", async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({
      where: { username },
      attributes: ["id", "username", "name", "avatar_url", "bio"],
      include: [
        { model: User, as: "followers", attributes: ["id"] },
        { model: User, as: "following", attributes: ["id"] },
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json(user);
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res.status(500).json({ error: "Server error." });
  }
});

module.exports = router;
