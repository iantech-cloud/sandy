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
