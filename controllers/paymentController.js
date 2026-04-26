const prisma = require('../config/db');
const axios = require('axios');
const crypto = require('crypto');

exports.initiate = async (req, res) => {
    const { customerPhone, customerName, platform, decoderNumber, amount, telecom = 'MP' } = req.body;

    try {
        // Validate required fields
        if (!customerPhone || !amount || !decoderNumber) {
            return res.status(400).json({ message: 'Missing required fields: customerPhone, amount, decoderNumber' });
        }

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

        // Call SerdiPay API
        try {
            const response = await axios.post(process.env.PAYMENT_PROVIDER_URL, {
                clientPhone: customerPhone,
                amount,
                currency: 'USD',
                telecom: telecom,
                callback_url: `${process.env.BACKEND_URL}/api/payment/webhook`
            }, {
                headers: {
                    'api_key': process.env.PAYMENT_API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            // Store provider transaction ID if returned
            if (response.data && response.data.id) {
                await prisma.transaction.update({
                    where: { id: transaction.id },
                    data: { providerTransactionId: response.data.id }
                });
            }

            res.status(201).json({
                message: 'Payment initiated successfully',
                transactionId: transaction.id,
                providerResponse: response.data
            });
        } catch (apiError) {
            console.error('SerdiPay API Error:', apiError.response?.data || apiError.message);
            
            // Update transaction status to failed
            await prisma.transaction.update({
                where: { id: transaction.id },
                data: { status: 'FAILED' }
            });

            res.status(502).json({ 
                message: 'Failed to initiate payment with provider',
                error: apiError.response?.data || apiError.message
            });
        }

    } catch (error) {
        console.error('Error creating transaction:', error);
        res.status(500).json({ message: 'Error creating transaction' });
    }
};

exports.webhook = async (req, res) => {
    try {
        const { transactionId, status, paymentId } = req.body;

        // Validate webhook payload
        if (!transactionId || !status) {
            return res.status(400).json({ message: 'Missing required webhook fields' });
        }

        // Update transaction based on payment status
        let transactionStatus = 'PENDING';
        if (status === 'SUCCESS' || status === 'PAID' || status === 'COMPLETED') {
            transactionStatus = 'PAID';
        }

        await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                status: transactionStatus,
                providerTransactionId: paymentId || undefined,
            },
        });

        console.log(`Payment webhook processed for transaction: ${transactionId}, status: ${transactionStatus}`);
        res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ message: 'Error processing webhook' });
    }
};

exports.getTransactionStatus = async (req, res) => {
    try {
        const { transactionId } = req.params;

        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId }
        });

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        res.status(200).json(transaction);
    } catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(500).json({ message: 'Error fetching transaction' });
    }
};
