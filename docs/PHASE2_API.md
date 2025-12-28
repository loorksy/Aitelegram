# Phase 2 API Reference - Credits, Payments & Admin

## Base URL
```
http://localhost:3010
```

## Authentication

### Get Token (by Telegram ID)
```bash
curl -X POST http://localhost:3010/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"telegramId": "owner-admin-001"}'
```
Response:
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "user": { "id": "...", "role": "OWNER", "status": "APPROVED" }
}
```

### Refresh Token
```bash
curl -X POST http://localhost:3010/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "eyJhbGci..."}'
```

### Get Current User
```bash
curl http://localhost:3010/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## Credits System

### Get Balance
```bash
curl http://localhost:3010/api/credits/balance \
  -H "Authorization: Bearer $TOKEN"
```
Response:
```json
{
  "balance": 450,
  "dailyUsed": 10,
  "dailyLimit": 100,
  "dailyRemaining": 90,
  "status": "APPROVED",
  "pipelineCost": 10
}
```

### Get Credit History
```bash
curl "http://localhost:3010/api/credits/history?limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Payments (MOCK Mode)

### Get Payment Config
```bash
curl http://localhost:3010/api/payments/config
```
Response:
```json
{
  "mockMode": true,
  "starsToCreditsRate": 10,
  "packages": [
    { "stars": 10, "credits": 100, "label": "100 رصيد" },
    { "stars": 25, "credits": 250, "label": "250 رصيد" }
  ]
}
```

### Create Payment
```bash
curl -X POST http://localhost:3010/api/payments/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"starsAmount": 25}'
```
Response:
```json
{
  "paymentId": "uuid",
  "invoiceUrl": "/api/payments/uuid/mock-pay",
  "mockMode": true,
  "creditsToReceive": 250
}
```

### Complete Mock Payment
```bash
curl -X POST "http://localhost:3010/api/payments/$PAYMENT_ID/mock-pay" \
  -H "Authorization: Bearer $TOKEN"
```
Response:
```json
{
  "success": true,
  "creditsAdded": 250,
  "message": "Payment completed successfully (MOCK)"
}
```

### Get Payment History
```bash
curl http://localhost:3010/api/payments/history \
  -H "Authorization: Bearer $TOKEN"
```

---

## Admin API (Requires OWNER or ADMIN role)

### Get System Stats
```bash
curl http://localhost:3010/api/admin/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### List Users
```bash
# All users
curl "http://localhost:3010/api/admin/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Filter by status
curl "http://localhost:3010/api/admin/users?status=PENDING_APPROVAL" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Search
curl "http://localhost:3010/api/admin/users?search=john" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Get User by ID
```bash
curl "http://localhost:3010/api/admin/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Approve User
```bash
curl -X POST "http://localhost:3010/api/admin/users/$USER_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"initialCredits": 100}'
```

### Deny User
```bash
curl -X POST "http://localhost:3010/api/admin/users/$USER_ID/deny" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Spam account"}'
```

### Set User Credits
```bash
curl -X POST "http://localhost:3010/api/admin/users/$USER_ID/set-credits" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"credits": 500, "reason": "Monthly bonus"}'
```

### Set Daily Limit
```bash
curl -X POST "http://localhost:3010/api/admin/users/$USER_ID/set-daily-limit" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dailyLimit": 200}'
```

### Set User Role (OWNER only)
```bash
curl -X POST "http://localhost:3010/api/admin/users/$USER_ID/set-role" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "ADMIN"}'
```

### List Payments
```bash
curl "http://localhost:3010/api/admin/payments" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Filter by status
curl "http://localhost:3010/api/admin/payments?status=PAID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### List Agent Runs
```bash
curl "http://localhost:3010/api/admin/runs" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Filter by user
curl "http://localhost:3010/api/admin/runs?userId=$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Filter by status
curl "http://localhost:3010/api/admin/runs?status=FAILED" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Roles
- `OWNER`: Full access (can change roles, full admin)
- `ADMIN`: Admin access (approve/deny users, manage credits)
- `USER`: Regular user (can create bots if approved)

## User Statuses
- `PENDING_APPROVAL`: New user, cannot run pipelines
- `APPROVED`: Can run pipelines (if has credits)
- `DENIED`: Access denied
- `SUSPENDED`: Temporarily suspended

---

## Testing Flow

```bash
# 1. Get owner token
OWNER_TOKEN=$(curl -s -X POST http://localhost:3010/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"telegramId": "owner-admin-001"}' | jq -r '.accessToken')

# 2. List pending users
curl -s "http://localhost:3010/api/admin/users?status=PENDING_APPROVAL" \
  -H "Authorization: Bearer $OWNER_TOKEN"

# 3. Approve a user
curl -s -X POST "http://localhost:3010/api/admin/users/USER_ID/approve" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"initialCredits": 100}'

# 4. Get user token
USER_TOKEN=$(curl -s -X POST http://localhost:3010/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"telegramId": "USER_TELEGRAM_ID"}' | jq -r '.accessToken')

# 5. Check balance
curl -s http://localhost:3010/api/credits/balance \
  -H "Authorization: Bearer $USER_TOKEN"

# 6. Create and complete payment
PAYMENT_ID=$(curl -s -X POST http://localhost:3010/api/payments/create \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"starsAmount": 25}' | jq -r '.paymentId')

curl -s -X POST "http://localhost:3010/api/payments/$PAYMENT_ID/mock-pay" \
  -H "Authorization: Bearer $USER_TOKEN"

# 7. Verify new balance
curl -s http://localhost:3010/api/credits/balance \
  -H "Authorization: Bearer $USER_TOKEN"
```
