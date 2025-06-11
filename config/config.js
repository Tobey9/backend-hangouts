require("dotenv").config();

module.exports = {
  development: {
    username: "root",
    password: "passwordsql123",
    database: "hangouts",
    host: "localhost",
    port: 3307,
    dialect: "mysql",
  },
  test: {
    username: "root",
    password: null,
    database: "database_test",
    host: "127.0.0.1",
    dialect: "mysql",
  },
  production: {
    username: process.env.CLOUD_DATABASE_USERNAME,
    password: process.env.CLOUD_DATABASE_PASSWORD,
    database: process.env.CLOUD_DATABASE_NAME,
    host: process.env.CLOUD_DATABASE_HOST,
    port: process.env.CLOUD_DATABASE_PORT,
    dialect: "postgres",
    dialectOptions: {
      // <--- THIS BLOCK IS CRUCIAL FOR SSL
      ssl: {
        require: true,
        rejectUnauthorized: false, // Often needed for cloud DBs to avoid certificate errors
      },
    },
  },
};
