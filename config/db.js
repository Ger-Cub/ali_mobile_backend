require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const url = new URL(process.env.DATABASE_URL);
const pool = new Pool({
    user: url.username,
    password: url.password,
    host: url.hostname,
    port: url.port || 5432,
    database: url.pathname.slice(1),
    ssl: {
        rejectUnauthorized: false
    }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
