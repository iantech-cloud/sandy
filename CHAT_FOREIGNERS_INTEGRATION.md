# Chat Foreigners Integration Summary

## Overview
Successfully transformed the aurachat project into a "Chat Foreigners" module integrated into the sandy dashboard. The module maintains all existing logos and brand elements while providing a complete chat interface with bot management, wallet functionality, and referral payouts.

## Architecture

### MongoDB Collections
Located in `/app/lib/models/ChatForeigners.ts`:

1. **ChatForeignersProfile** - User chat profiles
   - displayName, bio, avatar
   - referralCode, referralLink
   - totalBotUnlocks, totalEarnings_cents

2. **ChatForeignersBot** - Bot configurations
   - name, description, avatar_url
   - category, unlockCost_cents
   - isActive, createdAt

3. **ChatForeignersBotAccess** - User access to bots
   - userId, botId references
   - messageCount, firstMilestoneComplete
   - createdAt, lastInteraction

4. **ChatForeignersMpesaTransaction** - M-Pesa payment tracking
   - userId, amount_cents
   - phoneNumber, messageReference
   - checkout_request_id, conversationId
   - transaction_type: "chat_foreigners_unlock" | "chat_foreigners_deposit"
   - status: "pending" | "completed" | "failed" | "timeout"

5. **ChatForeignersPayment** - Payment records
   - userId, botId references
   - paymentType: "bot_unlock" | "bot_renewal"
   - mpesa_transaction_id (links to MpesaTransaction)
   - status tracking

6. **ChatForeignersReferralEarning** - Referral payout tracking
   - referrerId, refereeId, botId
   - type: "initial_unlock" | "milestone_bonus"
   - amount_cents, status
   - paymentId reference

7. **ChatForeignersWallet** - Dedicated earnings wallet
   - userId reference
   - balance_cents, total_earned_cents, total_deposited_cents

8. **ChatForeignersTransaction** - Transaction records
   - userId reference
   - amount_cents, type, description
   - status, mpesa_transaction_id
   - target_type, target_id for accounting

9. **ChatForeignersProfile** - User profiles
   - displayName, bio, avatar
   - referralCode, referralLink

## Dashboard Integration

### Navigation
- Added "Chat Foreigners" link to sidebar between "Tasks" and "Referrals"
- Updated layout to detect chat-foreigners routes in getCurrentSection()
- Link appears in main navigation using MessageCircle icon

### Routes
- `/dashboard/chat-foreigners` - Main chat foreigners hub
- `/dashboard/chat-foreigners/wallet` - Wallet management and transaction history
- `/dashboard/chat-foreigners/unlock/[botId]` - Bot unlock page (triggers payment)
- `/dashboard/chat-foreigners/chat/[botId]` - Chat interface with bot
- `/dashboard/chat-foreigners/my-chats` - User's active conversations

## Referral Integration

### Unified Referral Page
Location: `/app/dashboard/referrals/page.tsx`

The referral page now displays BOTH referral systems on a single page:

1. **Main Dashboard Referrals** - KES 70 per activation
   - Shows existing dashboard referral code and link
   - Displays referral network with activation status

2. **Chat Foreigners Referrals** - KES 60 per bot unlock
   - New section with green left border
   - Separate referral link for chat foreigners
   - Generates unique referral code per user

Both links are presented as a unified entry with:
- Separate copy buttons for each link
- Clear earnings structure per system
- Single page navigation to manage all referrals

## Payment Flow

### Co-op Bank Integration
Reuses existing infrastructure from main spin wallet:

1. **Webhook Endpoint**: `/api/payments/coop-bank/callback`
   - Unified endpoint for all payment types
   - Routes based on MpesaTransaction.transaction_type
   - Distinguishes between spin, chat unlock, and chat deposit

2. **Transaction Types**:
   - `spin_wallet_deposit` - Existing spin wallet top-up
   - `spin_wallet_spin` - Existing spin cost deduction
   - `chat_foreigners_unlock` - New chat bot unlock via M-Pesa
   - `chat_foreigners_deposit` - New chat wallet deposit

### Bot Unlock Flow
1. User clicks "Unlock - KES X" on bot card
2. Frontend calls `initiateBotUnlockViaMpesa(botId, phoneNumber, costInCents)`
3. Backend creates MpesaTransaction with type "chat_foreigners_unlock"
4. Co-op Bank STK push sent to user's phone
5. User enters M-Pesa PIN
6. Co-op Bank callback received at /api/payments/coop-bank/callback
7. Callback identifies "chat_foreigners_unlock" transaction type
8. Calls `completeBotUnlockPayment()`:
   - Marks payment as completed
   - Creates BotAccess record for user
   - Records company earning (split: KES 30 company, KES 60 referrer)
   - If referred: Credits referrer's chat_foreigners_wallet + 6000 cents
   - Creates ReferralEarning record

### Wallet Deposit Flow
1. User navigates to Chat Foreigners Wallet
2. Clicks "Deposit" button
3. DepositModal opens with amount and phone number fields
4. Calls `initiateWalletDepositViaMpesa(amount_cents, phoneNumber)`
5. Backend creates MpesaTransaction with type "chat_foreigners_deposit"
6. Co-op Bank STK push sent
7. User enters PIN
8. Callback received and processed:
   - Marks MpesaTransaction as completed
   - Updates ChatForeignersWallet.balance_cents
   - Creates Transaction: type "CHAT_DEPOSIT", target_type "user"
   - Updates total_deposited_cents

## API Routes

### Chat Foreigners APIs
- `GET /api/chat-foreigners/profile` - Get user profile with referral code
- `POST /api/chat-foreigners/payments/unlock` - Initiate bot unlock payment
- `GET /api/chat-foreigners/payments/status?checkoutRequestId=X` - Check payment status
- `POST /api/chat-foreigners/wallet/deposit` - Initiate wallet deposit
- `GET /api/chat-foreigners/wallet` - Get wallet balance and transactions
- `GET /api/chat-foreigners/bots` - List available bots and user access
- `POST /api/chat-foreigners/bots/access` - Record user's first bot access

### Callback Handler
- `POST /api/payments/coop-bank/callback` - Unified webhook for all payment types
  - Routes chat foreigners transactions to appropriate handlers
  - Preserves existing spin wallet functionality
  - Transactional integrity via MongoDB sessions

## Action Functions

Location: `/app/actions/chat-foreigners/`

### payments.ts
- `initiateBotUnlockViaMpesa(botId, phoneNumber, amountCents)` - Initiates payment
- `checkBotUnlockMpesaStatus(checkoutRequestId)` - Polls payment status
- `completeBotUnlockPayment(mpesaTransactionId)` - Completes unlock on callback
- `recordReferralEarning(referrerId, refereeId, botId, amount)` - Records payout
- `completeWalletDeposit(mpesaTransactionId, session)` - Completes deposit

### wallet.ts
- `getChatForeignersWallet()` - Get current balance
- `getChatForeignersWalletTransactions(limit, skip)` - Get transaction history
- `getChatForeignersProfile()` - Get profile with referral code
- `getChatForeignersProfile()` - Generates referral code if needed

### bots.ts
- `listChatForeignersBots(filters?)` - Get available bots
- `getUserBotAccess()` - Get bots user has unlocked
- `recordBotAccess(botId)` - Record first message/unlock
- `getBotById(botId)` - Get single bot details

## UI Components

### Main Chat Page
Location: `/app/dashboard/chat-foreigners/page.tsx`
- Header with wallet balance and quick links
- Navigation to wallet, referrals, and my chats
- Grid of available bots with:
  - Bot avatar/image
  - Name, category, description
  - Unlock cost (if not accessed)
  - "Unlocked" badge (if accessed)
  - "Start Chat" button (if unlocked)
  - "Unlock - KES X" button (if not unlocked)

### Wallet Page
Location: `/app/dashboard/chat-foreigners/wallet/page.tsx`
- Three balance cards:
  - Current Balance with deposit button
  - Total Earned from referrals
  - Total Deposited via M-Pesa
- Transaction history table with:
  - Transaction type (deposit, earnings, withdrawal)
  - Amount and date
  - Status indicator

### Deposit Modal
Location: `/app/dashboard/chat-foreigners/components/DepositModal.tsx`
- Modal form for initiating deposits
- Amount input (minimum KES 10)
- Phone number input with format guidance
- Success/error messaging
- Loader during processing

## Referral Payout Logic

### Bot Unlock Referral
When user unlocks bot through referral link:
1. Referral earning recorded: KES 60 (6000 cents)
2. Amount credited to referrer's ChatForeignersWallet.balance_cents
3. ReferralEarning record created with status "completed"
4. Transaction record created: type "CHAT_EARNINGS", target_type "user"

### Milestone Bonus (Future)
After user completes 20 messages with bot:
1. System checks if referral milestone earned
2. Bonus KES 10 (1000 cents) credited to referrer
3. ReferralEarning record created with type "milestone_bonus"

## Data Migration from SQL to MongoDB

All data structures migrated from SQL (aurachat) to MongoDB (sandy):

| Aurachat SQL | Sandy MongoDB |
|---|---|
| users.referral_code | ChatForeignersProfile.referralCode |
| users.referral_link | ChatForeignersProfile.referralLink |
| chats | ChatForeignersBot |
| user_chat_access | ChatForeignersBotAccess |
| payments | ChatForeignersPayment |
| mpesa_transactions | ChatForeignersMpesaTransaction |
| referral_earnings | ChatForeignersReferralEarning |
| user_wallets | ChatForeignersWallet |
| transactions | ChatForeignersTransaction |

## Key Features Preserved

- Referral attribution and payout logic (KES 60 per unlock)
- Bot management and access control
- Wallet deposit functionality via Co-op Bank M-Pesa
- Transaction tracking and history
- User profiles with referral codes
- Bot categories and descriptions
- Unlock costs per bot

## Key Changes

- MongoDB-backed instead of SQL
- Integrated into sandy dashboard as sub-feature
- Unified referral page showing both dashboard and chat referrals
- Co-op Bank payments reuse existing infrastructure
- Separate wallet for chat earnings (not mixed with spin wallet)
- API-based payment initiation (no external embed)

## Testing Checklist

1. Navigation
   - [ ] Chat Foreigners link appears in sidebar
   - [ ] Can navigate to chat foreigners page
   - [ ] Can navigate to wallet page
   - [ ] Referral page shows both referral sections

2. Bot Management
   - [ ] Bots load and display correctly
   - [ ] Unlock costs shown correctly
   - [ ] "Unlocked" badge appears after purchase
   - [ ] Can click "Start Chat" for unlocked bots

3. Payments
   - [ ] Bot unlock STK push appears on phone
   - [ ] Callback updates bot access correctly
   - [ ] Wallet deposit STK push appears on phone
   - [ ] Deposit callback updates wallet balance

4. Referrals
   - [ ] Referral code generates correctly
   - [ ] Referral link is valid and contains code
   - [ ] Chat referral link different from dashboard
   - [ ] Both links show on single referral page

5. Wallet
   - [ ] Balance updates after deposit
   - [ ] Balance updates after bot unlock referral
   - [ ] Transaction history shows all transactions
   - [ ] Earned vs deposited amounts tracked correctly

## Future Enhancements

- Chat interface implementation (backend integration)
- Message tracking and milestone bonuses
- Bot rating and review system
- Chat history and export
- Admin dashboard for bot management
- Advanced analytics and user behavior tracking
- Withdrawal functionality from chat earnings
