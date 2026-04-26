const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const rateLimit = require('express-rate-limit');

const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100, // Still reasonably high but prevents flooding
});

router.post('/initiate', paymentController.initiate);
router.post('/webhook', webhookLimiter, paymentController.webhook);

module.exports = router;
