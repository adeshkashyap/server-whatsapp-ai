const express = require('express');
const learnedController = require('../../controllers/admin/learnedController');

module.exports = (app) => {
  const router = express.Router();
  const verifyToken = app.get('verifyToken');

  router.get('/', verifyToken, learnedController.getLearnedResponses);

  return router;
};
