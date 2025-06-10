module.exports = (sequelize, DataTypes) => {
  const Like = sequelize.define("Like", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
  });

  Like.associate = (models) => {
    Like.belongsTo(models.User, {
      foreignKey: "userId",
      onDelete: "CASCADE",
    });

    Like.belongsTo(models.Post, {
      foreignKey: "postId",
      onDelete: "CASCADE",
    });
  };

  return Like;
};
