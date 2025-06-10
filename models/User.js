// models/User.js

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      username: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true, // allow null for OAuth users with no email
        validate: {
          isEmail: true,
        },
      },
      password_hash: {
        type: DataTypes.STRING,
        allowNull: true, // null if user signs up with OAuth
      },
      avatar_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bio: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      googleId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      underscored: true,
      tableName: "users",
    }
  );

  User.associate = (models) => {
    User.hasMany(models.Post, {
      foreignKey: "userId",
      as: "posts", // optional alias
      onDelete: "CASCADE",
    });

    User.hasMany(models.Comment, {
      foreignKey: "userId",
      as: "comments",
      onDelete: "CASCADE",
    });

    // Followers/following
    User.belongsToMany(User, {
      through: "follows",
      as: "following", // I'm following others
      foreignKey: "followerId", // my ID
      otherKey: "followingId", // their ID
      onDelete: "CASCADE",
    });

    User.belongsToMany(User, {
      through: "follows",
      as: "followers", // Others are following me
      foreignKey: "followingId", // my ID
      otherKey: "followerId", // their ID
      onDelete: "CASCADE",
    });
  };

  return User;
};
