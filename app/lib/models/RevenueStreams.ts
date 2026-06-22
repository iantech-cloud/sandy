import mongoose, { Schema, model, models } from 'mongoose';

const getModel = (name: string, schema: Schema) => {
  return models[name] || model(name, schema);
};

// ============================================================================
// USER WALLET & ESCROW MODEL
// ============================================================================

const UserWalletSchema = new Schema({
  user_id: { type: String, ref: 'Profile', required: true, unique: true, index: true },
  
  // Available balance (can withdraw anytime)
  available_balance_cents: { type: Number, default: 0, index: true },
  
  // Locked in escrow (for job/service disputes)
  escrow_balance_cents: { type: Number, default: 0 },
  
  // Pending earnings (from uncompleted tasks)
  pending_balance_cents: { type: Number, default: 0 },
  
  // Lifetime statistics
  total_earned_cents: { type: Number, default: 0 },
  total_withdrawn_cents: { type: Number, default: 0 },
  total_refunded_cents: { type: Number, default: 0 },
  
  // Breakdown by earning type
  freelance_earnings_cents: { type: Number, default: 0 },
  tutoring_earnings_cents: { type: Number, default: 0 },
  digital_products_earnings_cents: { type: Number, default: 0 },
  ai_tasks_earnings_cents: { type: Number, default: 0 },
  local_gigs_earnings_cents: { type: Number, default: 0 },
  affiliate_earnings_cents: { type: Number, default: 0 },
  referral_bonus_cents: { type: Number, default: 0 },
  
  // Withdrawal tracking
  last_withdrawal_at: { type: Date },
  last_withdrawal_amount_cents: { type: Number },
  pending_withdrawal_cents: { type: Number, default: 0 },
  
  // Coop Bank account (for payouts)
  coop_bank_phone: { type: String },
  coop_bank_account_verified: { type: Boolean, default: false },
  
  // Account status
  wallet_frozen: { type: Boolean, default: false },
  freeze_reason: { type: String },
  
  created_at: { type: Date, default: Date.now, index: true },
  updated_at: { type: Date, default: Date.now },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const UserWallet = getModel('UserWallet', UserWalletSchema);

// ============================================================================
// 1. FREELANCE MARKETPLACE MODELS
// ============================================================================

const FreelanceJobSchema = new Schema({
  title: { type: String, required: true, maxlength: 200, index: true },
  description: { type: String, required: true },
  category: { type: String, required: true, enum: ['programming', 'design', 'writing', 'tutoring', 'seo', 'data_analysis', 'other'], index: true },
  
  budget_cents: { type: Number, required: true, min: 10000 }, // Min KES 100
  currency: { type: String, default: 'KES', maxlength: 3 },
  
  client_id: { type: String, ref: 'Profile', required: true, index: true },
  freelancer_id: { type: String, ref: 'Profile', sparse: true, index: true },
  
  status: { type: String, enum: ['open', 'in_progress', 'completed', 'disputed', 'cancelled'], default: 'open', index: true },
  
  deadline: { type: Date },
  created_at: { type: Date, default: Date.now, index: true },
  completed_at: { type: Date },
  
  commission_cents: { type: Number, default: 0 }, // HustleHub commission (15% of budget)
  freelancer_earnings_cents: { type: Number, default: 0 },
  
  // Escrow Management
  escrow_amount_cents: { type: Number, default: 0 }, // Amount held during job
  escrow_status: { type: String, enum: ['none', 'held', 'released', 'refunded'], default: 'none' },
  escrow_release_date: { type: Date }, // When escrow is released
  escrow_dispute: { type: Boolean, default: false },
  dispute_reason: { type: String },
  dispute_resolved_at: { type: Date },
  
  rating: { type: Number, min: 1, max: 5 },
  review: { type: String },
  
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  indexes: [
    { fields: { client_id: 1, created_at: -1 } },
    { fields: { freelancer_id: 1 } },
    { fields: { status: 1, created_at: -1 } },
  ]
});

export const FreelanceJob = getModel('FreelanceJob', FreelanceJobSchema);

// ============================================================================
// 2. PREMIUM MEMBERSHIP MODELS
// ============================================================================

const PremiumSubscriptionSchema = new Schema({
  user_id: { type: String, ref: 'Profile', required: true, unique: true, index: true },
  plan: { type: String, enum: ['basic', 'pro'], required: true },
  price_cents: { type: Number, required: true }, // KES 29,900 or KES 59,900
  
  status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active', index: true },
  
  subscription_started_at: { type: Date, default: Date.now },
  expires_at: { type: Date, required: true, index: true },
  
  auto_renew: { type: Boolean, default: true },
  
  benefits: [{
    name: String,
    description: String
  }],
  
  payment_id: { type: Schema.Types.ObjectId, ref: 'CoopBankPayment' },
  
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const PremiumSubscription = getModel('PremiumSubscription', PremiumSubscriptionSchema);

// ============================================================================
// 3. DIGITAL PRODUCTS STORE MODELS
// ============================================================================

const DigitalProductSchema = new Schema({
  title: { type: String, required: true, maxlength: 200, index: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['notes', 'templates', 'ebook', 'code', 'study_guides', 'other'], required: true, index: true },
  
  seller_id: { type: String, ref: 'Profile', required: true, index: true },
  
  price_cents: { type: Number, required: true, min: 5000 }, // Min KES 50
  currency: { type: String, default: 'KES', maxlength: 3 },
  
  file_url: { type: String, required: true },
  file_type: { type: String, enum: ['pdf', 'docx', 'xlsx', 'zip', 'pptx', 'other'], required: true },
  file_size_bytes: { type: Number },
  
  total_sales: { type: Number, default: 0 },
  total_revenue_cents: { type: Number, default: 0 },
  seller_earnings_cents: { type: Number, default: 0 },
  hustlehub_commission_cents: { type: Number, default: 0 },
  
  rating: { type: Number, min: 1, max: 5 },
  review_count: { type: Number, default: 0 },
  
  is_active: { type: Boolean, default: true, index: true },
  
  created_at: { type: Date, default: Date.now, index: true },
  
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const DigitalProduct = getModel('DigitalProduct', DigitalProductSchema);

// ============================================================================
// 4. ONLINE TUTORING MODELS
// ============================================================================

const TutoringSessionSchema = new Schema({
  tutor_id: { type: String, ref: 'Profile', required: true, index: true },
  student_id: { type: String, ref: 'Profile', required: true, index: true },
  
  subject: { type: String, required: true, maxlength: 100, index: true },
  level: { type: String, enum: ['primary', 'secondary', 'high_school', 'university', 'professional'], required: true },
  
  rate_per_hour_cents: { type: Number, required: true, min: 50000 }, // Min KES 500/hour
  duration_minutes: { type: Number, required: true },
  total_cost_cents: { type: Number, required: true },
  
  scheduled_at: { type: Date, required: true, index: true },
  started_at: { type: Date },
  completed_at: { type: Date },
  
  status: { type: String, enum: ['scheduled', 'in_progress', 'completed', 'cancelled'], default: 'scheduled', index: true },
  
  tutor_earnings_cents: { type: Number, default: 0 },
  hustlehub_commission_cents: { type: Number, default: 0 },
  
  student_rating: { type: Number, min: 1, max: 5 },
  student_review: { type: String },
  
  meeting_link: { type: String }, // For video sessions
  notes: { type: String },
  
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const TutoringSession = getModel('TutoringSession', TutoringSessionSchema);

// ============================================================================
// 5. AI TASK MARKETPLACE MODELS
// ============================================================================

const AITaskSchema = new Schema({
  title: { type: String, required: true, maxlength: 200, index: true },
  description: { type: String, required: true },
  task_type: { type: String, enum: ['data_labeling', 'image_annotation', 'transcription', 'prompt_evaluation', 'content_moderation', 'other'], required: true, index: true },
  
  company_id: { type: String, ref: 'Profile', required: true, index: true },
  
  reward_per_task_cents: { type: Number, required: true, min: 1000 }, // Min KES 10
  estimated_completion_time_minutes: { type: Number },
  total_tasks_available: { type: Number, required: true },
  tasks_completed: { type: Number, default: 0 },
  
  status: { type: String, enum: ['open', 'in_progress', 'completed', 'cancelled'], default: 'open', index: true },
  
  deadline: { type: Date, index: true },
  
  quality_threshold: { type: Number, default: 85 }, // 85% accuracy required
  
  hustlehub_commission_rate: { type: Number, default: 20 }, // 20% commission on total spend
  
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const AITask = getModel('AITask', AITaskSchema);

const AITaskSubmissionSchema = new Schema({
  task_id: { type: Schema.Types.ObjectId, ref: 'AITask', required: true, index: true },
  worker_id: { type: String, ref: 'Profile', required: true, index: true },
  
  submitted_at: { type: Date, default: Date.now, index: true },
  
  submission_data: { type: Schema.Types.Mixed, required: true },
  
  status: { type: String, enum: ['pending_review', 'approved', 'rejected'], default: 'pending_review', index: true },
  
  quality_score: { type: Number, min: 0, max: 100 },
  
  earned_cents: { type: Number, default: 0 },
  
  reviewed_by: { type: String, ref: 'Profile' },
  reviewed_at: { type: Date },
  review_notes: { type: String },
  
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const AITaskSubmission = getModel('AITaskSubmission', AITaskSubmissionSchema);

// ============================================================================
// 6. LOCAL GIGS MARKETPLACE MODELS
// ============================================================================

const LocalGigSchema = new Schema({
  title: { type: String, required: true, maxlength: 200, index: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['tutoring', 'photography', 'delivery', 'repairs', 'social_media', 'other'], required: true, index: true },
  
  provider_id: { type: String, ref: 'Profile', required: true, index: true },
  client_id: { type: String, ref: 'Profile', sparse: true, index: true },
  
  location: { type: String, required: true, index: true },
  
  rate_cents: { type: Number, required: true },
  currency: { type: String, default: 'KES', maxlength: 3 },
  
  status: { type: String, enum: ['available', 'booked', 'completed', 'cancelled'], default: 'available', index: true },
  
  scheduled_date: { type: Date, index: true },
  
  provider_earnings_cents: { type: Number, default: 0 },
  hustlehub_commission_cents: { type: Number, default: 0 },
  
  rating: { type: Number, min: 1, max: 5 },
  review: { type: String },
  
  created_at: { type: Date, default: Date.now, index: true },
  
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const LocalGig = getModel('LocalGig', LocalGigSchema);

// ============================================================================
// 7. EMPLOYER ACCOUNTS MODELS
// ============================================================================

const EmployerAccountSchema = new Schema({
  user_id: { type: String, ref: 'Profile', required: true, unique: true, index: true },
  company_name: { type: String, required: true, maxlength: 200, index: true },
  company_email: { type: String, required: true },
  company_website: { type: String },
  
  subscription_tier: { type: String, enum: ['starter', 'professional', 'enterprise'], required: true },
  monthly_fee_cents: { type: Number, required: true },
  
  active_job_postings: { type: Number, default: 0 },
  max_job_postings: { type: Number, required: true }, // Depends on tier
  
  featured_listings_remaining: { type: Number, default: 0 },
  
  is_verified: { type: Boolean, default: false },
  verification_date: { type: Date },
  
  status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active', index: true },
  
  subscription_started_at: { type: Date, default: Date.now },
  subscription_expires_at: { type: Date, required: true, index: true },
  
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const EmployerAccount = getModel('EmployerAccount', EmployerAccountSchema);

// ============================================================================
// 8. COOP BANK PAYMENT INTEGRATION MODELS
// ============================================================================

const CoopBankPaymentSchema = new Schema({
  user_id: { type: String, ref: 'Profile', required: true, index: true },
  
  amount_cents: { type: Number, required: true },
  currency: { type: String, default: 'KES', maxlength: 3 },
  
  payment_type: { type: String, enum: ['activation', 'subscription', 'purchase', 'withdrawal', 'commission_payout'], required: true, index: true },
  
  reference_id: { type: String, required: true, unique: true, index: true }, // Linked to Job, Digital Product, Subscription, etc.
  reference_type: { type: String, enum: ['freelance_job', 'premium_subscription', 'digital_product', 'tutoring_session', 'ai_task', 'local_gig', 'employer_subscription', 'activation_fee'], required: true },
  
  phone_number: { type: String, required: true }, // M-Pesa or bank phone
  
  // Coop Bank API Response
  coop_transaction_id: { type: String, index: true },
  coop_response: { type: Schema.Types.Mixed },
  
  status: { type: String, enum: ['pending', 'completed', 'failed', 'cancelled'], default: 'pending', index: true },
  
  initiated_at: { type: Date, default: Date.now },
  completed_at: { type: Date },
  failed_reason: { type: String },
  
  // Retry tracking
  retry_count: { type: Number, default: 0 },
  last_retry_at: { type: Date },
  
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  indexes: [
    { fields: { user_id: 1, created_at: -1 } },
    { fields: { payment_type: 1, status: 1 } },
    { fields: { reference_id: 1, reference_type: 1 } },
    { fields: { coop_transaction_id: 1 } },
  ]
});

export const CoopBankPayment = getModel('CoopBankPayment', CoopBankPaymentSchema);

// ============================================================================
// 9. TRANSACTION LEDGER MODEL
// ============================================================================

const TransactionLedgerSchema = new Schema({
  user_id: { type: String, ref: 'Profile', required: true, index: true },
  
  transaction_type: { type: String, enum: ['credit', 'debit'], required: true },
  amount_cents: { type: Number, required: true },
  
  source: { type: String, enum: ['freelance_payment', 'subscription_earnings', 'digital_product_sale', 'tutoring', 'ai_task', 'local_gig', 'affiliate_commission', 'referral_bonus', 'platform_fee', 'payout'], required: true, index: true },
  
  reference_id: { type: String, sparse: true, index: true },
  reference_type: { type: String, sparse: true },
  
  balance_after_cents: { type: Number, required: true },
  
  description: { type: String },
  
  status: { type: String, enum: ['completed', 'pending', 'reversed'], default: 'completed', index: true },
  
  created_at: { type: Date, default: Date.now, index: true },
  
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: { createdAt: 'created_at' },
  indexes: [
    { fields: { user_id: 1, created_at: -1 } },
    { fields: { source: 1, created_at: -1 } },
    { fields: { transaction_type: 1, created_at: -1 } },
  ]
});

export const TransactionLedger = getModel('TransactionLedger', TransactionLedgerSchema);
