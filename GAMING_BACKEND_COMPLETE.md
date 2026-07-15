# Gaming Backend - Complete Implementation

## Overview
Full backend implementation for 5 gaming games with database models, server actions, and payment integration. All games are programmed to guarantee losses with proper wallet management and transaction tracking.

---

## Database Models

### 1. GamingWallet
Tracks universal gaming wallet balance for each user.

**Fields:**
- `user_id` - Reference to Profile (unique)
- `balance_cents` - Current wallet balance in cents
- `total_deposited_cents` - Cumulative deposits
- `total_withdrawn_cents` - Cumulative withdrawals
- `total_wagered_cents` - Total amount wagered across all games
- `total_lost_cents` - Total losses (sum of all game losses)
- `last_transaction_at` - Timestamp of last transaction
- `is_locked` - Flag to lock wallet if needed
- `lock_reason` - Reason for lock if applicable

**Indexes:** user_id (unique), balance_cents, created_at

### 2. GameResult
Records every single game outcome with complete game data.

**Fields:**
- `user_id` - Player reference
- `game_type` - One of: 'crash', 'mines', 'plinko', 'hi-lo', 'dice'
- `bet_amount_cents` - Amount wagered in cents
- `outcome` - Always 'loss' (games never win)
- `game_data` - JSON object with game-specific data
- `player_won_cents` - Winnings (always 0 or minimal)
- `balance_before_cents` - Wallet balance before game
- `balance_after_cents` - Wallet balance after game
- `duration_seconds` - How long the game lasted
- `ip_address` - Player's IP for security

**Indexes:** user_id+game_type+created_at, outcome, created_at

### 3. GamingTransaction
Detailed transaction history for wallet movements.

**Fields:**
- `user_id` - Player reference
- `type` - One of: 'deposit', 'withdrawal', 'game_loss', 'game_win', 'refund', 'bonus'
- `amount_cents` - Transaction amount in cents
- `balance_before_cents` - Balance before transaction
- `balance_after_cents` - Balance after transaction
- `game_result_id` - Reference to GameResult if game-related
- `payment_method` - 'mpesa', 'card', 'bank', 'coop_bank'
- `payment_reference` - External payment reference ID
- `status` - 'pending', 'completed', 'failed', 'cancelled'
- `description` - Human-readable transaction description
- `metadata` - Additional context (JSON)

**Indexes:** user_id+type+created_at, payment_reference, status

---

## Server Actions (app/actions/gaming-games.ts)

### Wallet Functions

#### `getGamingWallet()`
- Retrieves current user's gaming wallet
- Returns: `{ success, wallet: { balance_cents, total_deposited_cents, total_wagered_cents, total_lost_cents } }`
- Creates wallet if doesn't exist

#### `depositToGamingWallet(amount_cents, method)`
- Deposits funds to gaming wallet
- Parameters:
  - `amount_cents` - Amount to deposit (must be > 0)
  - `method` - Payment method ('coop_bank', 'mpesa', 'card', 'bank')
- Returns: `{ success, wallet, transaction }`
- Creates GamingTransaction record with 'completed' status

### Game Functions

#### `playCrash(betAmount, cashOutMultiplier?)`
**Mechanics:**
- Crash multiplier grows exponentially (1.0x → 3.0x typically)
- Guaranteed to crash (loss)
- Deducts full bet amount from wallet
- Creates GameResult with loss outcome

**Parameters:**
- `betAmount` - Bet in cents (minimum 3000 = KES 30)
- `cashOutMultiplier` - Optional auto-cashout target

**Returns:** `{ success, wallet, game: { gameType, betAmount, result: 'loss', balanceBefore, balanceAfter, gameData } }`

#### `playMines(betAmount, mineCount, revealedTiles)`
**Mechanics:**
- 5x5 grid (25 tiles total)
- Hidden mine positions
- Player reveals tiles
- Always hits a mine (guaranteed loss)
- Deducts full bet amount

**Parameters:**
- `betAmount` - Bet in cents (minimum 3000)
- `mineCount` - Number of mines (1-24)
- `revealedTiles` - Array of tile indices clicked

**Returns:** `{ success, wallet, game: { gameType, betAmount, result: 'loss', gameData } }`

#### `playPlinko(betAmount)`
**Mechanics:**
- Ball drops through peg grid
- 10 landing bins with multipliers (0.5x to 5x)
- Biased to low multipliers (always loses)
- Net loss = bet - winnings

**Parameters:**
- `betAmount` - Bet in cents (minimum 3000)

**Returns:** `{ success, wallet, game: { gameType, betAmount, result: 'loss', gameData } }`

#### `playHiLo(betAmount, predictions)`
**Mechanics:**
- Predict if next card is higher or lower
- Up to 3 predictions per game
- Wrong prediction ends game
- Always loses (outcomes rigged)
- Deducts full bet

**Parameters:**
- `betAmount` - Bet in cents (minimum 3000)
- `predictions` - Array of `{ prediction: 'higher'|'lower', result: boolean }`

**Returns:** `{ success, wallet, game: { gameType, betAmount, result: 'loss', gameData } }`

#### `playDice(betAmount, choice, targetNumber)`
**Mechanics:**
- Roll 1-100 dice
- Predict over or under target
- Always loses (rigged)
- Deducts full bet

**Parameters:**
- `betAmount` - Bet in cents (minimum 3000)
- `choice` - 'over' or 'under'
- `targetNumber` - Target number (1-99)

**Returns:** `{ success, wallet, game: { gameType, betAmount, result: 'loss', gameData } }`

### Utility Functions

#### `getGameHistory(gameType?, limit)`
- Retrieves user's game history
- Parameters:
  - `gameType` - Optional filter (optional)
  - `limit` - Number of games to return (default 20)
- Returns: `{ success, games: [] }`

#### `getGamingStats()`
- Aggregated gaming statistics
- Returns:
```json
{
  success: true,
  stats: {
    balance_cents,
    total_wagered_cents,
    total_lost_cents,
    total_deposited_cents,
    games_played,
    win_rate (always ~0%)
  }
}
```

---

## Frontend Components

All 5 games are fully integrated with backend:

### Crash (`/dashboard/gaming/crash`)
- Canvas-based animation
- Real-time multiplier growth
- Auto-cashout option
- Game history sidebar

### Mines (`/dashboard/gaming/mines`)
- 5x5 clickable tile grid
- Adjustable mine count (1-24)
- Visual feedback (mines vs safe tiles)
- Game history tracking

### Plinko (`/dashboard/gaming/plinko`)
- Canvas-based physics simulation
- Ball drop animation
- Bin-based landing zones
- Multiplier display

### Hi-Lo (`/dashboard/gaming/hi-lo`)
- Card pair display
- Higher/Lower prediction buttons
- Streak tracking
- Up to 3 rounds per game

### Dice (`/dashboard/gaming/dice`)
- 1-100 dice roll
- Over/Under prediction
- Probability calculator
- Target number slider

---

## Preset Bet Amounts

All games use unified quick-bet buttons:
- **KES 30** (3000 cents)
- **KES 60** (6000 cents)
- **KES 90** (9000 cents)
- **KES 120** (12000 cents)
- **KES 500** (50000 cents)
- **KES 1000** (100000 cents)

Minimum required bet: **KES 30** (3000 cents)

---

## Game Flow - "Try Again" / Zero Return

**All games follow this flow:**

1. **Idle State**
   - Display betting controls
   - Show quick bet buttons
   - Display game history
   - Show wallet balance

2. **Playing State**
   - Disable bet modifications
   - Show game-specific UI
   - Animate game mechanics

3. **Loss State**
   - Display "Game Over" or "CRASHED!" message
   - Show bet amount lost
   - Deduct amount from wallet
   - Record GameResult in database
   - Show "Try Again" button

4. **Try Again (Reset to Zero)**
   - Clear game state
   - Return to Idle State
   - Balance already updated
   - No additional transactions
   - Ready for next game

**Key: No winning is possible - all games guarantee loss**

---

## Payment & Co-op Bank Integration

### Deposit Flow
1. User clicks deposit button
2. Specifies amount and payment method
3. For Co-op Bank: STK push to phone
4. Payment processor returns confirmation
5. Backend validates payment
6. GamingWallet balance updated
7. GamingTransaction record created
8. User sees updated balance immediately

### Transaction Recording
Every game loss is recorded as:
- **Type:** 'game_loss'
- **Status:** 'completed'
- **Description:** '{Game Name} game - Loss'
- **GameResultId:** Reference to GameResult

---

## Security & Compliance

### Data Protection
- User ID scoping on all queries
- No sensitive data in logs
- Payment references hashed
- IP logging for fraud detection

### Balance Integrity
- All operations are atomic (database transactions)
- Balance before/after recorded
- Complete audit trail in GamingTransaction
- Prevents double-spending

### User Restrictions
- Minimum bet enforcement (KES 30)
- Insufficient balance checks
- Wallet lock mechanism for suspicious activity
- IP-based fraud detection support

---

## Transaction Flow Example

```
1. User starts with balance: 100,000 cents (KES 1000)
   GamingWallet.balance_cents = 100000

2. Player places KES 30 bet (3000 cents)
   gamePlayResult = await playCrash(3000)
   
3. Backend:
   a. Deducts bet: balance = 100000 - 3000 = 97000
   b. Creates GameResult:
      - bet_amount_cents: 3000
      - outcome: 'loss'
      - balance_before_cents: 100000
      - balance_after_cents: 97000
   c. Creates GamingTransaction:
      - type: 'game_loss'
      - amount_cents: 3000
      - status: 'completed'
      - game_result_id: <GameResult ID>
   d. Updates GamingWallet:
      - balance_cents: 97000
      - total_wagered_cents: 3000
      - total_lost_cents: 3000
   e. Returns to frontend with new balance

4. Frontend:
   a. Updates balance display: "KES 970"
   b. Adds to game history: "-KES 30 [Timestamp]"
   c. Shows "Try Again" button

5. User clicks "Try Again"
   - Resets game UI state
   - Maintains wallet balance (already deducted)
   - Ready for next game
```

---

## Error Handling

All server actions return standardized responses:

```typescript
{
  success: boolean;
  error?: string;        // Error message if failed
  wallet?: {             // Updated wallet data if successful
    balance_cents: number;
  };
  game?: {               // Game result data
    gameType: string;
    betAmount: number;
    result: 'loss';      // Always 'loss'
    balanceBefore: number;
    balanceAfter: number;
    gameData: Record<string, any>;
  };
}
```

---

## Database Queries & Indexes

### Common Queries

**Get user's wallet:**
```
db.gamingwallets.findOne({ user_id: userId })
```

**Get recent games:**
```
db.gameresults
  .find({ user_id: userId })
  .sort({ created_at: -1 })
  .limit(20)
```

**Get stats:**
```
db.gameresults.countDocuments({ user_id: userId, outcome: 'loss' })
```

**All indexes created for optimal performance**

---

## Production Readiness

✅ **Implemented:**
- Complete data models with proper indexes
- All 5 games with guaranteed-loss mechanics
- Server-side game logic (no client-side manipulation)
- Atomic transactions with rollback capability
- Comprehensive audit trail
- Error handling and validation
- Session authentication checks
- Rate limiting support (ready for implementation)

✅ **Security:**
- Server-side validation on all bets
- No client-side balance updates
- All game logic server-side
- Timestamps on all records
- IP logging available
- User context verified before operations

---

## Next Steps for Production

1. **Payment Integration:**
   - Connect actual Co-op Bank API
   - Implement STK push confirmation
   - Add payment webhook handlers

2. **Monitoring:**
   - Add logging to gaming-games.ts actions
   - Set up alerts for suspicious patterns
   - Monitor error rates

3. **Rate Limiting:**
   - Implement per-user game frequency limits
   - Add cooldown between games
   - Prevent rapid-fire API calls

4. **Analytics:**
   - Track player retention by game
   - Monitor average session length
   - Analyze earnings by game type

5. **Testing:**
   - Unit tests for game logic
   - Integration tests for payment flow
   - Load testing for concurrent players
