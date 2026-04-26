const prisma = require('../config/db');
const axios = require('axios');
const crypto = require('crypto');

exports.initiate = async (req, res) => {
    const { customerPhone, customerName, platform, decoderNumber, amount } = req.body;

    try {
        // Create pending transaction
        const transaction = await prisma.transaction.create({
            data: {
                customerPhone,
                customerName,
                platform,
                decoderNumber,
                amount,
                status: 'PENDING',
            },
        });

        // Call external payment provider (Mock example)
        // Replace with actual provider API details
        try {
            const response = await axios.post(process.env.PAYMENT_PROVIDER_URL, {
                amount,
                currency: 'USD',
                external_reference: transaction.id,
                callback_url: `${process.env.BACKEND_URL}/api/payment/webhook`,
                customer: {
                    phone: customerPhone,
                    name: customerName
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.PAYMENT_API_KEY}`
                }
            });

            // If provider returns an ID immediately, update it
            if (response.data && response.data.id) {
                await prisma.transaction.update({
                    where: { id: transaction.id },
                    data: { providerTransactionId: response.data.id }
                });
            }

            res.status(201).json({
                message: 'Payment initiated',
                transactionId: transaction.id,
                paymentUrl: response.data.payment_url || null
            });
        } catch (apiError) {
            console.error('Payment Provider Error:', apiError.response?.data || apiError.message);
            res.status(502).json({ message: 'Failed to communicate with payment provider' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating transaction' });
    }
};

exports.webhook = async (req, res) => {
    const signature = req.headers['x-payment-signature'];
    const payload = JSON.stringify(req.body);

    // Security Check: Verify signature from provider
    const expectedSignature = crypto
        .createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

    if (signature !== expectedSignature) {
        return res.status(401).json({ message: 'Invalid signature' });
    }

    const { external_reference, status, provider_id } = req.body;

    try {
        if (status === 'SUCCESS' || status === 'PAID') {
            await prisma.transaction.update({
                where: { id: external_reference },
                data: {
                    status: 'PAID',
                    providerTransactionId: provider_id,
                },
            });
        }

        res.status(200).send('Webhook processed');
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ message: 'Error processing webhook' });
    }
};
