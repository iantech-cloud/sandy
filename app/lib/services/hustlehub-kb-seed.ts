/**
 * Comprehensive HustleHub Knowledge Base for AI Chat
 * Seed this data into MongoDB to provide full platform context to AI assistant
 * 
 * Usage: Load this array into your KnowledgeBase collection
 */

export const HUSTLEHUB_KNOWLEDGE_BASE = [
  // ============ PLATFORM OVERVIEW ============
  {
    id: 'platform_001',
    category: 'platform',
    title: 'HustleHub Platform Overview',
    content:
      'HustleHub is a Kenyan online earning platform that enables users to earn money through multiple channels: completing surveys, freelance tasks, content writing, chat conversations with foreigners, affiliate marketing (Soko), and referrals. All earnings are paid via M-Pesa. Minimum withdrawal is KES 500.',
  },
  {
    id: 'platform_002',
    category: 'platform',
    title: 'HustleHub Mission & Values',
    content:
      'HustleHub empowers Kenyans to earn flexible income online without skills barriers. We value transparency, fair compensation, user privacy, and reliable payments. All payments are guaranteed within 24 hours of approval. Our platform is 100% safe and secure with encryption on all transactions.',
  },
  {
    id: 'platform_003',
    category: 'platform',
    title: 'HustleHub Key Features',
    content:
      'HustleHub offers: 1) Surveys - earn KES 50-500 per survey, 2) Tasks - freelance projects and content writing, 3) Chat Foreigners - earn through conversations (unlock for KES 100), 4) Soko - affiliate marketing program, 5) Referrals - earn commissions from referred users, 6) AI Support Chat - 24/7 assistance.',
  },

  // ============ ACCOUNT & REGISTRATION ============
  {
    id: 'account_001',
    category: 'account',
    title: 'Account Registration Process',
    content:
      'To register on HustleHub: 1) Go to signup page, 2) Enter email and create strong password, 3) Verify email address via link sent to your inbox, 4) Complete basic profile (name, username, phone number), 5) Your account is ready to start earning. Verification badge unlocked after ID verification (24-48 hours).',
  },
  {
    id: 'account_002',
    category: 'account',
    title: 'Account Verification Status',
    content:
      'HustleHub has two account levels: 1) Regular Account - full access to surveys, tasks, chat, 2) Verified Account - same access plus higher earning limits and priority support. To verify: upload national ID, take selfie photo, and submit. Verification completes in 24-48 hours. Check your Profile page to see verification status.',
  },
  {
    id: 'account_003',
    category: 'account',
    title: 'Profile Information',
    content:
      'Your profile includes: Name (full name), Username (unique identifier, minimum 3 characters), Email, Phone Number, Profile Picture (optional), Bio (optional), Account Status (Active/Suspended), Verification Status, Total Earnings, Tasks Completed, and Referral Code. Update any info anytime in Settings > Profile section.',
  },
  {
    id: 'account_004',
    category: 'account',
    title: 'Two-Factor Authentication (2FA)',
    content:
      'HustleHub supports 2FA for extra security. Enable 2FA in Settings to receive verification codes via SMS or email when logging in. Recommended for all users to protect account from unauthorized access. 2FA codes are 6-digit numbers valid for 5 minutes.',
  },

  // ============ EARNING METHODS ============
  {
    id: 'earn_001',
    category: 'earning',
    title: 'Surveys - Earning Method',
    content:
      'Complete surveys to earn money. Each survey pays KES 50-500 depending on length and topic. Surveys take 5-30 minutes. High-paying surveys fill quickly. Tips: Complete profile fully (increases survey matches), answer honestly, complete surveys promptly. All survey earnings are instant and credited to your wallet.',
  },
  {
    id: 'earn_002',
    category: 'earning',
    title: 'Tasks & Freelance Projects',
    content:
      'HustleHub offers freelance tasks including content writing, research, data entry, and creative projects. Payment ranges from KES 200-10,000 per task depending on complexity. You submit work, admin reviews, and approves payment within 24-48 hours. View available tasks on Tasks page, select interested tasks, and submit completed work.',
  },
  {
    id: 'earn_003',
    category: 'earning',
    title: 'Chat with Foreigners Earning',
    content:
      'Unlock Chat Foreigners feature for KES 100 one-time fee. Chat with verified international users and earn per conversation. Earnings depend on conversation length and quality. Typical earnings: KES 50-500 per chat session. More active chatting = higher earnings. Premium users get exclusive high-paying chat matches.',
  },
  {
    id: 'earn_004',
    category: 'earning',
    title: 'Soko Affiliate Program',
    content:
      'Join Soko (HustleHub affiliate program) and earn commissions by selling products from our marketplace. No inventory needed - digital affiliate system. Commission rates vary: 10-30% depending on product category. Earn from each sale you make. Access marketing materials on Soko page. Top affiliates earn KES 50,000+ monthly.',
  },
  {
    id: 'earn_005',
    category: 'earning',
    title: 'Referral Program & Commissions',
    content:
      'Earn money by referring friends to HustleHub. Get your unique referral code in Referral section. Share with friends via link/social media. Commission structure: Level 1 (Direct referral) - KES 65 per survey referral or KES 70 for Chat Foreigners unlock, Level 2 (Indirect) - KES 10. Unlimited referral earnings. Top referrers earn KES 100,000+ monthly.',
  },

  // ============ WALLET & PAYMENTS ============
  {
    id: 'wallet_001',
    category: 'wallet',
    title: 'Wallet & Balance Management',
    content:
      'Your Wallet shows: Current balance in KES, Transaction history (all earnings and withdrawals), Pending payments (not yet approved), Bonus promotions. Wallet updates in real-time as you earn. Check Wallet page anytime to see earnings. Withdraw anytime you reach minimum amount (KES 500).',
  },
  {
    id: 'wallet_002',
    category: 'wallet',
    title: 'Withdrawal Process & Timeline',
    content:
      'To withdraw: 1) Go to Wallet page, 2) Click "Request Withdrawal", 3) Confirm M-Pesa number (must match your account), 4) Enter amount (minimum KES 500), 5) Submit request. Processing time: Admin reviews (1-24 hours), then payment sent to M-Pesa (typically within 2 hours). You receive SMS when payment is sent.',
  },
  {
    id: 'wallet_003',
    category: 'wallet',
    title: 'M-Pesa Payment Method',
    content:
      'HustleHub pays exclusively via M-Pesa. M-Pesa works with: Safaricom, Airtel, and Equitel networks. To receive payments: 1) Ensure your M-Pesa is active, 2) Your number is registered and verified, 3) Sufficient balance in M-Pesa account. If having issues, request M-Pesa number change in Settings (requires admin verification).',
  },
  {
    id: 'wallet_004',
    category: 'wallet',
    title: 'Minimum & Maximum Withdrawal',
    content:
      'Minimum withdrawal: KES 500. There is no maximum withdrawal limit. You can withdraw multiple times per day. Each withdrawal request is processed independently. Typical account: withdraw 1-2 times weekly. Premium accounts may withdraw daily. No fees charged for withdrawals - you receive the full amount requested.',
  },
  {
    id: 'wallet_005',
    category: 'wallet',
    title: 'Transaction History & Records',
    content:
      'Your complete transaction history is available in Wallet > Transaction History. Shows: Date, Type (earned/withdrawn), Amount, Status (pending/completed/failed), Description (survey/task/referral/chat). Records kept permanently for reference. Download transaction reports for your records anytime.',
  },

  // ============ DASHBOARD & NAVIGATION ============
  {
    id: 'nav_001',
    category: 'navigation',
    title: 'Dashboard Overview & Home Page',
    content:
      'Dashboard home shows: Welcome message with your name, Current balance (total earnings), Active tasks available, Recent earnings summary, Quick access buttons (Start Earning, View Surveys, Complete Tasks, Chat Now, View Referrals), Notifications of new opportunities. Your entry point to all platform features.',
  },
  {
    id: 'nav_002',
    category: 'navigation',
    title: 'Main Navigation Menu',
    content:
      'HustleHub main menu includes: Home (dashboard overview), Wallet (balance & withdrawals), Earn (surveys & opportunities), Tasks (freelance projects), Chat Foreigners (chat & earn), Soko (affiliate program), Referrals (referral program), Profile (user profile), Support (AI chat help), Settings (account settings), Logout (sign out).',
  },
  {
    id: 'nav_003',
    category: 'navigation',
    title: 'Mobile Menu & Hamburger',
    content:
      'On mobile devices (small screens), access menu via hamburger icon (three lines) in top right. Hamburger menu is fully responsive with large touch targets for easy tapping. All menu items available: Home, Wallet, Earn, Tasks, Chat Foreigners, Soko, Referrals, Profile, Support, Settings, and Logout button at bottom. Menu closes automatically after selecting item.',
  },
  {
    id: 'nav_004',
    category: 'navigation',
    title: 'Desktop Navigation Layout',
    content:
      'On desktop, HustleHub uses: Top header with logo/title and notifications bell, Left sidebar with all menu options and active status indicator, Main content area with page-specific information. Responsive design - layout adapts perfectly to all screen sizes. Logout moved to mobile hamburger menu, not visible on desktop header.',
  },

  // ============ SPECIFIC PAGES ============
  {
    id: 'page_home_001',
    category: 'pages',
    title: 'Home Page Features',
    content:
      'HustleHub Home page displays: Your personalized greeting, Quick stats (balance, tasks completed, earnings), List of available surveys with pay rates and time estimates, New tasks posted today, Recent referral earnings, Performance graph (optional), Shortcuts to popular features, Recommended opportunities based on your profile.',
  },
  {
    id: 'page_wallet_001',
    category: 'pages',
    title: 'Wallet Page Details',
    content:
      'Wallet page includes: Balance display (large, prominent), Pending balance (earnings under review), Available balance (ready to withdraw), Withdrawal button, Transaction history table showing: Date, Type, Amount, Status, M-Pesa number for payments, Withdrawal request form with validation.',
  },
  {
    id: 'page_earn_001',
    category: 'pages',
    title: 'Earn Page - Surveys & Opportunities',
    content:
      'Earn page shows: All available surveys with: Title, Description, Pay amount (KES), Time estimate, Category, Your eligibility, "Start" button. Filter by: Pay rate, Time, Category. Sort by: Pay (highest first), Time (shortest first), Newest. When you click "Start", survey opens in new tab. Complete and return. Earnings added to wallet instantly upon submission.',
  },
  {
    id: 'page_tasks_001',
    category: 'pages',
    title: 'Tasks Page - Freelance Projects',
    content:
      'Tasks page lists: Available freelance projects with: Title, Description, Category, Payment amount, Deadline, Required skills, "Apply" button. Accepted tasks appear in "My Active Tasks" section where you can: Submit work, Check status, View admin feedback, Request deadline extension if needed. Completed work reviewed within 24-48 hours before payment.',
  },
  {
    id: 'page_chat_001',
    category: 'pages',
    title: 'Chat Foreigners Page',
    content:
      'Chat Foreigners page shows: Unlock button (if not yet unlocked - costs KES 100), Available chat matches (verified profiles), Your active chats, Earning summary for chat sessions. For each match: Profile picture, Name, Country, Bio, Response rate. Click profile to start chat. Chat history saved. Earnings tracked per session.',
  },
  {
    id: 'page_soko_001',
    category: 'pages',
    title: 'Soko Affiliate Program Page',
    content:
      'Soko page provides: Products available for affiliate selling, Commission rates per product (10-30%), Marketing materials (images, links, descriptions), Sales dashboard showing your sales and earnings, Referral links to share, Payment history, Top sellers leaderboard. Everything needed to start earning as Soko affiliate.',
  },
  {
    id: 'page_referrals_001',
    category: 'pages',
    title: 'Referrals Page',
    content:
      'Referrals page shows: Your unique referral code/link (copy/share buttons), Total referrals count, Total referral earnings, Commission breakdown: Level 1 earnings, Level 2 earnings, Recent referrals list (name, date referred, status, earnings), Sharing tools (WhatsApp, Twitter, Facebook, Email, Copy Link). Track all referral activity in real-time.',
  },
  {
    id: 'page_profile_001',
    category: 'pages',
    title: 'Profile Page',
    content:
      'Your Profile displays: Profile picture (editable), Name and Username, Email, Phone number, Verification status badge, Account status, Total earnings earned, Total tasks completed, Referral code, Member since date, Edit Profile button. Quick access to all your personal information in one place.',
  },
  {
    id: 'page_support_001',
    category: 'pages',
    title: 'Support & Help Page',
    content:
      'Support page includes: Live AI Chat Assistant (24/7 availability), FAQ section covering common questions, Contact form for complex issues, My Tickets section (track submitted tickets), Email support link, FAQ topics: Registration, Earning, Withdrawal, Account, Payments, Technical Issues. AI responds instantly, humans assist if needed.',
  },
  {
    id: 'page_settings_001',
    category: 'pages',
    title: 'Settings Page Options',
    content:
      'Settings includes: Profile Info (update name, phone, bio), Password Change (current and new password), Two-Factor Authentication (enable/disable), Anti-phishing code setup, M-Pesa Number Change (request form), Security Settings (active sessions, device management), Notification Preferences, Account Deactivation (if needed). All changes take effect immediately.',
  },

  // ============ SECURITY & PRIVACY ============
  {
    id: 'security_001',
    category: 'security',
    title: 'Account Security Best Practices',
    content:
      'Protect your HustleHub account: 1) Use strong password (8+ chars, mix uppercase, numbers, symbols), 2) Enable 2FA for extra protection, 3) Never share password or recovery codes, 4) Use unique email (not shared with other accounts), 5) Log out after each session on shared devices, 6) Verify SSL (lock icon in browser). Never click suspicious links claiming to verify account.',
  },
  {
    id: 'security_002',
    category: 'security',
    title: 'Anti-Phishing Security',
    content:
      'HustleHub implements anti-phishing protection: Setup your anti-phishing code in Settings (choose 3-word phrase you see in all legitimate emails from us), Report phishing attempts immediately (click report link in email or contact support), Never give personal info to unverified sources, Verify email sender domain always. Your code helps confirm emails are genuinely from HustleHub.',
  },
  {
    id: 'security_003',
    category: 'security',
    title: 'Data Privacy & Encryption',
    content:
      'Your data is protected: All data encrypted in transit (SSL/TLS) and at rest (database encryption), Personal info never sold to third parties, Only used for: Payments, surveys, support, analytics, Account data accessible only to you and admin when needed, Regular security audits, GDPR compliant. You can request full data export anytime from Settings.',
  },
  {
    id: 'security_004',
    category: 'security',
    title: 'Password Reset & Recovery',
    content:
      'Forgot your password? 1) Click "Forgot Password" on login page, 2) Enter your email, 3) Check email for reset link (valid 1 hour), 4) Click link and set new password, 5) Log in with new password. If email not received, check spam folder or contact support. Always use strong password on reset.',
  },

  // ============ SUPPORT & TROUBLESHOOTING ============
  {
    id: 'support_001',
    category: 'support',
    title: 'AI Support Assistant',
    content:
      'HustleHub AI Support Assistant is available 24/7 on Support page. Ask questions about: Account issues, Registration help, Withdrawal problems, Earning opportunities, Feature explanations, Technical issues, Payment status. AI provides instant answers based on your account data. For complex issues, AI can escalate to human support or create a ticket.',
  },
  {
    id: 'support_002',
    category: 'support',
    title: 'Common Support Requests',
    content:
      'Most asked questions: "Why can\'t I withdraw?" (minimum KES 500, verified M-Pesa, pending balance must be reviewed), "How long do payments take?" (24 hours review, then 2 hours to M-Pesa), "How to verify account?" (upload ID, take selfie, submit), "Why am I not seeing surveys?" (location mismatch, no email verification, profile incomplete), Contact support with your email for personalized help.',
  },
  {
    id: 'support_003',
    category: 'support',
    title: 'Creating & Tracking Support Tickets',
    content:
      'To create support ticket: 1) Go to Support page, 2) Click "Create Ticket", 3) Select category (Account, Payment, Withdrawal, Technical, Other), 4) Describe issue in detail, 5) Submit. Ticket gets unique number. Check My Tickets section to track status (Open, In Progress, Resolved). Human support responds within 24 hours typically.',
  },
  {
    id: 'support_004',
    category: 'support',
    title: 'Logout & Account Access',
    content:
      'To logout: On desktop (if available), click Logout button in header. On mobile, open hamburger menu (three lines) and tap "Logout" button at bottom. You will be logged out immediately and returned to login page. Next login requires email and password. All your data remains safe.',
  },

  // ============ MOBILE & UX ============
  {
    id: 'mobile_001',
    category: 'mobile',
    title: 'Mobile App & Responsive Design',
    content:
      'HustleHub is fully responsive and mobile-optimized: All features accessible on phones/tablets, Hamburger menu for mobile navigation, Large touch targets for easy tapping, Optimized layouts for small screens, Fast loading on slow connections, Works on all modern browsers (Chrome, Safari, Firefox, Edge). No separate mobile app needed - web app works perfectly as app.',
  },
  {
    id: 'mobile_002',
    category: 'mobile',
    title: 'Mobile Navigation & Menu',
    content:
      'On mobile: Tap hamburger menu (☰ icon) in top right to open navigation, All menu options visible: Home, Wallet, Earn, Tasks, Chat, Soko, Referrals, Profile, Support, Settings, Logout, Menu closes when you select an item or tap outside, Use back button to return to previous page, Bottom tabs available for quick access on some pages.',
  },
  {
    id: 'mobile_003',
    category: 'mobile',
    title: 'Mobile Performance & Speed',
    content:
      'Mobile optimization: Pages load quickly (< 2 seconds), Images optimized for mobile, Minimal data usage (good for slow connections), Touch-friendly buttons and forms, No unnecessary animations slowing down, Responsive font sizes for readability, Offline support for some features, Full functionality on 4G, 3G, and WiFi connections.',
  },

  // ============ FAQ & QUICK ANSWERS ============
  {
    id: 'faq_001',
    category: 'faq',
    title: 'How much can I earn?',
    content:
      'Earnings vary by activity: Surveys: KES 50-500 each, Tasks: KES 200-10,000 per project, Chat Foreigners: KES 50-500 per session (after KES 100 unlock), Soko: 10-30% commission per sale, Referrals: KES 65-70 per active referral. Most users earn KES 5,000-50,000 monthly depending on time invested. Top earners: KES 100,000+ monthly.',
  },
  {
    id: 'faq_002',
    category: 'faq',
    title: 'Is HustleHub safe and legit?',
    content:
      'Yes, HustleHub is 100% safe and legitimate: Registered in Kenya, Secure encrypted payments, User data protected, All payments guaranteed within 24 hours, No hidden fees, Real surveys and tasks, Thousands of active verified users. Your M-Pesa account receives direct payments - same technology banks use. Start with small tasks to build confidence.',
  },
  {
    id: 'faq_003',
    category: 'faq',
    title: 'When can I withdraw my money?',
    content:
      'You can withdraw when: You have minimum KES 500 balance, Your M-Pesa account is verified, You verified your email, You completed profile setup. To withdraw: Go to Wallet > Request Withdrawal, Choose M-Pesa number (must match your account), Confirm amount, Submit. Processing: Admin reviews (1-24 hours), Payment sent to M-Pesa (typically 2 hours). You get SMS when paid.',
  },
  {
    id: 'faq_004',
    category: 'faq',
    title: 'What if my M-Pesa number changes?',
    content:
      'If your M-Pesa number changes: 1) Go to Settings > M-Pesa Number Change, 2) Enter your old number, 3) Enter new number, 4) Provide reason for change, 5) Submit request. Admin reviews and verifies the change (24-48 hours). You can still receive payments during review on either number. Once approved, all future payments go to new number.',
  },
  {
    id: 'faq_005',
    category: 'faq',
    title: 'How does the referral system work?',
    content:
      'Referral system: 1) Get your unique referral code (in Referrals page), 2) Share with friends via link/social media, 3) Friend signs up using your link, 4) You earn KES 65 when they earn from first survey (Level 1), 5) You earn KES 10 when your referred friend\'s referrals earn (Level 2). Unlimited referral earnings. Track all referrals in real-time.',
  },
  {
    id: 'faq_006',
    category: 'faq',
    title: 'What if I forget my password?',
    content:
      'Password recovery: 1) Click "Forgot Password" on login page, 2) Enter your registered email, 3) Check email for password reset link (valid 1 hour), 4) Click link and create new strong password, 5) Log in with new password. If no email received, check spam folder. Set strong password (8+ chars, mix uppercase, numbers, symbols) and consider enabling 2FA.',
  },
  {
    id: 'faq_007',
    category: 'faq',
    title: 'How to unlock Chat Foreigners?',
    content:
      'Chat Foreigners unlock: 1) Go to Chat Foreigners page, 2) Click "Unlock Chat" button, 3) Review KES 100 fee, 4) Confirm unlock, 5) Payment deducted from wallet, 6) Chat feature activated immediately. One-time fee only - never charged again. Start chatting and earning immediately. See available profiles and start conversations with verified users.',
  },

  // ============ PLATFORM POLICIES ============
  {
    id: 'policy_001',
    category: 'policies',
    title: 'User Terms & Conditions',
    content:
      'By using HustleHub: You must be 18+ years old, You agree to terms of service, You provide accurate information, You follow community guidelines, You won\'t use platform for illegal purposes, You understand earnings are not guaranteed, You accept payment delays during review. Complete terms available on website. Non-compliance results in account suspension.',
  },
  {
    id: 'policy_002',
    category: 'policies',
    title: 'Suspension & Account Termination',
    content:
      'Accounts may be suspended for: Violating community guidelines, Fraudulent activity, Repeated task rejection, Suspicious behavior, Payment fraud. Suspension process: Warning issued, 7-day appeal window, Admin review, Decision notification. Termination is permanent account closure with forfeiture of balance (as per T&C). Appeal any suspension to support@hustlehub.ke within timeframe.',
  },
  {
    id: 'policy_003',
    category: 'policies',
    title: 'Privacy Policy Overview',
    content:
      'Your privacy protected: Data collected: email, name, phone, payment info only for platform operation, Data never sold to third parties, You control what information you share, Data encrypted and secure, You can request data export/deletion, Compliant with GDPR regulations. Read full privacy policy on website. Contact privacy@hustlehub.ke with privacy concerns.',
  },
  {
    id: 'policy_004',
    category: 'policies',
    title: 'Refund & Dispute Policy',
    content:
      'Disputes handled: Survey didn\'t load: Contact support with screenshot, Full refund issued, Task rejected unfairly: Submit appeal with work samples, Withdrawal not received: Verify M-Pesa account, Check after 48 hours, Duplicate charge: One-time reversal, Contact support. All disputes resolved within 7 days. Maintain good standing to ensure faster resolution.',
  },

  // ============ ADVANCED TOPICS ============
  {
    id: 'advanced_001',
    category: 'advanced',
    title: 'Account Levels & Tiers',
    content:
      'HustleHub account progression: New Member (0 tasks) - basic access, Active Member (10+ tasks) - higher survey limits, Premium Member (50+ tasks or 10+ referrals) - exclusive high-paying opportunities, VIP (100+ tasks or earned KES 50,000+) - dedicated support, custom opportunities. Progress tracked automatically. Benefits increase with each tier (more surveys, higher pay, priority support).',
  },
  {
    id: 'advanced_002',
    category: 'advanced',
    title: 'Seasonal Campaigns & Bonuses',
    content:
      'HustleHub runs seasonal campaigns: Holiday bonuses, Referral boost weeks (higher commissions), Task marathons (bonus pay), Survey challenges (prizes), Promotional offers (first-time payouts). New campaigns announced on Home page and via email. Limited time opportunities - act fast. Subscribe to notifications to never miss bonus offers.',
  },
  {
    id: 'advanced_003',
    category: 'advanced',
    title: 'Leaderboards & Rankings',
    content:
      'Top earners visible on leaderboards: All-time earnings leaderboard, Monthly earnings leaderboard, Most referrals leaderboard, Most completed tasks leaderboard. Rankings update daily. Top users featured on Home page. Benefits: Recognition in community, Featured profiles, Potential sponsored opportunities. Compete fairly and ethically for leaderboard positions.',
  },
];

// Usage: Import and seed to database
// Example with Mongoose:
// import { KnowledgeBase } from '@/app/lib/models';
// await KnowledgeBase.insertMany(HUSTLEHUB_KNOWLEDGE_BASE);
