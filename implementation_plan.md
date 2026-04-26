# Implementation Plan - Backend Admin & Payment API

This plan outlines the steps to build a production-ready Node.js backend for a TV subscription management system and connect it to a Render PostgreSQL database.

## 1. Project Initialization

- [x] Initialize Node.js project (`npm init -y`)
- [x] Install dependencies
- [x] Initialize Prisma (`npx prisma init`)

## 2. Database Schema

- [x] Define the Prisma schema with `Admin`, `RefreshToken`, and `Transaction` models
- [x] Generate the Prisma client

## 3. Configuration & Security

- [x] Set up Passport.js configuration
- [x] Set up Express server with Helmet, CORS, and Rate Limiting
- [x] Set up Error handling middleware

## 4. Authentication Logic

- [x] Implement `authController.js` (Login, Refresh Token, Logout)
- [x] Implement Auth routes

## 5. Payment & Webhook Logic

- [x] Implement `paymentController.js` (Initiate, Webhook)
- [x] Implement Payment routes

## 6. Admin Management

- [x] Implement `adminController.js` (List transactions, Activate transaction)
- [x] Implement Admin routes

## 7. Connecting to Render Database

- [ ] Update `.env` with the Render **External Database URL**.
- [ ] Push the schema to the remote database using Prisma.
- [ ] Seed the remote database to create the initial admin user.

## 8. Final Verification

- [ ] Start the server and verify the connection.
