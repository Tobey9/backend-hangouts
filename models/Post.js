module.exports = (sequelize, DataTypes) => {
  const Post = sequelize.define("Post", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    image_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  });

  Post.associate = (models) => {
    Post.belongsTo(models.User, {
      foreignKey: "userId",
      onDelete: "CASCADE",
    });

    Post.hasMany(models.Comment, {
      foreignKey: "postId",
      onDelete: "CASCADE",
      hooks: true,
    });

    Post.hasMany(models.Like, {
      foreignKey: "postId",
      onDelete: "CASCADE",
      hooks: true,
    });
  };

  return Post;
};
