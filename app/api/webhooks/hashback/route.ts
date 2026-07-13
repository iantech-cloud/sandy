import crypto from 'crypto'
import { connectToDatabase } from '@/app/lib/mongoose'
import { Profile, SpinWallet, AviatorWallet, CasinoWallet, Transaction } from '@/app/lib/models'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hashpay-signature')
  
  // CRITICAL: Verify signature first (prevents spoofing)
  if (!verifySignature(rawBody, signature)) {
    console.error('[Webhook] Invalid signature')
    return new Response('Invalid signature', { status: 401 })
  }

  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch (e) {
    console.error('[Webhook] Invalid JSON')
    return new Response('Invalid JSON', { status: 400 })
  }

  // Only process successful payments
  if (payload.event !== 'payment.success') {
    return new Response('OK', { status: 200 })
  }

  const {
    TransactionID,
    TransactionAmount,
    TransactionReference,
    TransactionReceipt,
    Msisdn
  } = payload

  // Parse reference: format is "type_userId_timestamp"
  const parts = TransactionReference.split('_')
  if (parts.length < 2) {
    console.error('[Webhook] Invalid reference format:', TransactionReference)
    return new Response('Invalid reference', { status: 400 })
  }

  const [type, userId] = parts

  // Verify amount matches expected for this transaction type
  const expectedAmount = getExpectedAmount(type)
  if (expectedAmount && TransactionAmount !== expectedAmount) {
    console.error('[Webhook] Amount mismatch:', { type, expected: expectedAmount, received: TransactionAmount })
    return new Response('Invalid amount', { status: 400 })
  }

  // Process transaction
  try {
    await connectToDatabase()

    switch (type) {
      case 'activation':
        await processActivation(userId, TransactionID, TransactionReceipt, TransactionAmount, Msisdn)
        break
      case 'bot_unlock':
        await processBotUnlock(userId, TransactionID, TransactionReceipt, TransactionAmount, Msisdn)
        break
      case 'spin_deposit':
        await processSpinDeposit(userId, TransactionID, TransactionReceipt, TransactionAmount, Msisdn)
        break
      case 'aviator_deposit':
        await processAviatorDeposit(userId, TransactionID, TransactionReceipt, TransactionAmount, Msisdn)
        break
      case 'casino_deposit':
        await processCasinoDeposit(userId, TransactionID, TransactionReceipt, TransactionAmount, Msisdn)
        break
      default:
        console.error('[Webhook] Unknown transaction type:', type)
        return new Response('Unknown type', { status: 400 })
    }
  } catch (error) {
    console.error('[Webhook] Processing error:', error)
    return new Response('Error', { status: 500 })
  }

  return new Response('OK', { status: 200 })
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false
  
  const secret = process.env.HASHBACK_WEBHOOK_SECRET
  if (!secret) {
    console.error('[Webhook] HASHBACK_WEBHOOK_SECRET not configured')
    return false
  }
  
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    )
  } catch (e) {
    return false
  }
}

function getExpectedAmount(type: string): number | null {
  const amounts: Record<string, number> = {
    activation: 9500,    // KES 95
    bot_unlock: 10000,   // KES 100
    spin_deposit: 3000   // KES 30
  }
  return amounts[type] || null
}

// ==================== TRANSACTION PROCESSORS ====================

async function processActivation(userId: string, txnId: string, receipt: string, amount: number, msisdn: string) {
  console.log('[Activation] Processing for userId:', userId)
  
  const user = await Profile.findById(userId)
  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  // Mark as activated
  user.activation_paid = true
  user.activated_at = new Date()
  user.activated_via = 'hashback'
  user.activation_phone = msisdn
  await user.save()

  // Credit referrer if exists
  if (user.referred_by) {
    const referrer = await Profile.findById(user.referred_by)
    if (referrer) {
      referrer.referral_earnings_cents = (referrer.referral_earnings_cents || 0) + 6500 // KES 65
      await referrer.save()
    }
  }

  // Log transaction
  await Transaction.create({
    user_id: userId,
    type: 'activation',
    amount_cents: amount,
    status: 'completed',
    provider: 'hashback',
    transaction_id: txnId,
    receipt: receipt
  })

  console.log('[Activation] Completed for userId:', userId)
}

async function processBotUnlock(userId: string, txnId: string, receipt: string, amount: number, msisdn: string) {
  console.log('[BotUnlock] Processing for userId:', userId)
  
  const user = await Profile.findById(userId)
  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  // Grant bot access
  user.bots_unlocked = (user.bots_unlocked || []).concat(['chat_foreigners'])
  user.chat_foreigners_unlocked = true
  await user.save()

  // Credit referrer (L1) and grandparent (L2)
  if (user.referred_by) {
    const referrer = await Profile.findById(user.referred_by)
    if (referrer) {
      referrer.referral_earnings_cents = (referrer.referral_earnings_cents || 0) + 7000 // KES 70
      
      if (referrer.referred_by) {
        const grandparent = await Profile.findById(referrer.referred_by)
        if (grandparent) {
          grandparent.referral_earnings_cents = (grandparent.referral_earnings_cents || 0) + 1000 // KES 10
          await grandparent.save()
        }
      }
      
      await referrer.save()
    }
  }

  // Log transaction
  await Transaction.create({
    user_id: userId,
    type: 'bot_unlock',
    amount_cents: amount,
    status: 'completed',
    provider: 'hashback',
    transaction_id: txnId,
    receipt: receipt
  })

  console.log('[BotUnlock] Completed for userId:', userId)
}

async function processSpinDeposit(userId: string, txnId: string, receipt: string, amount: number, msisdn: string) {
  console.log('[SpinDeposit] Processing for userId:', userId, 'amount:', amount)
  
  let spinWallet = await SpinWallet.findOne({ user_id: userId })
  if (!spinWallet) {
    spinWallet = new SpinWallet({
      user_id: userId,
      balance_cents: 0
    })
  }

  const companyRevenue = Math.floor(amount * 0.2) // 20%
  spinWallet.balance_cents += amount
  spinWallet.deposits = spinWallet.deposits || []
  spinWallet.deposits.push({
    amount_cents: amount,
    provider: 'hashback',
    company_revenue_cents: companyRevenue,
    deposit_at: new Date()
  })
  await spinWallet.save()

  // Log transaction
  await Transaction.create({
    user_id: userId,
    type: 'spin_deposit',
    amount_cents: amount,
    status: 'completed',
    provider: 'hashback',
    transaction_id: txnId,
    receipt: receipt
  })

  console.log('[SpinDeposit] Completed for userId:', userId)
}

async function processAviatorDeposit(userId: string, txnId: string, receipt: string, amount: number, msisdn: string) {
  console.log('[AviatorDeposit] Processing for userId:', userId, 'amount:', amount)
  
  if (amount < 5000 || amount > 100000) {
    throw new Error(`Invalid amount for Aviator: ${amount}`)
  }

  let aviatorWallet = await AviatorWallet.findOne({ user_id: userId })
  if (!aviatorWallet) {
    aviatorWallet = new AviatorWallet({
      user_id: userId,
      balance_cents: 0
    })
  }

  aviatorWallet.balance_cents += amount
  aviatorWallet.deposits = aviatorWallet.deposits || []
  aviatorWallet.deposits.push({
    amount_cents: amount,
    provider: 'hashback',
    deposit_at: new Date()
  })
  await aviatorWallet.save()

  // Log transaction
  await Transaction.create({
    user_id: userId,
    type: 'aviator_deposit',
    amount_cents: amount,
    status: 'completed',
    provider: 'hashback',
    transaction_id: txnId,
    receipt: receipt
  })

  console.log('[AviatorDeposit] Completed for userId:', userId)
}

async function processCasinoDeposit(userId: string, txnId: string, receipt: string, amount: number, msisdn: string) {
  console.log('[CasinoDeposit] Processing for userId:', userId, 'amount:', amount)
  
  if (amount < 5000 || amount > 100000) {
    throw new Error(`Invalid amount for Casino: ${amount}`)
  }

  let casinoWallet = await CasinoWallet.findOne({ user_id: userId })
  if (!casinoWallet) {
    casinoWallet = new CasinoWallet({
      user_id: userId,
      balance_cents: 0
    })
  }

  casinoWallet.balance_cents += amount
  casinoWallet.deposits = casinoWallet.deposits || []
  casinoWallet.deposits.push({
    amount_cents: amount,
    provider: 'hashback',
    deposit_at: new Date()
  })
  await casinoWallet.save()

  // Log transaction
  await Transaction.create({
    user_id: userId,
    type: 'casino_deposit',
    amount_cents: amount,
    status: 'completed',
    provider: 'hashback',
    transaction_id: txnId,
    receipt: receipt
  })

  console.log('[CasinoDeposit] Completed for userId:', userId)
}
