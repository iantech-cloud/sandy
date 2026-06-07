#!/usr/bin/env node
/**
 * HustleHub Africa — Knowledge Base Seeder
 *
 * Usage:
 *   node --env-file-if-exists=.env.local scripts/seed-knowledge-base.mjs
 *
 * Or if you keep your variables in .env:
 *   node --env-file-if-exists=.env scripts/seed-knowledge-base.mjs
 *
 * Requires: MONGODB_URI environment variable
 * Optional: NVIDIA_API_KEY (generates vector embeddings when present)
 */

import mongoose from 'mongoose';

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg)  { console.log(`[seed] ${msg}`); }
function warn(msg) { console.warn(`[warn] ${msg}`); }
function fail(msg) { console.error(`[error] ${msg}`); process.exit(1); }

// ─── Mongoose schema (mirrors knowledge-base.ts) ────────────────────────────

const KnowledgeBaseSchema = new mongoose.Schema(
  {
    id:         { type: String, unique: true, required: true },
    category:   { type: String, required: true, index: true },
    title:      { type: String, required: true },
    content:    { type: String, required: true },
    metadata:   { type: mongoose.Schema.Types.Mixed, default: {} },
    embeddings: [{ type: Number }],
    is_active:  { type: Boolean, default: true },
    order:      { type: Number, default: 0 },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const KnowledgeBase =
  mongoose.models.KnowledgeBase ||
  mongoose.model('KnowledgeBase', KnowledgeBaseSchema);

// ─── Knowledge base documents ────────────────────────────────────────────────

const DOCUMENTS = [
  // ── FAQ ──────────────────────────────────────────────────────────────────
  {
    id: 'faq_001',
    category: 'faq',
    title: 'What is HustleHub?',
    content:
      'HustleHub Africa is an online earning platform where you can earn money through surveys, tasks, affiliate marketing, and chatting with foreigners. Complete activities and get rewarded instantly.',
    order: 1,
  },
  {
    id: 'faq_002',
    category: 'faq',
    title: 'Is HustleHub free to join?',
    content:
      'Yes, creating an account on HustleHub is completely free. Some premium features like Chat Foreigners require a one-time unlock fee of KES 100.',
    order: 2,
  },
  {
    id: 'faq_003',
    category: 'faq',
    title: 'How much can I earn on HustleHub?',
    content:
      'Earnings depend on your activity. You earn through surveys (KES 50–500 each), referral commissions (KES 65 per Level-1 referral), Chat Foreigners sessions, tasks, and affiliate marketing. Active users earn KES 3,000–15,000+ monthly.',
    order: 3,
  },
  // ── Registration ─────────────────────────────────────────────────────────
  {
    id: 'registration_001',
    category: 'registration',
    title: 'How to register on HustleHub',
    content:
      'To register: 1) Click "Sign Up" 2) Enter your email and create a password 3) Verify your phone number via OTP 4) Complete your profile 5) Start earning. Registration takes under 5 minutes.',
    order: 1,
  },
  {
    id: 'registration_002',
    category: 'registration',
    title: 'Account verification process',
    content:
      'After registration verify your account by: 1) Entering the OTP sent to your phone 2) Uploading a valid national ID or passport 3) Taking a selfie for facial verification. Verification usually completes within 24–48 hours.',
    order: 2,
  },
  {
    id: 'registration_003',
    category: 'registration',
    title: 'Age requirement for HustleHub',
    content:
      'You must be at least 18 years old to register on HustleHub. This is a legal requirement. Accounts found to belong to minors will be suspended.',
    order: 3,
  },
  // ── Referrals ─────────────────────────────────────────────────────────────
  {
    id: 'referrals_001',
    category: 'referrals',
    title: 'How referrals work',
    content:
      'Get your unique referral link from your dashboard, share it with friends. When they sign up and complete activities you earn commission. There is no limit to how many people you can refer.',
    order: 1,
  },
  {
    id: 'referrals_002',
    category: 'referrals',
    title: 'Commission structure',
    content:
      'Referral commissions: Level 1 (Direct referrals) — KES 65 for survey completion, KES 70 for Chat Foreigners unlock. Level 2 (Their referrals) — KES 10 for both. Commissions are paid instantly to your wallet.',
    order: 2,
  },
  {
    id: 'referrals_003',
    category: 'referrals',
    title: 'Where to find your referral link',
    content:
      'Your referral link is in the Dashboard under "Refer & Earn" or in your Profile page. You can share it on WhatsApp, Facebook, TikTok, or any social media. Each click is tracked.',
    order: 3,
  },
  // ── Withdrawals ──────────────────────────────────────────────────────────
  {
    id: 'withdrawal_001',
    category: 'withdrawals',
    title: 'Minimum withdrawal amount',
    content:
      'The minimum withdrawal amount is KES 500. You can withdraw any amount above KES 500 at any time.',
    order: 1,
  },
  {
    id: 'withdrawal_002',
    category: 'withdrawals',
    title: 'How to withdraw money',
    content:
      'To withdraw: 1) Go to the Wallet section 2) Click "Withdraw" 3) Enter amount (minimum KES 500) 4) Select M-Pesa as payment method 5) Enter your M-Pesa phone number 6) Confirm the withdrawal. Money arrives within 24 hours.',
    order: 2,
  },
  {
    id: 'withdrawal_003',
    category: 'withdrawals',
    title: 'Withdrawal processing time',
    content:
      'Withdrawals are processed within 24 hours. Most withdrawals are processed within 1–4 hours during business hours (8 AM – 8 PM EAT). Weekend withdrawals may take slightly longer.',
    order: 3,
  },
  {
    id: 'withdrawal_004',
    category: 'withdrawals',
    title: 'Why was my withdrawal rejected?',
    content:
      'Withdrawals may be rejected if: your account is not fully verified, the amount is below KES 500, your M-Pesa number is incorrect, or your account has a security hold. Contact support if the issue persists.',
    order: 4,
  },
  // ── Payments ─────────────────────────────────────────────────────────────
  {
    id: 'payment_001',
    category: 'payments',
    title: 'Accepted payment methods',
    content:
      'HustleHub accepts M-Pesa (Safaricom), Airtel Money, and Equitel for both deposits and withdrawals. All transactions are encrypted and processed securely via the Co-op Bank payment gateway.',
    order: 1,
  },
  {
    id: 'payment_002',
    category: 'payments',
    title: 'How to deposit money',
    content:
      'To deposit: 1) Go to Wallet 2) Click "Deposit" 3) Enter amount 4) Select M-Pesa 5) Enter your phone number 6) You will receive an M-Pesa prompt on your phone 7) Enter your M-Pesa PIN to confirm.',
    order: 2,
  },
  {
    id: 'payment_003',
    category: 'payments',
    title: 'Deposit not reflecting',
    content:
      'If your deposit is not reflecting: 1) Wait 5 minutes as processing can take time 2) Check that you completed the M-Pesa prompt 3) Verify you used the correct phone number 4) Contact support with the M-Pesa transaction code if the issue persists.',
    order: 3,
  },
  // ── Chat Foreigners ───────────────────────────────────────────────────────
  {
    id: 'chatforeigners_001',
    category: 'chat-foreigners',
    title: 'What is Chat Foreigners?',
    content:
      'Chat Foreigners lets you earn money by chatting with verified international users. Each chat session earns you KES based on conversation duration and engagement. It is one of the highest-earning features on HustleHub.',
    order: 1,
  },
  {
    id: 'chatforeigners_002',
    category: 'chat-foreigners',
    title: 'How to unlock Chat Foreigners',
    content:
      'To unlock Chat Foreigners: 1) Go to the Chat Foreigners section 2) Select a profile you want to chat with 3) Pay the KES 100 one-time unlock fee 4) Start chatting and earning immediately.',
    order: 2,
  },
  // ── Tasks ─────────────────────────────────────────────────────────────────
  {
    id: 'tasks_001',
    category: 'tasks',
    title: 'What tasks are available?',
    content:
      'HustleHub offers: Online surveys (KES 50–500), social media tasks (follow, like, share), data entry tasks, app testing, and product reviews. New tasks are added daily.',
    order: 1,
  },
  {
    id: 'tasks_002',
    category: 'tasks',
    title: 'How to complete tasks',
    content:
      'To complete tasks: 1) Go to Tasks section 2) Browse available tasks 3) Click "Start Task" 4) Follow the instructions carefully 5) Submit proof of completion 6) Earn your reward after verification.',
    order: 2,
  },
  {
    id: 'tasks_003',
    category: 'tasks',
    title: 'Task rejection reasons',
    content:
      'Tasks may be rejected if: submitted proof is blurry or incorrect, the task was completed incorrectly, duplicate submissions were detected, or the deadline passed. Re-read the instructions and try again.',
    order: 3,
  },
  // ── Affiliate ─────────────────────────────────────────────────────────────
  {
    id: 'affiliate_001',
    category: 'affiliate',
    title: 'What is the affiliate program?',
    content:
      'The HustleHub affiliate program lets you promote the platform and earn commissions. Refer users to the affiliate program and earn passive income on their activity indefinitely.',
    order: 1,
  },
  {
    id: 'affiliate_002',
    category: 'affiliate',
    title: 'How to join the affiliate program',
    content:
      'To join: 1) Go to Affiliate Marketing section 2) Click "Join Program" 3) Complete your profile 4) Get your unique affiliate links 5) Share and earn. No approval needed — activation is instant.',
    order: 2,
  },
  // ── Account Management ────────────────────────────────────────────────────
  {
    id: 'account_001',
    category: 'account',
    title: 'How to update your profile',
    content:
      'To update your profile: 1) Click your avatar or go to Profile Settings 2) Edit your name, phone number, or bio 3) Upload a new profile picture if needed 4) Click Save. Changes take effect immediately.',
    order: 1,
  },
  {
    id: 'account_002',
    category: 'account',
    title: 'How to change your password',
    content:
      'To change password: 1) Go to Settings 2) Click "Security" 3) Click "Change Password" 4) Enter your current password 5) Enter and confirm your new password (minimum 8 characters) 6) Save.',
    order: 2,
  },
  {
    id: 'account_003',
    category: 'account',
    title: 'Account suspended or banned',
    content:
      'Accounts are suspended for: violating terms of service, fraudulent activity, using fake information, or spamming. If you believe your suspension was in error contact support at support@hustlehub.africa with your account email.',
    order: 3,
  },
  {
    id: 'account_004',
    category: 'account',
    title: 'Forgot password',
    content:
      'If you forgot your password: 1) Click "Forgot Password" on the login page 2) Enter your registered email 3) Check your email for a reset link 4) Click the link and create a new password. The link expires in 30 minutes.',
    order: 4,
  },
  // ── Legal ─────────────────────────────────────────────────────────────────
  {
    id: 'terms_001',
    category: 'legal',
    title: 'Terms and Conditions summary',
    content:
      'By using HustleHub you agree to: be at least 18 years old, provide accurate personal information, not engage in fraud or manipulation, respect other users, and comply with all applicable local laws.',
    order: 1,
  },
  {
    id: 'privacy_001',
    category: 'legal',
    title: 'Privacy policy summary',
    content:
      'Your personal data is never sold to third parties. We use industry-standard encryption for all transactions and data storage. You can request deletion of your data at any time by contacting support.',
    order: 2,
  },
  // ── Navigation ────────────────────────────────────────────────────────────
  {
    id: 'navigation_001',
    category: 'navigation',
    title: 'How to navigate HustleHub dashboard',
    content:
      'The main dashboard has: Wallet (balance and transactions), Tasks (available work), Referrals (your referral link and stats), Chat Foreigners (earn by chatting), Profile (account settings), and Support (help and contact).',
    order: 1,
  },
  {
    id: 'navigation_002',
    category: 'navigation',
    title: 'How to contact support',
    content:
      'Contact HustleHub support by: 1) Using this AI chat assistant for instant answers 2) Clicking "Live Support" for a human agent 3) Emailing support@hustlehub.africa 4) Calling our support line during business hours (Mon–Fri 8 AM – 6 PM EAT).',
    order: 2,
  },
];

// ─── Optional: generate NVIDIA embeddings ────────────────────────────────────

async function generateEmbedding(text) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nvidia/nv-embedqa-e5-v5',
        input: text,
        input_type: 'passage',
        truncate: 'END',
      }),
    });

    if (!res.ok) {
      warn(`Embedding request failed (${res.status}): ${await res.text()}`);
      return [];
    }

    const json = await res.json();
    return json?.data?.[0]?.embedding ?? [];
  } catch (err) {
    warn(`Embedding error: ${err.message}`);
    return [];
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) fail('MONGODB_URI is not set. Pass it via --env-file-if-exists or set it in your shell.');

  log(`Connecting to MongoDB...`);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  log('Connected.');

  const useEmbeddings = !!process.env.NVIDIA_API_KEY;
  if (useEmbeddings) {
    log('NVIDIA_API_KEY found — embeddings will be generated for each document.');
  } else {
    log('NVIDIA_API_KEY not set — skipping embeddings (keyword search will still work).');
  }

  let created = 0;
  let updated = 0;

  for (const doc of DOCUMENTS) {
    process.stdout.write(`  upsert ${doc.id} ... `);

    const embeddings = useEmbeddings
      ? await generateEmbedding(doc.title + ' ' + doc.content)
      : [];

    const result = await KnowledgeBase.findOneAndUpdate(
      { id: doc.id },
      { ...doc, embeddings, updated_at: new Date() },
      { upsert: true, new: true, runValidators: true }
    );

    const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
    if (isNew) { created++; process.stdout.write('created\n'); }
    else        { updated++; process.stdout.write('updated\n'); }
  }

  log(`Done — ${created} created, ${updated} updated, ${DOCUMENTS.length} total.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
