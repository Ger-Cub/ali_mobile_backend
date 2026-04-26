const prisma = require('../config/db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function main() {
    const email = 'admin@alimobile.com';
    const password = 'AdminPassword123!'; // Change this!

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.admin.upsert({
        where: { email },
        update: { password: hashedPassword },
        create: {
            email,
            password: hashedPassword,
        },
    });

    console.log(`Admin created/updated: ${admin.email}`);
}

main()
    .catch((e) => {
        console.error('Seed Error:', JSON.stringify(e, null, 2));
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
