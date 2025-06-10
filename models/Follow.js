module.exports = (sequelize, DataTypes) => {
  const Follow = sequelize.define("Follow", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
  });

  // Define associations in associate method
  Follow.associate = (models) => {
    Follow.belongsTo(models.User, {
      foreignKey: "followerId",
      as: "follower",
      onDelete: "CASCADE",
    });

    Follow.belongsTo(models.User, {
      foreignKey: "followedId",
      as: "followed",
      onDelete: "CASCADE",
    });
  };

  return Follow;
};
