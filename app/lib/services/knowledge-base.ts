/**
 * Knowledge Base Service
 * Manages knowledge base documents and vector embeddings
 */

import { Schema, model, models } from 'mongoose';
import { connectToDatabase } from '@/app/lib/models';

// Knowledge base document schema
const KnowledgeBaseSchema = new Schema(
  {
    id: { type: String, unique: true, required: true },
    category: { type: String, required: true, index: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    embeddings: [{ type: Number }],
    chunk_size: { type: Number, default: 1 },
    order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

KnowledgeBaseSchema.index({ category: 1, is_active: 1 });
KnowledgeBaseSchema.index({ embeddings: '2dsphere' });

export const KnowledgeBase = models.KnowledgeBase || model('KnowledgeBase', KnowledgeBaseSchema);

// Default knowledge base content
export const DEFAULT_KNOWLEDGE_BASE = [
  {
    id: 'faq_001',
    category: 'faq',
    title: 'What is HustleHub?',
    content:
      'HustleHub is a platform where you can earn money through surveys, tasks, affiliate marketing, and chat with foreigners. Complete activities and get rewarded instantly.',
  },
  {
    id: 'registration_001',
    category: 'registration',
    title: 'How to register on HustleHub',
    content:
      'To register: 1) Click "Sign Up" button 2) Enter your email and create a password 3) Verify your phone number 4) Complete your profile with personal details 5) Start earning!',
  },
  {
    id: 'registration_002',
    category: 'registration',
    title: 'Account verification process',
    content:
      'After registration, verify your account by: 1) Entering the OTP sent to your phone 2) Uploading a valid ID document 3) Taking a selfie for facial verification. Verification usually takes 24-48 hours.',
  },
  {
    id: 'referrals_001',
    category: 'referrals',
    title: 'How referrals work',
    content:
      'Referrals: 1) Get your unique referral link from your dashboard 2) Share with friends 3) When they sign up, you both get bonuses 4) You earn commissions on their activity. No limit to referrals!',
  },
  {
    id: 'referrals_002',
    category: 'referrals',
    title: 'Commission structure',
    content:
      'Commission structure: Level 1 (Direct): KES 65 for survey completion, KES 70 for Chat Foreigners unlock. Level 2 (Grandparent): KES 10 for both. Commissions are paid instantly to your wallet.',
  },
  {
    id: 'withdrawal_001',
    category: 'withdrawals',
    title: 'Minimum withdrawal amount',
    content:
      'Minimum withdrawal: KES 500. You can withdraw anytime when you have at least KES 500 in your account. Withdrawals are processed within 24 hours to your M-Pesa.',
  },
  {
    id: 'withdrawal_002',
    category: 'withdrawals',
    title: 'How to withdraw money',
    content:
      'To withdraw: 1) Go to Wallet section 2) Click "Withdraw" 3) Enter amount (minimum KES 500) 4) Select M-Pesa payment method 5) Enter phone number 6) Confirm. Money arrives in 24 hours.',
  },
  {
    id: 'payment_001',
    category: 'payments',
    title: 'Payment methods',
    content:
      'We accept M-Pesa (Safaricom, Airtel, Equitel) for deposits and withdrawals. This is the primary payment method. Transactions are secure and processed instantly.',
  },
  {
    id: 'chatforeigners_001',
    category: 'chat-foreigners',
    title: 'What is Chat Foreigners?',
    content:
      'Chat Foreigners lets you chat with real people from around the world. Unlock chat to earn money: each conversation earns you money. You can interact with verified profiles.',
  },
  {
    id: 'chatforeigners_002',
    category: 'chat-foreigners',
    title: 'How to unlock Chat Foreigners',
    content:
      'To unlock: 1) Go to Chat Foreigners section 2) Select a profile 3) Pay KES 100 (one-time unlock fee) 4) Start chatting and earning. Earnings depend on conversation length and engagement.',
  },
  {
    id: 'affiliate_001',
    category: 'affiliate',
    title: 'What is affiliate marketing?',
    content:
      'Affiliate marketing: Promote HustleHub products and earn commission. Refer other users or referrals to affiliate program and earn passive income on their activity.',
  },
  {
    id: 'affiliate_002',
    category: 'affiliate',
    title: 'How to join affiliate program',
    content:
      'To join: 1) Go to Affiliate Marketing section 2) Click "Join Program" 3) Complete profile 4) Get your affiliate links 5) Share and earn. No approval needed, instant activation.',
  },
  {
    id: 'account_001',
    category: 'account',
    title: 'How to update profile',
    content:
      'To update profile: 1) Click on your avatar 2) Go to Profile Settings 3) Edit your details 4) Upload a new profile picture if you want 5) Click Save changes. Changes take effect immediately.',
  },
  {
    id: 'account_002',
    category: 'account',
    title: 'Password and security',
    content:
      'To change password: 1) Go to Settings 2) Click "Change Password" 3) Enter current password 4) Enter new password (min 8 characters) 5) Confirm. Password change is immediate.',
  },
  {
    id: 'terms_001',
    category: 'legal',
    title: 'Terms and Conditions overview',
    content:
      'By using HustleHub, you agree to our terms: Be at least 18 years old, provide accurate information, not engage in fraud, respect other users, and comply with local laws.',
  },
  {
    id: 'privacy_001',
    category: 'legal',
    title: 'Privacy policy',
    content:
      'We protect your data: Your personal information is never sold to third parties. We use encryption for all transactions. You control what information you share. Read full policy on Privacy page.',
  },
  {
    id: 'site_nav_001',
    category: 'site-navigation',
    title: 'Dashboard navigation overview',
    content:
      'HustleHub dashboard navigation: Home (dashboard overview), Wallet (balance & withdrawals), Earn (surveys & tasks), Tasks (content writing), Chat Foreigners (chat & earn), Soko (affiliate products), Refs (referral program), Profile (user profile), Support (help), Settings (account settings).',
  },
  {
    id: 'site_nav_002',
    category: 'site-navigation',
    title: 'Mobile menu/hamburger menu',
    content:
      'On mobile devices, use the hamburger menu (three lines icon) in the top right to access: Home, Wallet, Earn, Tasks, Chat Foreigners, Soko, Referrals, Profile, Support, Settings, and Logout. The menu is fully mobile-friendly for all screen sizes.',
  },
  {
    id: 'home_001',
    category: 'pages',
    title: 'Dashboard home page',
    content:
      'The Dashboard home shows: user welcome message, balance overview, recent earnings, active tasks, quick access buttons to earn money, and shortcuts to popular features. This is your entry point to the platform.',
  },
  {
    id: 'wallet_001',
    category: 'pages',
    title: 'Wallet page features',
    content:
      'Wallet page shows: current balance in KES, transaction history, pending withdrawals, withdrawal requests, M-Pesa payment info, minimum withdrawal amount (KES 500), processing time (24 hours), and option to request a withdrawal.',
  },
  {
    id: 'earn_001',
    category: 'pages',
    title: 'Earn/Surveys page',
    content:
      'The Earn page displays available surveys and earning opportunities. Browse surveys, check earning amounts, view survey details, complete surveys to earn money. Earnings are credited instantly to your wallet after completion.',
  },
  {
    id: 'tasks_001',
    category: 'pages',
    title: 'Tasks/Content writing page',
    content:
      'The Tasks section shows content writing opportunities, freelance projects, and other tasks. View task details, requirements, payment amounts, and submit completed work. Payouts processed within 24-48 hours after approval.',
  },
  {
    id: 'chat_foreigners_001',
    category: 'pages',
    title: 'Chat Foreigners page',
    content:
      'Chat Foreigners page allows you to unlock chat (KES 100 one-time fee) and chat with verified international users. Each conversation earns money based on engagement and time. View available profiles, start conversations, track earnings per chat session.',
  },
  {
    id: 'soko_001',
    category: 'pages',
    title: 'Soko affiliate program page',
    content:
      'Soko is HustleHub\'s affiliate marketing program. Sell products from our marketplace, earn commissions (rates vary by product category), access marketing materials, track sales and earnings, and withdraw commissions. No inventory needed - digital affiliate system.',
  },
  {
    id: 'referrals_page_001',
    category: 'pages',
    title: 'Referrals page features',
    content:
      'The Referrals page shows: your unique referral code/link, number of successful referrals, total referral earnings, commission breakdown by level, and tools to share your referral link. Copy link to share via social media, email, or messaging apps.',
  },
  {
    id: 'profile_page_001',
    category: 'pages',
    title: 'Profile page',
    content:
      'Your Profile page displays: profile picture, name, username, contact info, account status (verified/unverified), account level, rank, total earnings, tasks completed, referral code, and quick link to edit profile or update settings.',
  },
  {
    id: 'support_page_001',
    category: 'pages',
    title: 'Support/Help page',
    content:
      'The Support page includes: live AI chat assistant for instant answers, FAQ section for common questions, contact form for complex issues, ticket tracking for submitted issues, link to email support. AI assistant available 24/7 for quick help.',
  },
  {
    id: 'settings_page_001',
    category: 'pages',
    title: 'Settings page options',
    content:
      'Settings page includes: change password, update profile info (name, phone), enable two-factor authentication (2FA), anti-phishing code setup, M-Pesa change request form, security settings, and account preferences. All changes take effect immediately.',
  },
  {
    id: 'profile_update_001',
    category: 'account',
    title: 'How to update profile information',
    content:
      'To update profile: 1) Go to Settings > Profile section 2) Edit name, phone number, or other details 3) Click "Save changes" 4) Changes appear immediately across dashboard, header, and navigation. Your updated name shows everywhere on the platform.',
  },
  {
    id: 'ai_support_001',
    category: 'support',
    title: 'AI Support Assistant',
    content:
      'HustleHub has a 24/7 AI Support Assistant available on the Support page and in the dashboard. Ask questions about: account, registration, withdrawals, earnings, referrals, features, payments, or general help. The AI provides instant answers based on your account info.',
  },
  {
    id: 'mobile_experience_001',
    category: 'mobile',
    title: 'Mobile app experience',
    content:
      'HustleHub is fully optimized for mobile. Use hamburger menu to navigate, tap buttons easily with large touch targets, responsive design adapts to any screen size. All features (earn, chat, referrals, wallet, settings) work perfectly on mobile devices.',
  },
  {
    id: 'account_verification_001',
    category: 'account',
    title: 'Account verification status',
    content:
      'Account verification status appears in your Profile page and Settings. Verified accounts have full access to all features. If unverified, you can verify by: uploading ID, taking a selfie, and completing verification process. Verification usually takes 24-48 hours.',
  },
  {
    id: 'logout_001',
    category: 'account',
    title: 'How to logout',
    content:
      'To logout: On desktop, click Logout button in the dashboard. On mobile, open the hamburger menu (three lines) and tap "Logout" button at the bottom. You will be logged out immediately and returned to the login page.',
  },
];

/**
 * Seed knowledge base
 */
export async function seedKnowledgeBase() {
  try {
    await connectToDatabase();

    for (const doc of DEFAULT_KNOWLEDGE_BASE) {
      await KnowledgeBase.findOneAndUpdate({ id: doc.id }, doc, {
        upsert: true,
        new: true,
      });
    }

    console.log('[KB] Knowledge base seeded successfully');
  } catch (error) {
    console.error('[KB] Error seeding knowledge base:', error);
    throw error;
  }
}

/**
 * Get knowledge base by category or search.
 * Falls back to the in-memory DEFAULT_KNOWLEDGE_BASE when the DB is unavailable
 * so the LLM always receives grounded context.
 */
export async function searchKnowledgeBase(query: string, category?: string) {
  try {
    await connectToDatabase();

    const filter: any = {
      is_active: true,
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { content: { $regex: query, $options: 'i' } },
      ],
    };

    if (category) {
      filter.category = category;
    }

    const results = await KnowledgeBase.find(filter).limit(5);

    // If DB returned results use them, otherwise fall back to in-memory KB
    if (results.length > 0) {
      return results;
    }

    return searchDefaultKB(query, category);
  } catch (error) {
    console.error('[KB] Search error — using in-memory fallback:', error);
    return searchDefaultKB(query, category);
  }
}

/**
 * Keyword search over the in-memory DEFAULT_KNOWLEDGE_BASE
 */
function searchDefaultKB(query: string, category?: string) {
  const lower = query.toLowerCase();
  return DEFAULT_KNOWLEDGE_BASE.filter((doc) => {
    const matchesCategory = category ? doc.category === category : true;
    const matchesQuery =
      doc.title.toLowerCase().includes(lower) ||
      doc.content.toLowerCase().includes(lower);
    return matchesCategory && matchesQuery;
  }).slice(0, 5);
}

/**
 * Get all categories
 */
export async function getKnowledgeBaseCategories() {
  try {
    await connectToDatabase();
    const categories = await KnowledgeBase.distinct('category', { is_active: true });
    return categories;
  } catch (error) {
    console.error('[KB] Categories error:', error);
    throw error;
  }
}
