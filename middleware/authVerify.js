require("dotenv").config();
const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const token = req.cookies.jwt; // Token stored in cookies

  if (!token) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  try {
    // Verify the token using the secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user info to the request object (req.user)
    req.user = decoded;

    next(); // Continue to the next middleware/route
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = verifyToken;
