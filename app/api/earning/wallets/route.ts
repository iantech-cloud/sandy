import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/app/lib/mongoose'
import { EarningWallet } from '@/app/lib/models'

const walletTypes = ['deals', 'gigs', 'cashback', 'analyzer', 'resources'] as const

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ success: false, message: 'Authentication required.' }, { status: 401 })
  await connectToDatabase()
  const wallets = await Promise.all(walletTypes.map(async (wallet_type) => {
    const wallet = await EarningWallet.findOneAndUpdate({ user_id: userId, wallet_type }, { $setOnInsert: { user_id: userId, wallet_type } }, { upsert: true, new: true }).lean()
    return wallet
  }))
  return NextResponse.json({ success: true, wallets })
}
