// cloudinaryConfig.js
require("dotenv").config(); // Make sure this is at the very top of your entry file or config file

const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Strongly recommended to use HTTPS
});

module.exports = cloudinary;
