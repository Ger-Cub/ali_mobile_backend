const express = require('express');
const router = express.Router();
const passport = require('passport');
const adminController = require('../controllers/adminController');

// Middleware to protect routes
const requireAuth = passport.authenticate('jwt', { session: false });

router.get('/transactions', requireAuth, adminController.getTransactions);
router.get('/stats', requireAuth, adminController.getStats);
router.patch('/transactions/:id/activate', requireAuth, adminController.activateTransaction);

module.exports = router;
