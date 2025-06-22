const express = require('express');
const chatController = require('../../controllers/admin/chatController');
module.exports = (app) => {
  const router = express.Router();
  const verifyToken = app.get('verifyToken');

  router.get('/', verifyToken, chatController.getAllChats);

  return router;
};
