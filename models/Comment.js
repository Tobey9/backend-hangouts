module.exports = (sequelize, DataTypes) => {
  const Comment = sequelize.define("Comment", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    content: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  // Define associations in associate function
  Comment.associate = (models) => {
    Comment.belongsTo(models.User, {
      foreignKey: "userId",
      as: "author",
      onDelete: "CASCADE",
    });

    Comment.belongsTo(models.Post, {
      foreignKey: "postId",
      as: "post",
      onDelete: "CASCADE",
    });
  };

  return Comment;
};
