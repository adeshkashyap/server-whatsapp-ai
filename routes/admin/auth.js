const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin/authController');
router.post('/register', adminController.register);
router.post('/login', adminController.login);
router.post('/refresh-token', adminController.refreshAccessToken);
router.post('/logout', adminController.logout);
router.get('/check-session', adminController.checkSession);

module.exports = router;
