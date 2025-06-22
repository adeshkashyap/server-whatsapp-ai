const express = require('express');
const feedbackController = require('../../controllers/admin/feedbackController');

module.exports = (app) => {
  const router = express.Router();
  const verifyToken = app.get('verifyToken');

  router.get('/', verifyToken, feedbackController.getFeedback);

  return router;
};
