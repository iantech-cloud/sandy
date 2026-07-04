// app/api/payments/coop-bank/recover/route.ts
//
// PAYMENT RECOVERY JOB
// --------------------------------------------------------------------------
// Safety net that guarantees "payment success != lost activation".
//
// Run this on a schedule (e.g. every 5 minutes) via cron:
//   */5 * * * * curl -s -H "x-cron-secret: $CRON_SECRET" \
//     https://YOUR_DOMAIN/api/payments/coop-bank/recover
//
// It performs two passes:
//   1. ACTIVATION RECOVERY — finds activation payments that were PAID but the
//      account was never activated (status='completed', processed_by_system
//      =false) and completes them. completeActivationAfterPayment is
//      idempotent, so this is always safe to re-run.
//   2. STUCK TRANSACTION RECOVERY — finds STK transactions still stuck in
//      'initiated'/'pending' beyond a grace window (callback never arrived),
//      polls the Co-op Bank Enquiry API for the real status, persists it, and
//      drives any newly-completed activations to completion.
//
// GET  -> runs recovery and also returns a summary of currently stuck records
//         (doubles as a lightweight failed-payments dashboard data source).
// POST -> same as GET (provided for cron tools that POST).
// --------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import {
  connectToDatabase,
  MpesaTransaction,
  ActivationPayment,
  Transaction,
} from '@/app/lib/models';
import { CoopBankService, createCoopBankService } from '@/app/lib/services/coop-bank';
import { completeActivationAfterPayment } from '@/app/actions/activation';

// Only reconcile transactions older than this (gives the normal callback time
// to land first). 3 minutes is a safe window for STK push.
const STUCK_GRACE_MS = 3 * 60 * 1000;
// Ignore very old abandoned attempts so we don't poll the bank forever.
const STUCK_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Cap per run so a single invocation stays fast and bounded.
const MAX_PER_RUN = 50;

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  // If no secret is configured, allow (so the user can deploy and wire cron
  // immediately) but warn — they should set CRON_SECRET to lock this down.
  if (!expected) {
    console.warn('[Recover] CRON_SECRET not set — recovery endpoint is unprotected. Set CRON_SECRET to secure it.');
    return true;
  }
  const headerSecret =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.nextUrl.searchParams.get('secret');
  return headerSecret === expected;
}

async function runRecovery() {
  await connectToDatabase();

  // Match the codebase convention: Mongoose models are loosely typed here.
  const MpesaTxn = MpesaTransaction as any;
  const ActPay = ActivationPayment as any;

  const summary = {
    activations_recovered: 0,
    activations_failed: 0,
    stuck_polled: 0,
    stuck_completed: 0,
    stuck_failed: 0,
    errors: [] as string[],
  };

  // ── PASS 1: paid-but-not-activated ───────────────────────────────────────
  const paidNotActivated = await ActPay.find({
    status: 'completed',
    processed_by_system: { $ne: true },
  })
    .sort({ paid_at: 1 })
    .limit(MAX_PER_RUN);

  console.log(`[Recover] Pass 1: ${paidNotActivated.length} paid-but-not-activated payment(s)`);

  for (const payment of paidNotActivated) {
    try {
      const result = await completeActivationAfterPayment(payment._id.toString());
      if (result.success) {
        summary.activations_recovered++;
        console.log(`[Recover] Activated payment ${payment._id}`);
      } else {
        summary.activations_failed++;
        summary.errors.push(`activation ${payment._id}: ${result.message}`);
      }
    } catch (err) {
      summary.activations_failed++;
      summary.errors.push(
        `activation ${payment._id}: ${err instanceof Error ? err.message : 'unknown error'}`
      );
    }
  }

  // ── PASS 2: stuck 'initiated'/'pending' transactions ─────────────────────
  const now = Date.now();
  const stuckBefore = new Date(now - STUCK_GRACE_MS);
  const stuckAfter = new Date(now - STUCK_MAX_AGE_MS);

  const stuckTransactions = await MpesaTxn.find({
    status: { $in: ['initiated', 'pending'] },
    created_at: { $lte: stuckBefore, $gte: stuckAfter },
  })
    .sort({ created_at: 1 })
    .limit(MAX_PER_RUN);

  console.log(`[Recover] Pass 2: ${stuckTransactions.length} stuck transaction(s) to poll`);

  let coopBank: ReturnType<typeof createCoopBankService> | null = null;
  try {
    coopBank = createCoopBankService();
  } catch (err) {
    summary.errors.push(
      `coop service init: ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }

  if (coopBank) {
    for (const txn of stuckTransactions) {
      const messageReference = txn.checkout_request_id;
      if (!messageReference) continue;

      try {
        const statusResponse = await coopBank.getTransactionStatus(messageReference);
        const mappedStatus = CoopBankService.mapResponseCode(statusResponse.ResponseCode);
        summary.stuck_polled++;

        // Only act on terminal states. Anything else (still pending at the
        // bank) is left for the next run.
        const isTerminal =
          mappedStatus === 'completed' ||
          mappedStatus === 'failed' ||
          mappedStatus === 'cancelled' ||
          mappedStatus === 'timeout';
        if (!isTerminal) {
          continue;
        }

        const safeResultCode = parseInt(statusResponse.ResponseCode || '1', 10) || 1;

        if (mappedStatus === 'completed') {
          txn.status = 'completed';
          txn.result_code = safeResultCode;
          txn.result_desc = statusResponse.ResponseDescription || '';
          txn.completed_at = new Date();
          
          // Persist M-Pesa receipt and operator transaction ID
          if (statusResponse.ReceiptNumber) {
            txn.mpesa_receipt_number = statusResponse.ReceiptNumber;
          }
          if (statusResponse.OperatorTxnID) {
            txn.operator_txn_id = statusResponse.OperatorTxnID;
          }
          
          await txn.save();
          summary.stuck_completed++;
          
          // Also update the linked Transaction ledger record with the transaction code
          if (statusResponse.OperatorTxnID) {
            await (Transaction as any).findOneAndUpdate(
              { mpesa_transaction_id: txn._id },
              { transaction_code: statusResponse.OperatorTxnID }
            );
          }

          // If this is an activation, drive it to completion.
          const isActivation =
            txn.is_activation_payment || txn.metadata?.deposit_type === 'activation';

          if (isActivation) {
            const activationPayment = await ActPay.findOne({
              $or: [
                { checkout_request_id: messageReference },
                { mpesa_transaction_id: txn._id },
              ],
            });

            if (activationPayment) {
              if (activationPayment.status !== 'completed') {
                activationPayment.status = 'completed';
                activationPayment.paid_at = new Date();
                activationPayment.mpesa_receipt_number =
                  txn.mpesa_receipt_number || activationPayment.mpesa_receipt_number;
                await activationPayment.save();
              }
              try {
                await completeActivationAfterPayment(activationPayment._id.toString());
                summary.activations_recovered++;
              } catch (actErr) {
                summary.activations_failed++;
                summary.errors.push(
                  `stuck-activation ${activationPayment._id}: ${actErr instanceof Error ? actErr.message : 'unknown error'}`
                );
              }
            }
          }
          // NOTE: stuck wallet/spin/chat deposits are intentionally NOT credited
          // here to avoid duplicating crediting logic. They are credited by the
          // callback (idempotent) and by the user-facing status poll. Their
          // status is still reconciled above so they stop showing as stuck.
        } else if (['failed', 'cancelled', 'timeout'].includes(mappedStatus)) {
          txn.status = mappedStatus;
          txn.result_code = safeResultCode;
          txn.result_desc = statusResponse.ResponseDescription || '';
          txn.failed_at = new Date();
          
          // Persist M-Pesa receipt and operator transaction ID even for failed transactions
          if (statusResponse.ReceiptNumber) {
            txn.mpesa_receipt_number = statusResponse.ReceiptNumber;
          }
          if (statusResponse.OperatorTxnID) {
            txn.operator_txn_id = statusResponse.OperatorTxnID;
          }
          
          await txn.save();
          summary.stuck_failed++;

          // BUG FIX: Also reconcile the linked ledger row so it stops showing as 'processing'
          // This closes the loop for wallet deposits that only have the callback as recovery path
          const updateLedgerData: any = { status: mappedStatus };
          if (statusResponse.OperatorTxnID) {
            updateLedgerData.transaction_code = statusResponse.OperatorTxnID;
          }
          await (Transaction as any).findOneAndUpdate(
            { mpesa_transaction_id: txn._id },
            updateLedgerData
          );
        }
      } catch (err) {
        summary.errors.push(
          `poll ${messageReference}: ${err instanceof Error ? err.message : 'unknown error'}`
        );
      }
    }
  }

  return summary;
}

// Snapshot of records that still need attention (failed-payments dashboard data).
async function getStuckSnapshot() {
  const paidNotActivated = await (ActivationPayment as any).countDocuments({
    status: 'completed',
    processed_by_system: { $ne: true },
  });

  const stuckTransactions = await (MpesaTransaction as any).countDocuments({
    status: { $in: ['initiated', 'pending'] },
    created_at: { $lte: new Date(Date.now() - STUCK_GRACE_MS) },
  });

  return { paid_not_activated: paidNotActivated, stuck_transactions: stuckTransactions };
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const startedAt = Date.now();
    const summary = await runRecovery();
    const remaining = await getStuckSnapshot();

    return NextResponse.json({
      success: true,
      ran_in_ms: Date.now() - startedAt,
      recovered: summary,
      remaining,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Recover] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Recovery failed',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
