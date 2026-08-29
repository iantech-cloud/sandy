import { connectToDatabase, EarningLedger, EarningWallet } from '@/app/lib/models'

export type Stream = 'gigs' | 'cashback' | 'analyzer' | 'resources' | 'deals'

export async function postLedgerEntry(input: { userId: string; stream: Stream; amountCents: number; type: 'credit' | 'debit' | 'hold' | 'release' | 'reverse'; idempotencyKey: string; source: string; metadata?: Record<string, unknown> }) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error('Invalid amount')
  await connectToDatabase()
  const existing = await EarningLedger.findOne({ idempotency_key: input.idempotencyKey }).lean()
  if (existing) return existing
  const wallet = await EarningWallet.findOneAndUpdate({ user_id: input.userId, stream: input.stream }, { $setOnInsert: { user_id: input.userId, stream: input.stream, available_cents: 0, pending_cents: 0, held_cents: 0, currency: 'KES' } }, { upsert: true, new: true })
  const delta = input.type === 'credit' || input.type === 'release' ? input.amountCents : -input.amountCents
  const field = input.type === 'hold' ? 'available_cents' : input.type === 'release' ? 'held_cents' : input.type === 'reverse' ? 'available_cents' : 'available_cents'
  if ((field === 'available_cents' && delta < 0 && wallet.available_cents < input.amountCents) || (field === 'held_cents' && delta < 0 && wallet.held_cents < input.amountCents)) throw new Error('Insufficient funds')
  await EarningWallet.updateOne({ _id: wallet._id }, { $inc: { [field]: delta, ...(input.type === 'hold' ? { held_cents: input.amountCents } : {}) } })
  return EarningLedger.create({ user_id: input.userId, stream: input.stream, amount_cents: input.amountCents, type: input.type, idempotency_key: input.idempotencyKey, source: input.source, metadata: input.metadata ?? {}, status: 'posted' })
}
