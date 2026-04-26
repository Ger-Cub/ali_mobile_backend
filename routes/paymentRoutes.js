const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const rateLimit = require('express-rate-limit');

const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
});

router.post('/initiate', paymentController.initiate);
router.post('/webhook', webhookLimiter, paymentController.webhook);
router.get('/status/:transactionId', paymentController.getTransactionStatus);

module.exports = router;
