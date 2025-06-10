// routes/follow.js
const express = require("express");
const router = express.Router();
const { User } = require("../models");
const verifyToken = require("../middleware/authVerify");

// Follow a user
router.post("/:id/follow", verifyToken, async (req, res) => {
  const followerId = req.user.userId;
  const followedId = parseInt(req.params.id);

  if (followerId === followedId) {
    return res.status(400).json({ error: "You cannot follow yourself" });
  }

  try {
    const follower = await User.findByPk(followerId);
    const followed = await User.findByPk(followedId);

    if (!followed) {
      return res.status(404).json({ error: "User not found" });
    }

    await follower.addFollowing(followed); // magic from Sequelize belongsToMany
    res.json({ message: "Followed successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error following user" });
  }
});

// Unfollow a user
router.post("/:id/unfollow", verifyToken, async (req, res) => {
  const followerId = req.user.userId;
  const followedId = parseInt(req.params.id);

  try {
    const follower = await User.findByPk(followerId);
    const followed = await User.findByPk(followedId);

    if (!followed) {
      return res.status(404).json({ error: "User not found" });
    }

    await follower.removeFollowing(followed);
    res.json({ message: "Unfollowed successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error unfollowing user" });
  }
});

// Get followers of a user
router.get("/:id/followers", async (req, res) => {
  const userId = parseInt(req.params.id);

  try {
    const user = await User.findByPk(userId, {
      include: {
        model: User,
        as: "followers",
        attributes: ["id", "username", "avatar_url"],
        through: { attributes: [] },
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user.followers);
  } catch (err) {
    res.status(500).json({ error: "Error getting followers" });
  }
});

// Get users a user is following
router.get("/:id/following", async (req, res) => {
  const userId = parseInt(req.params.id);

  try {
    const user = await User.findByPk(userId, {
      include: {
        model: User,
        as: "following",
        attributes: ["id", "username", "avatar_url"],
        through: { attributes: [] },
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user.following);
  } catch (err) {
    res.status(500).json({ error: "Error getting following list" });
  }
});

module.exports = router;
