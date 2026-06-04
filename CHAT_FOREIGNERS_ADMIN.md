# Chat Foreigners Admin Panel

## Overview
The Chat Foreigners Admin Panel is a comprehensive admin interface for managing bots, users, and viewing platform analytics. It is fully integrated into the existing sandy admin system with a dedicated Chat Foreigners section.

## Admin Navigation

### Sidebar Integration
The admin sidebar now includes a dedicated Chat Foreigners section with three subsections:

- **Bots** (`/admin/chat-foreigners/bots`) - Bot management
- **Users** (`/admin/chat-foreigners/users`) - User access and engagement
- **Dashboard** (`/admin/chat-foreigners/dashboard`) - Platform analytics

### Access Path
All admin pages are located under `/admin/chat-foreigners/`:
```
/admin/chat-foreigners/          - Overview page
/admin/chat-foreigners/bots      - Bot CRUD management
/admin/chat-foreigners/users     - User access tracking
/admin/chat-foreigners/dashboard - Analytics dashboard
```

## Features

### 1. Bot Management (`/admin/chat-foreigners/bots`)

Full CRUD operations for managing chat bots.

**Bot Fields:**
- **Name** (required) - Display name of the bot
- **Username** (required, immutable) - Unique identifier for the bot
- **Avatar URL** - Profile picture/avatar link
- **Bio** - Short description about the bot
- **Personality Type** - e.g., "Friendly", "Professional", "Witty"
- **Speaking Style** - e.g., "Casual", "Formal", "Playful"
- **Mood** - e.g., "Energetic", "Calm", "Mysterious"
- **Interests** - Comma-separated interests
- **Unlock Price** (required) - Cost in KSh to unlock the bot

**Operations:**
- **View** - Table view of all bots with key information
- **Create** - Add new bot with full details
- **Edit** - Update bot attributes (username is locked)
- **Delete** - Remove a bot from the system

### 2. User Management (`/admin/chat-foreigners/users`)

Track and view user access to bots and engagement metrics.

**Metrics Displayed:**
- **User ID** - Reference to the user
- **Bot Name** - Which bot the user accessed
- **Messages** - Total messages exchanged
- **Milestone 1** - Whether user reached 20-message milestone
- **Unlocked Date** - When the user unlocked access

**Use Cases:**
- Monitor user engagement with bots
- Identify most popular bots by access count
- Track milestone achievements for referral bonuses

### 3. Analytics Dashboard (`/admin/chat-foreigners/dashboard`)

Real-time platform metrics and insights.

**Key Metrics:**
- **Total Bots** - Number of active bot profiles
- **Total Unlocks** - Count of bot unlock transactions
- **Total Messages** - Sum of all messages exchanged
- **Revenue** - Estimated revenue from unlocks (90 KSh per unlock)

**Additional Stats:**
- **Top Performing Bots** - Ranked by unlock count with revenue breakdown
- **Average Unlock Price** - Mean cost across all bots
- **Messages per Unlock** - Engagement metric
- **Platform Health** - Overall system status indicator
- **Monthly Revenue Estimate** - Projected 30-day revenue

## Bot Seed Data

### Seeding Bots
The system includes 12 pre-designed bots ready for production:

1. **Luna** (@luna_dev) - Tech/Developer | 60 KSh | Dreamy & Mysterious
2. **Alex** (@alex_creative) - Arts/Designer | 60 KSh | Artistic & Outgoing
3. **Jordan** (@jordan_fitness) - Fitness Coach | 55 KSh | Motivational
4. **Sophia** (@sophia_business) - Business Mentor | 70 KSh | Professional & Wise
5. **Marcus** (@marcus_travel) - Travel Guide | 65 KSh | Adventurous & Witty
6. **Emma** (@emma_cooking) - Food Blogger | 50 KSh | Warm & Passionate
7. **David** (@david_music) - Musician | 60 KSh | Artistic & Expressive
8. **Isabella** (@isabella_learning) - Education | 45 KSh | Curious & Knowledgeable
9. **Kai** (@kai_gaming) - Gamer | 60 KSh | Competitive & Friendly
10. **Nina** (@nina_fashion) - Fashion Designer | 55 KSh | Trendy & Inspirational
11. **Raj** (@raj_tech) - Tech Expert | 65 KSh | Analytical & Helpful
12. **Zara** (@zara_wellness) - Wellness Coach | 50 KSh | Calm & Supportive

### Running the Seed Script

```bash
npm run seed:chat-bots
```

This will:
1. Connect to MongoDB
2. Clear existing bots (optional, can be modified)
3. Insert 12 pre-configured bots
4. Display confirmation with bot names and prices

### Customizing Seed Data

Edit `/scripts/seed-chat-foreigners-bots.js` to add, remove, or modify bots before running the seed script.

## API Endpoints

### Bot Management APIs

**List All Bots**
```
GET /api/chat-foreigners/bots
Response: { success: true, data: Bot[] }
```

**Get Bot Details**
```
GET /api/chat-foreigners/bots?type=details&botId=<id>
Response: { success: true, data: Bot }
```

**Create Bot**
```
POST /api/chat-foreigners/bots
Body: { name, username, avatar?, bio?, personalityType?, speakingStyle?, mood?, interests?, unlockPrice? }
Response: { success: true, data: Bot }
```

**Update Bot**
```
PUT /api/chat-foreigners/bots/<id>
Body: { name?, avatar?, bio?, personalityType?, speakingStyle?, mood?, interests?, unlockPrice? }
Response: { success: true, data: Bot }
```

**Delete Bot**
```
DELETE /api/chat-foreigners/bots/<id>
Response: { success: true, data: { botId: string } }
```

## Admin Action Functions

Located in `/app/actions/chat-foreigners/bots.ts`:

- `listChatForeignersBots()` - List all active bots
- `getBotDetails(botId)` - Get detailed bot information
- `createChatForeignersBot(data)` - Create new bot
- `updateChatForeignersBot(botId, data)` - Update existing bot
- `deleteChatForeignersBot(botId)` - Delete a bot

## Architecture

### File Structure
```
/app/admin/chat-foreigners/
├── page.tsx                 # Overview page
├── bots/
│   └── page.tsx            # Bot management
├── users/
│   └── page.tsx            # User management
└── dashboard/
    └── page.tsx            # Analytics dashboard

/app/api/chat-foreigners/
└── bots/
    ├── route.ts            # GET, POST
    └── [id]/route.ts       # PUT, DELETE

/app/actions/chat-foreigners/
├── bots.ts                 # All bot-related actions
├── payments.ts             # Payment handling
└── wallet.ts               # Wallet management

/scripts/
└── seed-chat-foreigners-bots.js  # Seed data script
```

### Integration Points

1. **Sidebar** - `/app/admin/components/AdminSidebar.tsx` includes Chat Foreigners nav
2. **MongoDB** - Uses existing ChatForeignersBot model
3. **Authentication** - Protected via existing admin auth middleware
4. **Styling** - Consistent with existing sandy admin panel design

## Future Enhancements

1. **Bot Analytics** - Per-bot engagement metrics and performance tracking
2. **Story Management** - Similar admin interface for managing bot stories
3. **Payment Tracking** - Detailed payment and referral payout history
4. **User Moderation** - Reporting and moderation tools
5. **Bot Categories** - Filter and organize bots by category
6. **Batch Operations** - Bulk update/delete capabilities
7. **Export/Import** - CSV export of bots and analytics
8. **API Rate Limiting** - Monitor API usage and implement limits

## Troubleshooting

### Bots Not Appearing
- Run seed script: `npm run seed:chat-bots`
- Check MongoDB connection
- Verify ChatForeignersBot collection exists

### Admin Page Not Accessible
- Ensure user has admin privileges
- Check admin middleware is properly configured
- Verify `/admin/chat-foreigners/` route is reachable

### Seed Script Fails
- Check `.env.local` has `MONGODB_URI` set
- Ensure MongoDB is running and accessible
- Check Node.js version (requires 22.x)

## Notes

- The admin panel is read-only regarding user data (no user deletion)
- Bot deletions should be done carefully as they affect user access
- Analytics are real-time and may take a moment to calculate for large datasets
- All prices are stored in cents internally (divide by 100 for KSh display)
