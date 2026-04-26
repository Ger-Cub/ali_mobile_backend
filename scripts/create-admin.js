const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function createAdmin(email, password, name) {
    if (!email || !password || !name) {
        console.error('Usage: node scripts/create-admin.js <email> <password> <name>');
        process.exit(1);
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const admin = await prisma.admin.create({
            data: {
                email,
                password: hashedPassword,
                name,
            },
        });
        console.log(`Successfully created admin: ${admin.name} (${admin.email})`);
    } catch (error) {
        if (error.code === 'P2002') {
            console.error('Error: An admin with this email already exists.');
        } else {
            console.error('Error creating admin:', error);
        }
    } finally {
        await prisma.$disconnect();
    }
}

const [email, password, name] = process.argv.slice(2);
createAdmin(email, password, name);
