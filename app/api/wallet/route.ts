import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/auth';
import { connectToDatabase } from '@/app/lib/db';
import { UserWallet, TransactionLedger } from '@/app/lib/models/RevenueStreams';
import { Profile } from '@/app/lib/models';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const wallet = await UserWallet.findOne({ user_id: session.user.id });
    
    if (!wallet) {
      // Create wallet if doesn't exist
      const newWallet = new UserWallet({
        user_id: session.user.id,
        available_balance_cents: 0,
      });
      await newWallet.save();
      return NextResponse.json({ success: true, data: newWallet });
    }

    return NextResponse.json({ success: true, data: wallet });
  } catch (error) {
    console.error('[Wallet API] Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, amount_cents, description, reference_id, reference_type, source } = body;

    await connectToDatabase();

    const wallet = await UserWallet.findOne({ user_id: session.user.id });
    if (!wallet) {
      return NextResponse.json({ success: false, message: 'Wallet not found' }, { status: 404 });
    }

    // Check if wallet is frozen
    if (wallet.wallet_frozen) {
      return NextResponse.json({ success: false, message: `Wallet frozen: ${wallet.freeze_reason}` }, { status: 403 });
    }

    if (action === 'withdraw') {
      if (amount_cents > wallet.available_balance_cents) {
        return NextResponse.json({ success: false, message: 'Insufficient balance' }, { status: 400 });
      }

      // Deduct from available balance
      wallet.available_balance_cents -= amount_cents;
      wallet.total_withdrawn_cents += amount_cents;
      wallet.pending_withdrawal_cents = amount_cents;
      wallet.last_withdrawal_at = new Date();
      wallet.last_withdrawal_amount_cents = amount_cents;

      await wallet.save();

      // Log transaction
      const ledger = new TransactionLedger({
        user_id: session.user.id,
        transaction_type: 'debit',
        amount_cents,
        source: 'payout',
        reference_id,
        description: `Withdrawal of KES ${(amount_cents / 100).toFixed(2)}`,
        balance_after_cents: wallet.available_balance_cents,
        status: 'pending',
      });
      await ledger.save();

      return NextResponse.json({ success: true, data: wallet, message: 'Withdrawal initiated' });
    }

    if (action === 'hold_escrow') {
      // Move from available to escrow
      if (amount_cents > wallet.available_balance_cents) {
        return NextResponse.json({ success: false, message: 'Insufficient balance' }, { status: 400 });
      }

      wallet.available_balance_cents -= amount_cents;
      wallet.escrow_balance_cents += amount_cents;
      await wallet.save();

      return NextResponse.json({ success: true, data: wallet, message: 'Amount held in escrow' });
    }

    if (action === 'release_escrow') {
      // Move from escrow back to available
      if (amount_cents > wallet.escrow_balance_cents) {
        return NextResponse.json({ success: false, message: 'Insufficient escrow balance' }, { status: 400 });
      }

      wallet.escrow_balance_cents -= amount_cents;
      wallet.available_balance_cents += amount_cents;
      await wallet.save();

      return NextResponse.json({ success: true, data: wallet, message: 'Escrow released to available balance' });
    }

    if (action === 'add_earnings') {
      // Add earnings to available balance
      wallet.available_balance_cents += amount_cents;
      wallet.total_earned_cents += amount_cents;

      // Update category-specific earnings
      if (source === 'freelance') wallet.freelance_earnings_cents += amount_cents;
      else if (source === 'tutoring') wallet.tutoring_earnings_cents += amount_cents;
      else if (source === 'digital_products') wallet.digital_products_earnings_cents += amount_cents;
      else if (source === 'ai_tasks') wallet.ai_tasks_earnings_cents += amount_cents;
      else if (source === 'local_gigs') wallet.local_gigs_earnings_cents += amount_cents;
      else if (source === 'affiliate') wallet.affiliate_earnings_cents += amount_cents;
      else if (source === 'referral') wallet.referral_bonus_cents += amount_cents;

      await wallet.save();

      // Log transaction
      const ledger = new TransactionLedger({
        user_id: session.user.id,
        transaction_type: 'credit',
        amount_cents,
        source: source || 'freelance_payment',
        reference_id,
        reference_type,
        description,
        balance_after_cents: wallet.available_balance_cents,
        status: 'completed',
      });
      await ledger.save();

      return NextResponse.json({ success: true, data: wallet, message: 'Earnings added' });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Wallet API] Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
