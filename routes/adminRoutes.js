const express = require('express');
const authRoutes = require('./admin/auth');
const createChatRoutes = require('./admin/chats');
const createLearnedRoutes = require('./admin/learned');
const createFeedbackRoutes = require('./admin/feedback');
module.exports = (app) => {
  const router = express.Router();
  router.use('/admin/auth', authRoutes);
  router.use('/admin/chats', createChatRoutes(app));
  router.use('/admin/learned', createLearnedRoutes(app));
  router.use('/admin/feedback', createFeedbackRoutes(app));

  return router;
};
