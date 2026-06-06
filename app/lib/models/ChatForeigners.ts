// app/lib/models/ChatForeigners.ts
import mongoose, { Schema, model, models } from 'mongoose';

const getModel = (name: string, schema: Schema) => {
  return models[name] || model(name, schema);
};

// ========================================================================
// Chat Foreigners Bot Model
// ========================================================================
const ChatForeignersBotSchema = new Schema({
  name: { 
    type: String, 
    required: true,
    index: true 
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },
  description: { 
    type: String 
  },
  bio: {
    type: String,
  },
  personalityType: {
    type: String,
  },
  speakingStyle: {
    type: String,
  },
  mood: {
    type: String,
  },
  interests: {
    type: String,
  },
  avatar_url: { 
    type: String 
  },
  category: { 
    type: String,
    default: 'general'
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true 
  },
  unlockCost_cents: {
    type: Number,
    default: 9000, // 90 KSh
  },
  renewalCost_cents: {
    type: Number,
    default: 5000, // 50 KSh (if applicable)
  },
  messageLimitForMilestone: {
    type: Number,
    default: 20,
  },
  milestoneBonus_cents: {
    type: Number,
    default: 1000, // 10 KSh
  },
  training_data: {
    type: String,
    default: '{}',
  },
  cloned_from: {
    type: Schema.Types.ObjectId,
    ref: 'ChatForeignersBot',
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  updated_at: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  indexes: [
    { fields: { isActive: 1 } },
    { fields: { category: 1 } },
  ]
});

// ========================================================================
// Chat Foreigners Bot Access Model (tracks which users have access to which bots)
// ========================================================================
const ChatForeignersBotAccessSchema = new Schema({
  user_id: {
    type: String,
    ref: 'Profile',
    required: true,
    index: true
  },
  bot_id: {
    type: Schema.Types.ObjectId,
    ref: 'ChatForeignersBot',
    required: true,
    index: true
  },
  unlockedAt: {
    type: Date,
    default: Date.now,
  },
  messageCount: {
    type: Number,
    default: 0,
  },
  firstMilestoneComplete: {
    type: Boolean,
    default: false,
  },
  milestoneCompletedAt: {
    type: Date
  },
  expiresAt: {
    type: Date // For subscription-based access
  },
  isClosed: {
    type: Boolean,
    default: false,
    index: true,
  },
  closedAt: {
    type: Date,
  },
  chatCreditPaid: {
    type: Boolean,
    default: false,
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  updated_at: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  indexes: [
    { fields: { user_id: 1, bot_id: 1 }, unique: true },
    { fields: { user_id: 1 } },
    { fields: { bot_id: 1 } },
  ]
});

// ========================================================================
// Chat Foreigners M-Pesa Transaction Model (extends base MpesaTransaction)
// ========================================================================
const ChatForeignersMpesaTransactionSchema = new Schema({
  checkout_request_id: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  merchant_request_id: {
    type: String,
    index: true
  },
  mpesa_receipt_number: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  user_id: {
    type: String,
    ref: 'Profile',
    required: true,
    index: true
  },
  amount_cents: {
    type: Number,
    required: true
  },
  phone_number: {
    type: String,
    required: true,
    index: true
  },
  transaction_type: {
    type: String,
    enum: ['chat_foreigners_unlock', 'chat_foreigners_deposit'],
    required: true,
    index: true
  },
  bot_id: {
    type: Schema.Types.ObjectId,
    ref: 'ChatForeignersBot',
    index: true // Only for unlock transactions
  },
  result_code: {
    type: Number,
    index: true
  },
  result_desc: {
    type: String
  },
  status: {
    type: String,
    enum: ['initiated', 'pending', 'completed', 'failed', 'cancelled', 'timeout'],
    default: 'initiated',
    index: true
  },
  initiated_at: {
    type: Date,
    default: Date.now
  },
  callback_received_at: {
    type: Date
  },
  completed_at: {
    type: Date
  },
  failed_at: {
    type: Date
  },
  callback_payload: {
    type: Schema.Types.Mixed
  },
  stk_push_response: {
    type: Schema.Types.Mixed
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: { createdAt: 'created_at' },
  indexes: [
    { fields: { user_id: 1, status: 1 } },
    { fields: { checkout_request_id: 1 } },
  ]
});

// ========================================================================
// Chat Foreigners Payment Model (unlock/renewal transactions)
// ========================================================================
const ChatForeignersPaymentSchema = new Schema({
  user_id: {
    type: String,
    ref: 'Profile',
    required: true,
    index: true
  },
  bot_id: {
    type: Schema.Types.ObjectId,
    ref: 'ChatForeignersBot',
    required: true,
    index: true
  },
  paymentType: {
    type: String,
    enum: ['bot_unlock', 'bot_renewal'],
    default: 'bot_unlock',
  },
  amount_cents: {
    type: Number,
    required: true
  },
  phone_number: {
    type: String,
    required: true,
  },
  mpesa_transaction_id: {
    type: Schema.Types.ObjectId,
    ref: 'ChatForeignersMpesaTransaction',
    index: true
  },
  mpesaReceiptNumber: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  completed_at: {
    type: Date
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  indexes: [
    { fields: { user_id: 1, bot_id: 1 } },
    { fields: { status: 1 } },
  ]
});

// ========================================================================
// Chat Foreigners Referral Earnings Model
// ========================================================================
const ChatForeignersReferralEarningSchema = new Schema({
  referrer_id: {
    type: String,
    ref: 'Profile',
    required: true,
    index: true
  },
  referee_id: {
    type: String,
    ref: 'Profile',
    required: true,
    index: true
  },
  bot_id: {
    type: Schema.Types.ObjectId,
    ref: 'ChatForeignersBot',
    required: true,
    index: true
  },
  earningType: {
    type: String,
    enum: ['initial_unlock', 'milestone_bonus'],
    default: 'initial_unlock',
  },
  amount_cents: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  payment_id: {
    type: Schema.Types.ObjectId,
    ref: 'ChatForeignersPayment',
    index: true
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  completed_at: {
    type: Date
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  indexes: [
    { fields: { referrer_id: 1 } },
    { fields: { referee_id: 1, bot_id: 1 }, unique: true },
    { fields: { status: 1 } },
  ]
});

// ========================================================================
// Chat Foreigners Wallet Model
// ========================================================================
const ChatForeignersWalletSchema = new Schema({
  user_id: {
    type: String,
    ref: 'Profile',
    required: true,
    unique: true,
    index: true
  },
  balance_cents: {
    type: Number,
    default: 0,
  },
  total_earned_cents: {
    type: Number,
    default: 0,
  },
  total_deposited_cents: {
    type: Number,
    default: 0,
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  updated_at: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  indexes: [
    { fields: { user_id: 1 } },
  ]
});

// ========================================================================
// Chat Foreigners Transaction Model (wallet transaction history)
// ========================================================================
const ChatForeignersTransactionSchema = new Schema({
  user_id: {
    type: String,
    ref: 'Profile',
    required: true,
    index: true
  },
  amount_cents: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['CHAT_DEPOSIT', 'CHAT_EARNINGS', 'CHAT_WITHDRAWAL'],
    required: true,
    index: true
  },
  description: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  mpesa_transaction_id: {
    type: Schema.Types.ObjectId,
    ref: 'ChatForeignersMpesaTransaction',
    index: true
  },
  target_type: {
    type: String,
    enum: ['user', 'company'],
    default: 'user',
    index: true
  },
  target_id: {
    type: String,
    required: true,
    index: true
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  indexes: [
    { fields: { user_id: 1, created_at: -1 } },
    { fields: { type: 1 } },
  ]
});

// ========================================================================
// Chat Foreigners Profile Model (user chat profile data)
// ========================================================================
const ChatForeignersProfileSchema = new Schema({
  user_id: {
    type: String,
    ref: 'Profile',
    required: true,
    unique: true,
    index: true
  },
  displayName: {
    type: String
  },
  bio: {
    type: String
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  referralLink: {
    type: String
  },
  totalBotUnlocks: {
    type: Number,
    default: 0,
  },
  totalEarnings_cents: {
    type: Number,
    default: 0,
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  updated_at: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  indexes: [
    { fields: { user_id: 1 } },
    { fields: { referralCode: 1 } },
  ]
});

// ========================================================================
// Export Models
// ========================================================================
export const ChatForeignersBot = getModel('ChatForeignersBot', ChatForeignersBotSchema);
export const ChatForeignersBotAccess = getModel('ChatForeignersBotAccess', ChatForeignersBotAccessSchema);
export const ChatForeignersMpesaTransaction = getModel('ChatForeignersMpesaTransaction', ChatForeignersMpesaTransactionSchema);
export const ChatForeignersPayment = getModel('ChatForeignersPayment', ChatForeignersPaymentSchema);
export const ChatForeignersReferralEarning = getModel('ChatForeignersReferralEarning', ChatForeignersReferralEarningSchema);
export const ChatForeignersWallet = getModel('ChatForeignersWallet', ChatForeignersWalletSchema);
export const ChatForeignersTransaction = getModel('ChatForeignersTransaction', ChatForeignersTransactionSchema);
export const ChatForeignersProfile = getModel('ChatForeignersProfile', ChatForeignersProfileSchema);
