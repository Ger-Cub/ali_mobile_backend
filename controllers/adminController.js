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

exports.confirmTestPayment = async (req, res) => {
    const { id } = req.params;

    try {
        const transaction = await prisma.transaction.findUnique({ where: { id } });

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        if (!transaction.isTest) {
            return res.status(400).json({ message: 'Only test transactions can be manually confirmed here' });
        }

        if (transaction.status !== 'PENDING') {
            return res.status(400).json({ message: 'Transaction is already processed' });
        }

        const updatedTransaction = await prisma.transaction.update({
            where: { id },
            data: { status: 'PAID' },
        });

        res.json({ message: 'Test payment confirmed manually', transaction: updatedTransaction });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error confirming test payment' });
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
                chatId: updatedTransaction.chatId,
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

exports.confirmActivation = async (req, res) => {
    const { transactionId, status, customerPhone, customerName, chatId, platform, decoderNumber } = req.body;

    if (!transactionId || !status) {
        return res.status(400).json({ message: 'Missing required fields: transactionId and status' });
    }

    try {
        const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        const updatedTransaction = await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                status: status === 'ACTIVATED' ? 'ACTIVATED' : transaction.status,
                customerPhone: customerPhone ?? transaction.customerPhone,
                customerName: customerName ?? transaction.customerName,
                chatId: chatId ?? transaction.chatId,
                platform: platform ?? transaction.platform,
                decoderNumber: decoderNumber ?? transaction.decoderNumber,
            },
        });

        res.status(200).json({ message: 'Activation confirmed', transaction: updatedTransaction });
    } catch (error) {
        console.error('Error confirming activation:', error);
        res.status(500).json({ message: 'Error confirming activation' });
    }
};

exports.getStats = async (req, res) => {
    try {
        const totalTransactions = await prisma.transaction.count();
        const paidTransactions = await prisma.transaction.count({ where: { status: 'PAID' } });
        const activatedTransactions = await prisma.transaction.count({ where: { status: 'ACTIVATED' } });
        const pendingTransactions = await prisma.transaction.count({ where: { status: 'PENDING' } });

        const totalRevenueResult = await prisma.transaction.aggregate({
            where: {
                OR: [{ status: 'PAID' }, { status: 'ACTIVATED' }]
            },
            _sum: {
                amount: true
            }
        });

        // Platform Breakdown
        const platformBreakdown = await prisma.transaction.groupBy({
            by: ['platform'],
            _count: {
                id: true
            }
        });

        // Daily Revenue for the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const dailyRevenueRaw = await prisma.$queryRaw`
            SELECT 
                DATE_TRUNC('day', "createdAt") as date,
                SUM(amount) as revenue
            FROM "Transaction"
            WHERE status IN ('PAID', 'ACTIVATED') AND "createdAt" >= ${sevenDaysAgo}
            GROUP BY date
            ORDER BY date ASC
        `;

        const dailyRevenue = dailyRevenueRaw.map(item => ({
            date: item.date.toISOString().split('T')[0],
            revenue: Number(item.revenue) || 0
        }));

        res.json({
            totalTransactions,
            paidTransactions,
            activatedTransactions,
            pendingTransactions,
            totalRevenue: totalRevenueResult._sum.amount || 0,
            activationRate: totalTransactions > 0 ? (activatedTransactions / totalTransactions) * 100 : 0,
            platformBreakdown,
            dailyRevenue
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching stats' });
    }
};

exports.testWhatsApp = async (req, res) => {
    const { phone, name, chatId, platform } = req.body;

    if (!phone && !chatId) {
        return res.status(400).json({ message: 'Phone number or ChatId is required' });
    }

    try {
        const response = await axios.post(process.env.N8N_ACTIVATION_WEBHOOK_URL, {
            transactionId: "TEST-12345",
            customerPhone: phone,
            customerName: name || "Utilisateur Test",
            chatId: chatId || phone,
            platform: platform || "WhatsApp",
            decoderNumber: "0000000000",
            status: 'TEST_NOTIFICATION'
        });

        res.json({ 
            message: 'Test notification sent to n8n', 
            n8nResponse: response.data 
        });
    } catch (error) {
        console.error('Failed to notify n8n:', error.message);
        res.status(500).json({ 
            message: 'Failed to send test notification', 
            error: error.message 
        });
    }
};
