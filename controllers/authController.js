const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

// Helper to generate tokens
const generateTokens = (adminId) => {
    if (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
        throw new Error('JWT secrets are not configured in environment variables');
    }
    const accessToken = jwt.sign({ id: adminId }, process.env.JWT_SECRET, {
        expiresIn: '15m',
    });
    const refreshToken = jwt.sign({ id: adminId }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: '7d',
    });
    return { accessToken, refreshToken };
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const admin = await prisma.admin.findUnique({ where: { email } });
        if (!admin) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const { accessToken, refreshToken } = generateTokens(admin.id);

        // Save refresh token in DB
        await prisma.refreshToken.create({
            data: {
                token: refreshToken,
                adminId: admin.id,
            },
        });

        // Set cookie
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: isProduction, sameSite: isProduction ? 'none' : 'lax',
            sameSite: isProduction ? 'None' : 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.json({ 
            accessToken,
            admin: {
                name: admin.name,
                email: admin.email
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.refreshToken = async (req, res) => {
    const token = req.cookies.refreshToken;

    if (!token) {
        return res.status(401).json({ message: 'Refresh token required' });
    }

    try {
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token },
            include: { admin: true },
        });

        if (!storedToken || !storedToken.admin) {
            return res.status(403).json({ message: 'Invalid refresh token' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

        // Generate new tokens (Rotation)
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(storedToken.adminId);

        // Update refresh token in DB (Delete old, create new or update)
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
        await prisma.refreshToken.create({
            data: {
                token: newRefreshToken,
                adminId: storedToken.adminId,
            },
        });

        // Set new cookie
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: isProduction, sameSite: isProduction ? 'none' : 'lax',
            sameSite: isProduction ? 'None' : 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({ 
            accessToken,
            admin: {
                name: storedToken.admin.name,
                email: storedToken.admin.email
            }
        });
    } catch (error) {
        console.error(error);
        if (error.name === 'TokenExpiredError') {
            // Cleanup expired token from DB
            await prisma.refreshToken.deleteMany({ where: { token } }).catch(() => { });
        }
        res.status(403).json({ message: 'Invalid or expired refresh token' });
    }
};

exports.logout = async (req, res) => {
    const token = req.cookies.refreshToken;

    try {
        if (token) {
            await prisma.refreshToken.deleteMany({ where: { token } });
        }
        const isProduction = process.env.NODE_ENV === 'production';
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: isProduction, sameSite: isProduction ? 'none' : 'lax',
            sameSite: isProduction ? 'None' : 'Lax',
        });
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
