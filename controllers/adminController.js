const prisma = require('../config/db');
const axios = require('axios');

exports.getTransactions = async (req, res) => {
    try {
        const transactions = await prisma.transaction.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching transactions' });
    }
};

exports.activateTransaction = async (req, res) => {
    const { id } = req.params;

    try {
        const transaction = await prisma.transaction.findUnique({ where: { id } });

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        if (transaction.status !== 'PAID') {
            return res.status(400).json({ message: 'Only PAID transactions can be activated' });
        }

        // Update status to ACTIVATED
        const updatedTransaction = await prisma.transaction.update({
            where: { id },
            data: { status: 'ACTIVATED' },
        });

        // Notify n8n for WhatsApp/Telegram notification
        try {
            await axios.post(process.env.N8N_ACTIVATION_WEBHOOK_URL, {
                transactionId: updatedTransaction.id,
                customerPhone: updatedTransaction.customerPhone,
                customerName: updatedTransaction.customerName,
                platform: updatedTransaction.platform,
                decoderNumber: updatedTransaction.decoderNumber,
                status: 'ACTIVATED'
            });
        } catch (n8nError) {
            console.error('Failed to notify n8n:', n8nError.message);
            // We don't rollback the activation, but we log the error
        }

        res.json({ message: 'Transaction activated and client notified', transaction: updatedTransaction });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error activating transaction' });
    }
};

exports.getStats = async (req, res) => {
    try {
        const totalTransactions = await prisma.transaction.count();
        const paidTransactions = await prisma.transaction.count({ where: { status: 'PAID' } });
        const activatedTransactions = await prisma.transaction.count({ where: { status: 'ACTIVATED' } });
        const pendingTransactions = await prisma.transaction.count({ where: { status: 'PENDING' } });

        const totalRevenue = await prisma.transaction.aggregate({
            where: {
                OR: [{ status: 'PAID' }, { status: 'ACTIVATED' }]
            },
            _sum: {
                amount: true
            }
        });

        res.json({
            totalTransactions,
            paidTransactions,
            activatedTransactions,
            pendingTransactions,
            totalRevenue: totalRevenue._sum.amount || 0,
            activationRate: totalTransactions > 0 ? (activatedTransactions / totalTransactions) * 100 : 0
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching stats' });
    }
};
