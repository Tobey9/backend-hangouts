const express = require("express");
const app = express();
const passport = require("./config/passport");
const path = require("path");
const cors = require("cors");
const { sequelize } = require("./models");
const PORT = 3000;
const cookieParser = require("cookie-parser");

require("dotenv").config();

app.use(cookieParser());

app.use(
  cors({
    origin: ["http://localhost:5173", process.env.FRONTEND_URL],
    credentials: true,
  })
);

app.use(express.json());

app.use(passport.initialize());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const userRoutes = require("./routes/Users");
app.use("/users", userRoutes);
const postRoutes = require("./routes/Posts");
app.use("/posts", postRoutes);
const followRoutes = require("./routes/Follow");
app.use("/follow", followRoutes);

sequelize
  .sync() // Set force to true only for development/testing
  .then(() => {
    console.log("Database synced");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Unable to sync database:", err);
  });
