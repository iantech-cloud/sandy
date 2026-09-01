import { Schema, model, models } from 'mongoose'

const getModel = (name: string, schema: Schema) => models[name] || model(name, schema)

const WalletSchema = new Schema({
  user_id: { type: String, required: true, index: true },
  wallet_type: { type: String, required: true, enum: ['deals', 'gigs', 'cashback', 'analyzer', 'resources'] },
  available_cents: { type: Number, default: 0, min: 0 },
  pending_cents: { type: Number, default: 0, min: 0 },
  lifetime_earned_cents: { type: Number, default: 0, min: 0 },
  lifetime_withdrawn_cents: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: 'KES' },
}, { timestamps: true })
WalletSchema.index({ user_id: 1, wallet_type: 1 }, { unique: true })
export const EarningWallet = getModel('EarningWallet', WalletSchema)

const LedgerSchema = new Schema({
  user_id: { type: String, required: true, index: true },
  wallet_type: { type: String, required: true, enum: ['deals', 'gigs', 'cashback', 'analyzer', 'resources'] },
  type: { type: String, required: true, enum: ['credit', 'debit', 'hold', 'release', 'refund', 'withdrawal', 'commission', 'cashback'] },
  amount_cents: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['pending', 'available', 'settled', 'reversed'], default: 'pending' },
  idempotency_key: { type: String, required: true, unique: true },
  reference_type: String,
  reference_id: String,
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true })
LedgerSchema.index({ user_id: 1, wallet_type: 1, createdAt: -1 })
export const EarningLedger = getModel('EarningLedger', LedgerSchema)

const GigOrderSchema = new Schema({
  buyer_id: { type: String, required: true, index: true }, seller_id: { type: String, required: true, index: true },
  service_id: { type: Schema.Types.ObjectId, required: true }, amount_cents: { type: Number, required: true, min: 100 },
  platform_fee_cents: { type: Number, required: true, min: 0 }, seller_amount_cents: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['pending_payment', 'in_escrow', 'delivered', 'completed', 'disputed', 'refunded'], default: 'pending_payment', index: true },
  delivery_note: String, dispute_reason: String, payment_reference: String,
}, { timestamps: true })
export const GigOrder = getModel('GigOrder', GigOrderSchema)

const CashbackSchema = new Schema({
  user_id: { type: String, required: true, index: true }, provider: { type: String, required: true }, click_id: { type: String, required: true, unique: true },
  order_id: String, order_amount_cents: Number, commission_cents: Number, cashback_cents: Number, platform_cents: Number,
  status: { type: String, enum: ['clicked', 'pending', 'confirmed', 'rejected', 'paid'], default: 'clicked', index: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true })
export const CashbackEvent = getModel('CashbackEvent', CashbackSchema)

const ResourcePurchaseSchema = new Schema({
  user_id: { type: String, required: true, index: true }, resource_id: { type: Schema.Types.ObjectId, required: true },
  amount_cents: { type: Number, required: true, min: 1 }, payment_reference: { type: String, required: true, unique: true },
  entitlement_token_hash: { type: String, required: true, unique: true }, expires_at: Date, downloaded_at: Date,
  status: { type: String, enum: ['pending', 'paid', 'refunded', 'revoked'], default: 'pending', index: true },
}, { timestamps: true })
export const ResourcePurchase = getModel('ResourcePurchase', ResourcePurchaseSchema)

const PayoutSchema = new Schema({
  user_id: { type: String, required: true, index: true }, wallet_type: { type: String, required: true }, amount_cents: { type: Number, required: true, min: 1 },
  phone: { type: String, required: true }, request_id: { type: String, required: true, unique: true }, mpesa_receipt: String,
  status: { type: String, enum: ['requested', 'submitted', 'completed', 'failed', 'reversed'], default: 'requested', index: true }, failure_reason: String,
}, { timestamps: true })
export const EarningPayout = getModel('EarningPayout', PayoutSchema)

const GigServiceSchema = new Schema({
  seller_id: { type: String, required: true, index: true }, title: { type: String, required: true, maxlength: 120 }, description: { type: String, required: true, maxlength: 4000 }, category: { type: String, required: true, index: true }, price_cents: { type: Number, required: true, min: 100 }, delivery_days: { type: Number, required: true, min: 1, max: 90 }, status: { type: String, enum: ['draft', 'published', 'paused'], default: 'published', index: true }, rating: { type: Number, default: 0, min: 0, max: 5 }, review_count: { type: Number, default: 0, min: 0 },
}, { timestamps: true })
GigServiceSchema.index({ category: 1, status: 1, createdAt: -1 })
export const GigService = getModel('GigService', GigServiceSchema)

const ResourceSchema = new Schema({
  seller_id: { type: String, required: true, index: true }, title: { type: String, required: true, maxlength: 160 }, description: { type: String, required: true, maxlength: 5000 }, category: { type: String, required: true, index: true }, price_cents: { type: Number, required: true, min: 1 }, blob_pathname: { type: String, required: true }, content_type: { type: String, required: true }, file_size: { type: Number, required: true, min: 1 }, status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
}, { timestamps: true })
ResourceSchema.index({ status: 1, category: 1, createdAt: -1 })
export const DigitalResource = getModel('DigitalResource', ResourceSchema)

const ReferralSchema = new Schema({
  referrer_id: { type: String, required: true, index: true }, referred_id: { type: String, required: true, unique: true }, status: { type: String, enum: ['pending', 'qualified', 'paid', 'reversed'], default: 'pending', index: true }, bonus_cents: { type: Number, default: 0, min: 0 }, qualified_at: Date,
}, { timestamps: true })
export const Referral = getModel('Referral', ReferralSchema)

const AnalyzerSchema = new Schema({
  user_id: { type: String, required: true, index: true }, url: { type: String, required: true }, normalized_url: { type: String, default: '' }, provider: String, current_price_cents: Number, fair_price_cents: Number, price_history: { type: [Schema.Types.Mixed], default: [] }, alternatives: { type: [Schema.Types.Mixed], default: [] }, model_version: String, error: String,
  score: { type: Number, min: 0, max: 100 }, result: { type: Schema.Types.Mixed }, status: { type: String, enum: ['queued', 'processing', 'completed', 'failed'], default: 'queued', index: true },
}, { timestamps: true })
export const ProductAnalysis = getModel('ProductAnalysis', AnalyzerSchema)
