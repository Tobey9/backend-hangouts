const express = require("express");
const { Post, User, Like, Comment } = require("../models");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const verifyToken = require("../middleware/authVerify");
const router = express.Router();

const cloudinary = require("../config/cloudinaryConfig");
// Change Multer storage to memoryStorage for Cloudinary
const storage = multer.memoryStorage(); // Store file in memory
const upload = multer({ storage: storage });

// --- POST /posts --- Create a new post
router.post("/", verifyToken, upload.single("imageUrl"), async (req, res) => {
  // Expects 'imageUrl' as the file input name
  try {
    const { content, imageUrl: providedImageUrl } = req.body; // Destructure `imageUrl` from body as `providedImageUrl`
    let finalImageUrl = null;

    // --- DIAGNOSTIC LOG 1: Check if req.file is populated ---
    console.log("--- POSTS: New Post Request ---");
    console.log("req.file:", req.file);
    console.log("req.body.content:", content);
    console.log("req.body.imageUrl (providedImageUrl):", providedImageUrl);
    // --- END DIAGNOSTIC LOG 1 ---

    // --- Initial validation: Post must have content OR an image ---
    if (
      !content &&
      !req.file &&
      (!providedImageUrl || providedImageUrl === "")
    ) {
      return res.status(400).json({
        message:
          "Post cannot be empty. Provide content, an image file, or an image URL.",
      });
    }
    // --- End Initial validation ---

    // --- Determine the final image URL: Prioritize file upload, then external URL ---
    if (req.file) {
      // Scenario 1: User uploaded a file (highest priority)
      // Convert buffer to base64 data URI for Cloudinary upload
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const dataURI = "data:" + req.file.mimetype + ";base64," + b64;

      const cloudinaryUploadResult = await cloudinary.uploader.upload(dataURI, {
        folder: "hangouts", // Optional: A specific folder in Cloudinary for posts
        // You can add transformations or tags here, e.g., transformation: { width: 800, crop: "limit" }
      });
      finalImageUrl = cloudinaryUploadResult.secure_url;
      console.log(
        "Cloudinary Upload Result:",
        cloudinaryUploadResult.secure_url
      );
    } else if (providedImageUrl && providedImageUrl.startsWith("http")) {
      // Scenario 2: User provided a direct URL (if no file was uploaded)
      // Basic URL validation: ensure it starts with http(s)
      finalImageUrl = providedImageUrl;
      console.log("Using provided image URL:", finalImageUrl);
    } else if (providedImageUrl) {
      // Scenario 3: User provided a URL but it doesn't start with http(s)
      return res.status(400).json({
        message:
          "Invalid image URL provided. Must start with http:// or https://.",
      });
    }
    // If neither req.file nor providedImageUrl is present/valid, finalImageUrl remains null (as initialized)
    // --- End Determine the final image URL ---

    const newPost = await Post.create({
      content,
      image_url: finalImageUrl, // Store the determined URL (Cloudinary or external)
      userId: req.user.userId, // User ID comes from JWT via verifyToken middleware
    });

    res.status(201).json(newPost);
  } catch (err) {
    console.error("Post creation error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /posts/public - fetch all posts with public visibility
router.get("/public", verifyToken, async (req, res) => {
  try {
    const posts = await Post.findAll({
      include: [
        {
          model: User,
          attributes: ["id", "username", "avatar_url", "name"],
        },
        {
          model: Like,
          where: { userId: req.user?.userId }, // optional: only for logged-in user
          required: false, // left join so posts without like still come
          attributes: ["id"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const formattedPosts = posts.map((post) => ({
      ...post.toJSON(),
      likedByCurrentUser: post.Likes.length > 0,
    }));

    res.json(formattedPosts);
  } catch (err) {
    res.status(500).json({ message: "Server error fetching public posts." });
    console.error("Error fetching public posts:", err);
  }
});

// GET /posts/mine - only authenticated user's posts
router.get("/mine", verifyToken, async (req, res) => {
  try {
    const posts = await Post.findAll({
      where: { userId: req.user.userId },
      order: [["createdAt", "DESC"]],
      include: {
        model: User,
        attributes: ["id", "username", "avatar_url", "name"],
      },
    });

    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "Server error fetching your posts." });
  }
});

router.get("/user/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const posts = await Post.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
      include: {
        model: User,
        attributes: ["id", "username", "avatar_url", "name"],
      },
    });

    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "Server error fetching user's posts." });
  }
});

// DELETE /posts/:postId - Delete a post (only by the owner)
router.delete("/post/:postId", verifyToken, async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.userId;

  try {
    const post = await Post.findByPk(postId);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.userId !== userId) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this post" });
    }

    // Delete the image file if it exists
    if (post.image_url) {
      const imagePath = path.join(
        __dirname,
        "..",
        post.image_url.replace(/^\/+/, "")
      );
      fs.unlink(imagePath, (err) => {
        if (err) {
          console.error("Failed to delete image:", err.message);
        } else {
          console.log("Image deleted:", imagePath);
        }
      });
    }

    await post.destroy();

    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("Error deleting post:", err);
    res.status(500).json({ message: "Server error deleting post" });
  }
});

router.get("/post/:postId", async (req, res) => {
  const { postId } = req.params;

  try {
    const post = await Post.findOne({
      where: { id: postId },
      attributes: ["id", "content", "image_url", "createdAt"],
      include: [
        {
          model: User,
          attributes: ["id", "username", "avatar_url", "name"],
        },
        {
          model: Comment,
          include: [
            {
              model: User,
              as: "author",
              attributes: ["id", "username", "avatar_url", "name"],
            },
          ],
        },
      ],
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json(post);
  } catch (err) {
    console.error("🔥 Sequelize error:", err.message);
    console.error(err.stack);
    res.status(500).json({ message: "Error fetching post" });
  }
});

// POST /posts/:postId/like
router.post("/post/:postId/like", verifyToken, async (req, res) => {
  const { postId } = req.params;
  const userId = req.user.userId;

  try {
    const existing = await Like.findOne({ where: { postId, userId } });

    if (existing) {
      // Unlike if already liked
      await existing.destroy();
      return res.json({ message: "Unliked" });
    } else {
      await Like.create({ postId, userId });
      return res.json({ message: "Liked" });
    }
  } catch (err) {
    res.status(500).json({ message: "Error toggling like" });
  }
});

// POST /posts/:postId/comments
router.post("/post/:postId/comments", verifyToken, async (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;
  const userId = req.user.userId;

  try {
    const comment = await Comment.create({ postId, userId, content });
    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ message: "Error adding comment" });
  }
});

// GET /posts/:postId/comments
router.get("/post/:postId/comments", async (req, res) => {
  const { postId } = req.params;

  try {
    const comments = await Comment.findAll({
      where: { postId },
      include: [
        {
          model: User,
          as: "author",
          attributes: ["id", "username", "avatar_url", "name"],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: "Error fetching comments" });
  }
});

router.delete(
  "/post/:postId/comments/:commentId",
  verifyToken,
  async (req, res) => {
    const { postId, commentId } = req.params;
    const userId = req.user.userId;

    try {
      const comment = await Comment.findOne({
        where: { id: commentId, postId, userId },
      });

      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      await comment.destroy();
      res.json({ message: "Comment deleted successfully" });
    } catch (err) {
      res.status(500).json({ message: "Error deleting comment" });
    }
  }
);

module.exports = router;
