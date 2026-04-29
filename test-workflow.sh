#!/bin/bash
# Ali Mobile - Complete Workflow Test Script
# This script tests the full payment → activation → notification flow

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://localhost:5000"
JWT_TOKEN="your_jwt_token_here"  # Replace with actual token
COUNTRY_CODE="+243"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Ali Mobile - Activation Workflow Test Suite${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# ============================================================================
# TEST 1: Payment Initiation with Telegram
# ============================================================================
echo -e "${YELLOW}[TEST 1] Payment Initiation with Telegram${NC}"
echo -e "Testing: Customer sends payment request with Telegram chatId\n"

TELEGRAM_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/payment/initiate" \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "'$COUNTRY_CODE'812345678",
    "customerName": "Jean Dupont",
    "chatId": "37914314",
    "platform": "Telegram",
    "decoderNumber": "TV123456",
    "amount": 5.99,
    "telecom": "MP"
  }')

TELEGRAM_TX_ID=$(echo $TELEGRAM_RESPONSE | grep -o '"transactionId":"[^"]*' | cut -d'"' -f4)

if [ -z "$TELEGRAM_TX_ID" ]; then
  echo -e "${RED}❌ FAILED: Could not parse transaction ID${NC}"
  echo "Response: $TELEGRAM_RESPONSE"
else
  echo -e "${GREEN}✅ SUCCESS: Telegram payment created${NC}"
  echo -e "Transaction ID: ${BLUE}$TELEGRAM_TX_ID${NC}"
  echo -e "Response: $TELEGRAM_RESPONSE\n"
fi

# ============================================================================
# TEST 2: Payment Initiation with WhatsApp
# ============================================================================
echo -e "${YELLOW}[TEST 2] Payment Initiation with WhatsApp${NC}"
echo -e "Testing: Customer sends payment request with WhatsApp phone\n"

WHATSAPP_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/payment/initiate" \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "'$COUNTRY_CODE'991102448",
    "customerName": "Marie Mbala",
    "chatId": "'$COUNTRY_CODE'991102448",
    "platform": "WhatsApp",
    "decoderNumber": "TV654321",
    "amount": 10.50,
    "telecom": "OM"
  }')

WHATSAPP_TX_ID=$(echo $WHATSAPP_RESPONSE | grep -o '"transactionId":"[^"]*' | cut -d'"' -f4)

if [ -z "$WHATSAPP_TX_ID" ]; then
  echo -e "${RED}❌ FAILED: Could not parse transaction ID${NC}"
  echo "Response: $WHATSAPP_RESPONSE"
else
  echo -e "${GREEN}✅ SUCCESS: WhatsApp payment created${NC}"
  echo -e "Transaction ID: ${BLUE}$WHATSAPP_TX_ID${NC}"
  echo -e "Response: $WHATSAPP_RESPONSE\n"
fi

# ============================================================================
# TEST 3: Verify Data in Database
# ============================================================================
echo -e "${YELLOW}[TEST 3] Verify Data Storage in Database${NC}"
echo -e "Checking: chatId and platform are stored correctly\n"

if [ -n "$TELEGRAM_TX_ID" ]; then
  echo -e "PostgreSQL query for verification:"
  echo -e "${BLUE}SELECT id, customerPhone, chatId, platform, status FROM \"Transaction\" WHERE id = '$TELEGRAM_TX_ID';${NC}\n"
  echo -e "Expected output:"
  echo -e "  ${GREEN}chatId${NC}: 37914314"
  echo -e "  ${GREEN}platform${NC}: Telegram"
  echo -e "  ${GREEN}status${NC}: PENDING\n"
fi

# ============================================================================
# TEST 4: Admin Test Notification (Before Payment)
# ============================================================================
echo -e "${YELLOW}[TEST 4] Admin Test Notification - Telegram${NC}"
echo -e "Testing: Admin can test notifications without full flow\n"

TEST_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/admin/test-whatsapp" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "'$COUNTRY_CODE'812345678",
    "name": "Test User",
    "chatId": "37914314",
    "platform": "Telegram"
  }')

if echo "$TEST_RESPONSE" | grep -q "Test notification sent"; then
  echo -e "${GREEN}✅ SUCCESS: Test notification request accepted${NC}"
  echo -e "Response: $TEST_RESPONSE\n"
else
  echo -e "${YELLOW}⚠️ NOTE: Check n8n logs for webhook delivery${NC}"
  echo -e "Response: $TEST_RESPONSE\n"
fi

# ============================================================================
# TEST 5: Manual Payment Confirmation
# ============================================================================
echo -e "${YELLOW}[TEST 5] Payment Confirmation${NC}"
echo -e "Simulating: Payment provider confirms transaction\n"

if [ -n "$TELEGRAM_TX_ID" ]; then
  echo -e "In production, this happens automatically via payment provider webhook."
  echo -e "For testing, manually update in database:"
  echo -e "${BLUE}UPDATE \"Transaction\" SET status='PAID' WHERE id='$TELEGRAM_TX_ID';${NC}\n"
  echo -e "Or call the payment webhook endpoint:"
  echo -e "${BLUE}POST /api/payment/webhook${NC}\n"
fi

# ============================================================================
# TEST 6: Admin Activation (Triggers n8n Notification)
# ============================================================================
echo -e "${YELLOW}[TEST 6] Admin Activation - Triggers n8n Notification${NC}"
echo -e "Testing: Admin activates transaction, n8n sends notification\n"

if [ -n "$TELEGRAM_TX_ID" ]; then
  echo -e "Command to activate Telegram transaction:"
  echo -e "${BLUE}curl -X PUT $BACKEND_URL/api/admin/transactions/$TELEGRAM_TX_ID/activate \\${NC}"
  echo -e "${BLUE}  -H \"Authorization: Bearer $JWT_TOKEN\" \\${NC}"
  echo -e "${BLUE}  -H \"Content-Type: application/json\"${NC}\n"
  
  echo -e "This will:"
  echo -e "  1️⃣  Change transaction status to ACTIVATED"
  echo -e "  2️⃣  Send webhook to n8n_activation_webhook_url"
  echo -e "  3️⃣  n8n checks platform == 'Telegram'"
  echo -e "  4️⃣  n8n sends Telegram message to chatId: 37914314"
  echo -e "  5️⃣  User receives: ✅ Confirmation d'Activation message\n"
fi

# ============================================================================
# TEST 7: WhatsApp Activation
# ============================================================================
echo -e "${YELLOW}[TEST 7] WhatsApp Activation - Full Flow${NC}"
echo -e "Complete workflow for WhatsApp\n"

if [ -n "$WHATSAPP_TX_ID" ]; then
  echo -e "Step 1: Manually set payment status to PAID"
  echo -e "${BLUE}UPDATE \"Transaction\" SET status='PAID' WHERE id='$WHATSAPP_TX_ID';${NC}\n"
  
  echo -e "Step 2: Activate transaction (triggers WhatsApp notification)"
  echo -e "${BLUE}curl -X PUT $BACKEND_URL/api/admin/transactions/$WHATSAPP_TX_ID/activate \\${NC}"
  echo -e "${BLUE}  -H \"Authorization: Bearer $JWT_TOKEN\" \\${NC}"
  echo -e "${BLUE}  -H \"Content-Type: application/json\"${NC}\n"
  
  echo -e "Expected flow:"
  echo -e "  1️⃣  n8n receives: platform='WhatsApp', chatId='$COUNTRY_CODE'991102448"
  echo -e "  2️⃣  If condition: platform == 'WhatsApp' → TRUE"
  echo -e "  3️⃣  Routes to WhatsApp node"
  echo -e "  4️⃣  Sends message to phone: $COUNTRY_CODE'991102448"
  echo -e "  5️⃣  User (Marie Mbala) receives confirmation on WhatsApp\n"
fi

# ============================================================================
# TEST 8: Get Transaction List
# ============================================================================
echo -e "${YELLOW}[TEST 8] Retrieve All Transactions${NC}"
echo -e "Testing: Get admin dashboard data\n"

echo -e "Command:"
echo -e "${BLUE}curl -X GET $BACKEND_URL/api/admin/transactions \\${NC}"
echo -e "${BLUE}  -H \"Authorization: Bearer $JWT_TOKEN\"${NC}\n"

TRANSACTIONS=$(curl -s -X GET "$BACKEND_URL/api/admin/transactions" \
  -H "Authorization: Bearer $JWT_TOKEN")

if echo "$TRANSACTIONS" | grep -q "customerPhone"; then
  echo -e "${GREEN}✅ SUCCESS: Transactions retrieved${NC}\n"
else
  echo -e "${YELLOW}⚠️ Could not retrieve transactions${NC}\n"
fi

# ============================================================================
# TEST 9: Get Statistics
# ============================================================================
echo -e "${YELLOW}[TEST 9] Get Dashboard Statistics${NC}"
echo -e "Testing: Admin dashboard stats\n"

echo -e "Command:"
echo -e "${BLUE}curl -X GET $BACKEND_URL/api/admin/stats \\${NC}"
echo -e "${BLUE}  -H \"Authorization: Bearer $JWT_TOKEN\"${NC}\n"

STATS=$(curl -s -X GET "$BACKEND_URL/api/admin/stats" \
  -H "Authorization: Bearer $JWT_TOKEN")

if echo "$STATS" | grep -q "totalTransactions"; then
  echo -e "${GREEN}✅ SUCCESS: Statistics retrieved${NC}"
  echo "Stats should include:"
  echo "  - totalTransactions"
  echo "  - paidTransactions"
  echo "  - activatedTransactions"
  echo "  - platformBreakdown"
  echo "  - dailyRevenue"
else
  echo -e "${YELLOW}⚠️ Could not retrieve statistics${NC}"
fi

# ============================================================================
# SUMMARY
# ============================================================================
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  TEST SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

if [ -n "$TELEGRAM_TX_ID" ] && [ -n "$WHATSAPP_TX_ID" ]; then
  echo -e "${GREEN}✅ Both payment initiations successful!${NC}\n"
  echo -e "Next Steps:"
  echo -e "  1. Set transaction status to PAID in database"
  echo -e "  2. Call activate endpoint for each transaction"
  echo -e "  3. Check n8n logs for webhook execution"
  echo -e "  4. Verify notifications received on WhatsApp/Telegram\n"
  
  echo -e "Transaction IDs for reference:"
  echo -e "  Telegram: ${BLUE}$TELEGRAM_TX_ID${NC}"
  echo -e "  WhatsApp: ${BLUE}$WHATSAPP_TX_ID${NC}\n"
else
  echo -e "${RED}❌ Payment initiation failed${NC}"
  echo -e "Check backend logs and verify:"
  echo -e "  - Backend is running on $BACKEND_URL"
  echo -e "  - Database connection is working"
  echo -e "  - Prisma schema is up to date\n"
fi

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
