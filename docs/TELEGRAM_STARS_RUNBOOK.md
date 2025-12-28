# Telegram Stars Payment Runbook

## Overview

AI Agent Factory uses **Telegram Stars** as the exclusive payment method for purchasing credits. Stars are Telegram's digital currency for in-app purchases.

## Configuration

### Environment Variables

```bash
# Required for REAL mode
MASTER_BOT_TOKEN=<your-telegram-bot-token>
PAYMENT_MODE=REAL  # Set to REAL for production

# Optional configuration
STARS_TO_CREDITS_RATE=10  # 1 Star = 10 Credits
```

### Credit Packages

| Package ID | Stars | Credits | Price (approx.) |
|------------|-------|---------|-----------------|
| pkg_100    | 10    | 100     | ~$0.20          |
| pkg_250    | 25    | 250     | ~$0.50          |
| pkg_500    | 50    | 500     | ~$1.00          |
| pkg_1000   | 100   | 1000    | ~$2.00          |

## How It Works

### 1. Invoice Creation

When a user requests credits:
1. Backend creates a `Payment` record with status `PENDING`
2. Backend calls Telegram's `createInvoiceLink` API
3. User receives a payment link

### 2. Pre-Checkout Query

When user clicks "Pay":
1. Telegram sends `pre_checkout_query` to your webhook
2. Backend validates the payment (exists, correct amount, not processed)
3. Backend calls `answerPreCheckoutQuery(ok: true)` to approve

### 3. Successful Payment

After payment completes:
1. Telegram sends `successful_payment` message to webhook
2. Backend updates Payment status to `PAID`
3. Backend adds credits to user's balance
4. Audit log is created

## API Endpoints

### Public Endpoints

- `GET /api/payments/config` - Get packages and rate info
- `POST /api/payments/create` - Create new payment (requires auth)
- `GET /api/payments/history` - User's payment history (requires auth)

### Admin Endpoints

- `GET /api/payments/admin/list` - All payments
- `GET /api/payments/admin/stats` - Payment statistics
- `GET /api/payments/admin/:id` - Payment details

### Webhook Endpoints

- `POST /master/webhook` - Master bot webhook handler

## Webhook Setup

### Setting Up the Webhook

```bash
# Set webhook URL
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://api.lork.cloud/master/webhook"}'

# Verify webhook
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

### Webhook Update Types

Your webhook must handle:
- `pre_checkout_query` - Payment validation
- `message.successful_payment` - Payment completion

## Revenue & Withdrawals

### How Stars Revenue Works

1. **User pays Stars** → Stars are deducted from user's Telegram balance
2. **Stars credited to bot** → You can see balance in @BotFather
3. **Withdrawal** → Convert Stars to TON or other methods via Telegram's Fragment

### Checking Balance

```bash
# Get bot's Stars balance
curl "https://api.telegram.org/bot<TOKEN>/getStarTransactions"
```

### Withdrawal Process

1. Open @BotFather
2. Select your bot
3. Go to "Stars Balance"
4. Choose withdrawal method (Fragment/TON)

## Testing

### Mock Mode (Development)

Set `PAYMENT_MODE=MOCK` for development. This bypasses Telegram API calls.

### Testing in REAL Mode

1. Use Telegram's test environment (test.telegram.org)
2. Create a test bot with @BotFather in test mode
3. Use test Stars (free in test environment)

### Test Payment Flow

```bash
# 1. Create payment
curl -X POST http://localhost:8001/api/payments/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"starsAmount": 10}'

# Response includes invoiceLink

# 2. Simulate webhook (for testing)
curl -X POST http://localhost:8001/master/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 123,
    "message": {
      "successful_payment": {
        "currency": "XTR",
        "total_amount": 10,
        "invoice_payload": "<payment-id>",
        "telegram_payment_charge_id": "test_charge_123"
      }
    }
  }'
```

## Troubleshooting

### Common Issues

#### "Payment system not configured"
- Check `MASTER_BOT_TOKEN` is set correctly
- Verify bot has payment capabilities

#### "Failed to create invoice"
- Check bot token validity
- Verify bot is not blocked
- Check Telegram API rate limits

#### "Payment not found"
- Ensure webhook is receiving updates
- Check payment ID in payload matches

#### Credits not added
- Check database connection
- Verify user exists
- Check audit logs for errors

### Debug Endpoints

```bash
# Check LLM/API status
curl http://localhost:8001/debug/llm

# Check payment config
curl http://localhost:8001/api/payments/config
```

## Security Considerations

1. **Webhook Secret**: Use `WEBHOOK_SECRET` to verify requests
2. **Idempotency**: Payment processing is idempotent (prevents double-crediting)
3. **Audit Logging**: All payment actions are logged
4. **Amount Validation**: Pre-checkout validates exact amount match

## Monitoring

### Key Metrics to Track

- Payment creation rate
- Success/failure ratio
- Average credits per purchase
- Revenue by time period

### Log Entries

Look for these log patterns:
- `Payment record created` - New payment
- `Pre-checkout approved` - Payment validated
- `Payment processed successfully` - Credits added
- `Payment marked as failed` - Payment failed

## Emergency Procedures

### If payments are failing:

1. Check `MASTER_BOT_TOKEN` validity
2. Verify webhook is responding
3. Check Telegram API status
4. Review error logs

### If credits not appearing:

1. Check payment status in database
2. Verify successful_payment webhook received
3. Check addCredits service logs
4. Manual credit adjustment via admin API

## Contact

- Admin Handle: @aswadtr
- API Docs: /docs/PHASE2_API.md
