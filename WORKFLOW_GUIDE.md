# Ali Mobile Activation Workflow Guide

## Overview
This guide explains the complete workflow for handling payments and sending activation notifications via WhatsApp or Telegram.

## Complete Flow

```
1. User initiates payment via n8n_payment_workflow
2. Backend stores transaction with chatId & platform
3. Admin triggers activation via adminController
4. n8n activation workflow routes message to correct platform
```

---

## 1. Payment Initiation Flow

### Step 1.1: User sends payment request via n8n_payment_workflow
**Endpoint:** `POST http://localhost:5000/api/payment/initiate`

**Required Fields:**
- `phone`: Customer phone number (e.g., `+243812345678`)
- `userName`: Customer name
- `chatID`: Platform-specific identifier
  - **WhatsApp**: Phone number with country code
  - **Telegram**: Numeric chat ID
- `decoderNumber`: TV decoder number
- `amount`: Payment amount in USD
- `telecom`: Payment operator (`MP`, `OM`, `AM`, `AF`)
- `platform`: Either `"WhatsApp"` or `"Telegram"`

**Example Request (from n8n):**
```json
{
  "customerPhone": "+243812345678",
  "customerName": "Jean Dupont",
  "chatId": "37914314",
  "platform": "Telegram",
  "decoderNumber": "TV123456",
  "amount": 5.99,
  "telecom": "MP"
}
```

### Step 1.2: Backend processes payment
- Creates transaction in database with `PENDING` status
- Stores `chatId` and `platform` for later notification
- Calls payment provider (SerdiPay)
- Returns transaction ID

**Response:**
```json
{
  "message": "Payment initiated successfully",
  "transactionId": "550e8400-e29b-41d4-a716-446655440000",
  "providerResponse": {...}
}
```

---

## 2. Transaction Status Update

### Payment Webhook (Auto)
When payment provider confirms payment:
- Transaction status changes to `PAID`

### Admin Activation

**Endpoint:** `PUT http://localhost:5000/api/admin/transactions/:id/activate`

**Example:**
```bash
curl -X PUT http://localhost:5000/api/admin/transactions/550e8400-e29b-41d4-a716-446655440000/activate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

---

## 3. Activation Notification Flow

### Step 3.1: Admin triggers activation
Admin sends request to activate a PAID transaction

### Step 3.2: Backend updates status and notifies n8n
Transaction status changes to `ACTIVATED`, then backend sends webhook to n8n:

```json
{
  "transactionId": "550e8400-e29b-41d4-a716-446655440000",
  "customerPhone": "+243812345678",
  "customerName": "Jean Dupont",
  "chatId": "37914314",
  "platform": "Telegram",
  "decoderNumber": "TV123456",
  "status": "ACTIVATED"
}
```

**Webhook URL:** `$N8N_ACTIVATION_WEBHOOK_URL` (from .env)

### Step 3.3: n8n processes activation

**n8n_activation_workflow.json Flow:**

1. **Webhook receives data** → Validates incoming payload
2. **Process Activation Data** → Extracts all fields including `chatId`
3. **If (Platform Check)** → Routes based on platform:
   - ✅ **TRUE** (platform == "WhatsApp") → Send WhatsApp message
   - ❌ **FALSE** → Send Telegram message
4. **Send Message** → Sends platform-specific notification
5. **HTTP Request** → Confirms completion to backend

### Step 3.4: Message Templates

#### WhatsApp Message
```
✅ *Confirmation d'Activation*

Bonjour {{ $json.customerName }},

Votre abonnement pour le décodeur *{{ $json.decoderNumber }}* 
a été activé avec succès !

Montant: {{ $json.amount }} USD
ID Transaction: {{ $json.transactionId }}

Merci d'avoir choisi Ali Mobile !
```

#### Telegram Message
```
✅ *Confirmation d'Activation*

Bonjour {{ $json.customerName }},

Votre abonnement pour le décodeur *{{ $json.decoderNumber }}* 
a été activé avec succès !

Montant: {{ $json.amount }} USD
ID Transaction: {{ $json.transactionId }}

Merci d'avoir choisi Ali Mobile !
```

---

## Testing Guide

### Test 1: Payment Initiation with Telegram

```bash
curl -X POST http://localhost:5000/api/payment/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "+243812345678",
    "customerName": "Test User",
    "chatId": "37914314",
    "platform": "Telegram",
    "decoderNumber": "TV001",
    "amount": 5.99,
    "telecom": "MP"
  }'
```

**Expected Response:**
```json
{
  "message": "Payment initiated successfully",
  "transactionId": "abc-123-def",
  "providerResponse": {...}
}
```

**Verify in Database:**
```sql
SELECT id, customerPhone, chatId, platform, status 
FROM "Transaction" 
WHERE id = 'abc-123-def';
```

Should show:
- `chatId`: `37914314`
- `platform`: `Telegram`
- `status`: `PENDING`

---

### Test 2: Payment Confirmation

Simulate payment provider webhook (or manually update in DB for testing):

```bash
# Update transaction status to PAID (for testing)
curl -X POST http://localhost:5000/api/payment/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "abc-123-def",
    "status": "PAID"
  }'
```

---

### Test 3: Admin Activation with Notification

```bash
curl -X PUT http://localhost:5000/api/admin/transactions/abc-123-def/activate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Flow After This:**
1. ✅ Transaction status → `ACTIVATED`
2. ✅ Backend sends webhook to n8n_activation_webhook_url
3. ✅ n8n checks platform field
4. ✅ If platform == "Telegram", sends Telegram message to chatId `37914314`
5. ✅ User receives confirmation message on Telegram

---

### Test 4: Test Notification Endpoint (Without Payment)

```bash
curl -X POST http://localhost:5000/api/admin/test-whatsapp \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+243812345678",
    "name": "Test User",
    "chatId": "37914314",
    "platform": "Telegram"
  }'
```

---

## Database Schema

### Transaction Table
```sql
CREATE TABLE "Transaction" (
  id                    UUID PRIMARY KEY,
  customerPhone         VARCHAR NOT NULL,
  customerName          VARCHAR,
  chatId                VARCHAR,           -- CRITICAL: Stores platform-specific ID
  platform              VARCHAR NOT NULL,  -- "WhatsApp" or "Telegram"
  decoderNumber         VARCHAR NOT NULL,
  amount                DECIMAL NOT NULL,
  status                VARCHAR DEFAULT 'PENDING',
  providerTransactionId VARCHAR UNIQUE,
  createdAt             TIMESTAMP DEFAULT NOW(),
  updatedAt             TIMESTAMP DEFAULT NOW()
);
```

---

## Environment Variables Required

```env
# Payment Provider
PAYMENT_PROVIDER_URL=https://api.serdipay.com/...
PAYMENT_API_KEY=your_api_key

# n8n Webhooks
N8N_PAYMENT_WEBHOOK_URL=https://your-n8n-instance/webhook/...
N8N_ACTIVATION_WEBHOOK_URL=https://your-n8n-instance/webhook/...

# Backend
BACKEND_URL=http://localhost:5000
DATABASE_URL=postgresql://...

# n8n Credentials (configured in n8n UI)
# - WhatsApp account
# - Telegram bot token
```

---

## Troubleshooting

### ❌ ChatId not storing in database
- **Check:** `paymentController.js` includes `chatId` in request body
- **Check:** Prisma schema has `chatId String?` field
- **Check:** Database migration applied successfully

### ❌ Notification sent to wrong platform
- **Check:** `platform` field is correct: `"WhatsApp"` or `"Telegram"`
- **Check:** n8n If condition: `{{ $json.platform }} equals "WhatsApp"` (case-sensitive!)
- **Check:** n8n workflow connections are correct

### ❌ Message not received
- **Check:** n8n WhatsApp/Telegram credentials are valid
- **Check:** `chatId` format is correct for platform:
  - WhatsApp: Phone number with country code
  - Telegram: Numeric chat ID
- **Check:** n8n webhook URL is reachable
- **Check:** n8n logs for errors

### ❌ Transaction not found during activation
- **Check:** Transaction ID is correct
- **Check:** Transaction status is `PAID` before activation
- **Check:** Check database for transaction with that ID

---

## API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/payment/initiate` | Start payment process (stores chatId & platform) |
| `PUT` | `/api/admin/transactions/:id/activate` | Trigger activation & notification |
| `POST` | `/api/admin/test-whatsapp` | Test notification without full flow |
| `GET` | `/api/admin/transactions` | View all transactions |
| `GET` | `/api/admin/stats` | Get dashboard statistics |

---

## Key Points

✅ **chatId is stored during payment initiation** - Required field in payment request
✅ **Platform is stored during payment initiation** - Determines WhatsApp or Telegram
✅ **n8n routes based on platform** - If condition checks platform field
✅ **Separate message templates** - Each platform gets appropriate formatting
✅ **Both platforms receive same data** - chatId, customerName, decoderNumber, transactionId, amount

---

## Next Steps

1. Set up n8n webhook URLs in backend `.env`
2. Configure WhatsApp and Telegram credentials in n8n
3. Test payment flow end-to-end
4. Monitor logs for any errors
5. Adjust message templates as needed
