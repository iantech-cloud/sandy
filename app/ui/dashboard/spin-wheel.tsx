'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Zap, Plus, RotateCcw, X, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react'
import { depositSpinWalletViaMpesa, checkSpinDepositMpesaStatus } from '@/app/actions/spin'
import { transferMainToSpinWallet } from '@/app/actions/spin-wallet'

// ─── Prize configuration ───────────────────────────────────────────────────
// NOTE: The wheel ALWAYS lands on "Try Again" (index 9) - the other values are displayed for reference
const PRIZES = [
  { type: 'KES_10000',       icon: '🎁', label: 'KES 10,000',      prob:  0, color: '#10B981' },
  { type: 'KES_5000',        icon: '💵', label: 'KES 5,000',       prob:  0, color: '#8B5CF6' },
  { type: 'KES_2500',        icon: '💴', label: 'KES 2,500',       prob:  0, color: '#EC4899' },
  { type: 'KES_1000',        icon: '💶', label: 'KES 1,000',       prob:  0, color: '#F59E0B' },
  { type: 'KES_500',         icon: '💷', label: 'KES 500',         prob:  0, color: '#06B6D4' },
  { type: 'KES_200',         icon: '💸', label: 'KES 200',         prob:  0, color: '#6366F1' },
  { type: 'KES_100',         icon: '🏷️', label: 'KES 100',         prob:  0, color: '#14B8A6' },
  { type: 'KES_50',          icon: '🔖', label: 'KES 50',          prob:  0, color: '#F97316' },
  { type: 'FREE_SPIN',       icon: '🎟️', label: 'Free Spin',       prob:  0, color: '#3B82F6' },
  { type: 'ZERO',            icon: '⭕', label: 'Try Again',        prob: 100, color: '#EF4444' },
] as const

type PrizeType = typeof PRIZES[number]['type']

const MIN_SPIN_COST_CENTS = 3000  // KES 30 minimum
const MAX_SPIN_COST_CENTS = 7000000  // KES 70,000 maximum
const SEGMENT_ANGLE   = 360 / PRIZES.length

// ─── Helpers ───────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function fmtKes(cents: number) {
  return `KES ${(cents / 100).toFixed(2)}`
}

function prizeByType(type: string) {
  return PRIZES.find(p => p.type === type) ?? PRIZES[PRIZES.length - 1]
}

// Extract messageReference from Co-op Bank deposit response
function extractMessageReference(data: any): string | undefined {
  return (
    data?.messageReference ||
    data?.checkoutRequestID ||  // Legacy M-Pesa fallback
    data?.checkoutRequestId ||  // camelCase fallback
    data?.CheckoutRequestID ||  // PascalCase fallback
    undefined
  )
}

// ─── Types ─────────────────────────────────────────────────────────────────
interface SpinWalletData {
  balance_cents:   number
  balance_kes:     string
  total_deposited: number
  total_used:      number
  total_spins:     number
}

interface SpinResult {
  success:          boolean
  prizeType:        PrizeType
  prizeName:        string
  prizeDescription: string
  prizeValue:       number
  message?:         string
}

interface DepositState {
  phase:   'idle' | 'sending' | 'polling' | 'success' | 'failed'
  message: string
}

interface SpinWheelProps {
  userId:          string
  mainWalletBalance?: number
  onSpinComplete?: (result: SpinResult) => void
}

// ─── SVG Wheel ─────────────────────────────────────────────────────────────
function WheelSVG({ rotation, spinning }: { rotation: number; spinning: boolean }) {
  const N  = PRIZES.length
  const R  = 148
  const cx = 150
  const cy = 150

  return (
    <svg
      viewBox="0 0 300 300"
      className="w-full h-full rounded-full"
      style={{
        transform:  `rotate(${rotation}deg)`,
        transition: spinning ? 'transform 3.2s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
      }}
    >
      {PRIZES.map((prize, i) => {
        const a0  = ((i     / N) * 2 * Math.PI) - Math.PI / 2
        const a1  = (((i+1) / N) * 2 * Math.PI) - Math.PI / 2
        const am  = (a0 + a1) / 2
        const x0  = cx + R * Math.cos(a0)
        const y0  = cy + R * Math.sin(a0)
        const x1  = cx + R * Math.cos(a1)
        const y1  = cy + R * Math.sin(a1)
        const lf  = (1 / N) > 0.5 ? 1 : 0
        const tr  = R * 0.60
        const ti  = R * 0.82
        const deg = ((i + 0.5) / N) * 360 + 90
        const tx  = cx + tr * Math.cos(am)
        const ty  = cy + tr * Math.sin(am)
        const ix  = cx + ti * Math.cos(am)
        const iy  = cy + ti * Math.sin(am)

        return (
          <g key={prize.type}>
            <path
              d={`M${cx},${cy} L${x0},${y0} A${R},${R} 0 ${lf} 1 ${x1},${y1} Z`}
              fill={prize.color}
              stroke="white"
              strokeWidth="1.5"
            />
            <text
              x={tx} y={ty}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="8" fontWeight="600" fill="white"
              transform={`rotate(${deg},${tx},${ty})`}
              style={{ userSelect: 'none' }}
            >
              {prize.label.length > 13 ? prize.label.slice(0, 11) + '…' : prize.label}
            </text>
            <text
              x={ix} y={iy}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="14"
              transform={`rotate(${deg},${ix},${iy})`}
              style={{ userSelect: 'none' }}
            >
              {prize.icon}
            </text>
          </g>
        )
      })}

      <circle cx={cx} cy={cy} r={R}  fill="none" stroke="white" strokeWidth="2" opacity="0.3" />
      <circle cx={cx} cy={cy} r="26" fill="white" />
      <circle cx={cx} cy={cy} r="22" fill="#111827" />
      <text
        x={cx} y={cy + 1}
        textAnchor="middle" dominantBaseline="middle"
        fontSize="8" fontWeight="700" fill="white" letterSpacing="1"
        style={{ userSelect: 'none' }}
      >
        SPIN
      </text>
    </svg>
  )
}

// ─── Main component ────────────────────────────────────────────────────────
export default function SpinWheel({ userId, mainWalletBalance = 0, onSpinComplete }: SpinWheelProps) {
  const [wallet,           setWallet]           = useState<SpinWalletData | null>(null)
  const [mainBalance,      setMainBalance]      = useState(mainWalletBalance)
  const [wheelActive,      setWheelActive]      = useState(false)
  const [loading,          setLoading]          = useState(true)
  const [spinning,         setSpinning]         = useState(false)
  const [rotation,         setRotation]         = useState(0)
  const rotationRef                            = useRef(0)
  const [result,           setResult]           = useState<SpinResult | null>(null)
  const [spinError,        setSpinError]        = useState('')
  const [showDeposit,      setShowDeposit]      = useState(false)
  const [showTransfer,     setShowTransfer]     = useState(false)
  const [phone,            setPhone]            = useState('')
  const [deposit,          setDeposit]          = useState<DepositState>({ phase: 'idle', message: '' })
  const [spinAmount,       setSpinAmount]       = useState('30')  // Default to KES 30
  const [transferAmount,   setTransferAmount]   = useState('30')  // Amount to transfer
  const [transferring,     setTransferring]     = useState(false)

  // ── Load all data in parallel ────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [statusRes, walletRes] = await Promise.all([
        fetch('/api/spin/status'),
        fetch('/api/spin-wallet/balance'),
      ])
      const [statusData, walletData] = await Promise.all([
        statusRes.json(),
        walletRes.json(),
      ])
      setWheelActive(statusData?.active ?? false)
      if (walletData.success) setWallet(walletData)
    } catch (err) {
      console.error('[SpinWheel] loadAll error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Spin ─────────────────────────────────────────────────────────────────
  const handleSpin = async () => {
    if (spinning || !wallet) return
    
    const spinCostCents = Math.round(parseFloat(spinAmount || '30') * 100)
    if (spinCostCents < MIN_SPIN_COST_CENTS || spinCostCents > MAX_SPIN_COST_CENTS) {
      setSpinError(`Spin amount must be between KES 30 and KES 70,000`)
      return
    }

    if (wallet.balance_cents < spinCostCents) { 
      setShowDeposit(true)
      return 
    }

    setSpinning(true)
    setSpinError('')
    setResult(null)

    // Optimistic deduction — rolled back on error
    setWallet(w => w ? { ...w, balance_cents: w.balance_cents - spinCostCents } : w)

    try {
      const res  = await fetch('/api/spin/perform', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId, spinAmount: spinCostCents / 100 }),
      })
      const data: SpinResult = await res.json()

      if (!data.success) {
        setWallet(w => w ? { ...w, balance_cents: w.balance_cents + spinCostCents } : w)
        setSpinError(data.message ?? 'Spin failed. Please try again.')
        setSpinning(false)
        return
      }

      // Rotate wheel to winning segment (always "Try Again")
      const prizeIdx    = PRIZES.findIndex(p => p.type === 'ZERO')
      const idx         = prizeIdx === -1 ? 0 : prizeIdx
      const midAngle    = (idx + 0.5) * SEGMENT_ANGLE
      const currentMod  = rotationRef.current % 360
      const delta       = (360 - currentMod - midAngle + 720) % 360
      const newRotation = rotationRef.current + 5 * 360 + delta

      rotationRef.current = newRotation
      setRotation(newRotation)

      await sleep(3400)

      // Show result but DON'T close the modal - let user close it manually
      setResult(data)
      setSpinning(false)
      onSpinComplete?.(data)

      // Sync true balance from server
      const walletRes  = await fetch('/api/spin-wallet/balance')
      const walletData = await walletRes.json()
      if (walletData.success) setWallet(walletData)

    } catch (err) {
      console.error('[SpinWheel] spin error:', err)
      setWallet(w => w ? { ...w, balance_cents: w.balance_cents + spinCostCents } : w)
      setSpinError('Network error. Please try again.')
      setSpinning(false)
    }
  }

  // ── Transfer from main to spin wallet ────────────────────────────────────
  const handleTransfer = async () => {
    const transferKes = parseFloat(transferAmount || '30')
    if (transferKes < 30 || transferKes > 70000) {
      setDeposit({ phase: 'failed', message: 'Transfer amount must be between KES 30 and KES 70,000' })
      return
    }

    if (mainBalance < transferKes) {
      setDeposit({ phase: 'failed', message: `Insufficient main wallet balance. You have KES ${mainBalance.toFixed(2)}` })
      return
    }

    setTransferring(true)
    setDeposit({ phase: 'sending', message: 'Transferring to spin wallet...' })

    try {
      const result = await transferMainToSpinWallet(transferKes)

      if (result.success) {
        setDeposit({ phase: 'success', message: `Successfully transferred KES ${transferKes.toFixed(2)} to spin wallet` })
        setMainBalance(result.main_balance / 100)
        setWallet(w => w ? { ...w, balance_cents: result.spin_balance } : w)
        setShowTransfer(false)
        setTransferAmount('30')
        setTimeout(() => setDeposit({ phase: 'idle', message: '' }), 3000)
      } else {
        setDeposit({ phase: 'failed', message: result.message || 'Transfer failed' })
      }
    } catch (error) {
      console.error('Transfer error:', error)
      setDeposit({ phase: 'failed', message: 'An error occurred during transfer' })
    } finally {
      setTransferring(false)
    }
  }

  // ── Deposit + poll with exponential backoff ───────────────────────────────
  const handleDeposit = async () => {
    const clean = phone.replace(/\D/g, '')
    if (clean.length < 9) {
      setDeposit({ phase: 'failed', message: 'Enter a valid phone number (at least 9 digits).' })
      return
    }

    const depositAmount = parseFloat(spinAmount || '30')
    if (depositAmount < 30 || depositAmount > 70000) {
      setDeposit({ phase: 'failed', message: 'Deposit amount must be between KES 30 and KES 70,000.' })
      return
    }

    setDeposit({ phase: 'sending', message: 'Sending M-Pesa prompt…' })

    try {
      // Call the server action directly
      const data = await depositSpinWalletViaMpesa({
        amount: depositAmount,  // KES amount
        phoneNumber: phone
      })

      if (!data.success) {
        setDeposit({ phase: 'failed', message: data.message ?? 'Failed to send M-Pesa prompt.' })
        return
      }

      const messageReference = extractMessageReference(data.data)

      if (!messageReference) {
        console.error('[SpinWheel] No messageReference in deposit response:', data)
        setDeposit({
          phase:   'failed',
          message: 'Payment sent but tracking ID missing. Check your M-Pesa — if charged, contact support.',
        })
        return
      }

      setDeposit({ phase: 'polling', message: 'Check your phone and enter your M-Pesa PIN…' })

      // Poll checkSpinDepositMpesaStatus with 4-second intervals (matching deposit.ts pattern)
      const maxAttempts = 30  // 30 attempts * 4 seconds = 2 minutes max
      for (let i = 0; i < maxAttempts; i++) {
        await sleep(4000)
        try {
          const statusData = await checkSpinDepositMpesaStatus(messageReference)

          console.log('[SpinWheel] Poll result:', statusData)

          if (statusData.data?.status === 'completed') {
            const depositAmount = parseFloat(spinAmount || '30')
            setDeposit({ phase: 'success', message: `KES ${depositAmount.toFixed(2)} added to your spin wallet!` })
            await loadAll()
            return
          }

          if (statusData.data?.status === 'failed' || statusData.data?.status === 'cancelled' || statusData.data?.status === 'timeout') {
            setDeposit({ phase: 'failed', message: 'Payment was cancelled or failed. Please try again.' })
            return
          }

          // status === 'initiated' → keep polling

        } catch (pollErr) {
          console.error('[SpinWheel] Poll error (non-fatal, continuing):', pollErr)
        }
      }

      // All retries exhausted without confirmation
      setDeposit({
        phase:   'failed',
        message: 'Payment timed out. If you were charged, contact support.',
      })

    } catch (err) {
      console.error('[SpinWheel] deposit error:', err)
      setDeposit({ phase: 'failed', message: 'Network error. Please try again.' })
    }
  }

  const closeDeposit = () => {
    setShowDeposit(false)
    setPhone('')
    setDeposit({ phase: 'idle', message: '' })
  }

  // ── Derived state ────────────────────────────────────────────────────────
  const spinCostCents = Math.round(parseFloat(spinAmount || '30') * 100)
  const balanceCents = wallet?.balance_cents ?? 0
  const spinsLeft    = Math.floor(balanceCents / spinCostCents)
  const canSpin      = wheelActive && balanceCents >= spinCostCents && !spinning
  const depositBusy  = deposit.phase === 'sending' || deposit.phase === 'polling'

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-sm">Loading spin wheel…</span>
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Spin to Win</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {wheelActive ? 'Wheel is active' : 'Wheel is currently inactive'}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-400">{fmtKes(balanceCents)}</span>
          </div>
        </div>

        {/* Wallet summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Balance',     value: fmtKes(balanceCents) },
            { label: 'Spins left',  value: spinsLeft.toString() },
            { label: 'Total spins', value: (wallet?.total_spins ?? 0).toString() },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className="text-lg font-bold">{value}</div>
            </div>
          ))}
        </div>

        {/* Wheel */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col items-center gap-5">
          <div className="relative w-72 h-72 md:w-80 md:h-80">
            {/* Pointer */}
            <div
              className="absolute left-1/2 -top-3 -translate-x-1/2 z-10"
              style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }}
            >
              <svg width="24" height="28" viewBox="0 0 24 28">
                <polygon points="12,28 0,0 24,0" fill="white" />
              </svg>
            </div>
            <div className="absolute inset-0 rounded-full ring-4 ring-white/10" />
            <WheelSVG rotation={rotation} spinning={spinning} />
          </div>

          {/* Spin button */}
          <button
            onClick={handleSpin}
            disabled={!canSpin}
            className={`
              flex items-center gap-2.5 px-8 py-3.5 rounded-full font-bold text-sm
              transition-all duration-150
              ${canSpin
                ? 'bg-white text-gray-950 hover:bg-gray-100 active:scale-95 shadow-lg shadow-white/10'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {spinning
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Spinning…</>
              : <><RotateCcw className="w-4 h-4" /> Spin — KES {spinAmount}</>
            }
          </button>

          {/* Main and Spin wallet display */}
          <div className="flex gap-3 w-full max-w-xs text-sm">
            <div className="flex-1 bg-gray-800 rounded-lg p-3 border border-gray-700">
              <p className="text-xs text-gray-400 mb-1">Main Wallet</p>
              <p className="font-bold text-white">KES {mainBalance.toFixed(2)}</p>
            </div>
            <div className="flex-1 bg-gray-800 rounded-lg p-3 border border-gray-700">
              <p className="text-xs text-gray-400 mb-1">Spin Wallet</p>
              <p className="font-bold text-yellow-400">KES {(wallet?.balance_cents ? wallet.balance_cents / 100 : 0).toFixed(2)}</p>
            </div>
          </div>

          {/* Transfer button */}
          <button
            onClick={() => setShowTransfer(true)}
            disabled={spinning || transferring || mainBalance < 30}
            className="w-full max-w-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            Transfer to Spin Wallet
          </button>

          {/* Spin amount input */}
          <div className="space-y-2 w-full max-w-xs">
            <label htmlFor="spin-amount" className="block text-xs font-medium text-gray-400">
              Spin amount (KES)
            </label>
            <input
              id="spin-amount"
              type="number"
              value={spinAmount}
              onChange={e => setSpinAmount(e.target.value)}
              min="30"
              max="70000"
              step="10"
              disabled={spinning}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent disabled:opacity-50"
            />
            <p className="text-xs text-gray-600">Minimum KES 30, Maximum KES 70,000</p>
          </div>

          {/* Insufficient balance nudge */}
          {!spinning && balanceCents < spinCostCents && (
            <div className="text-center">
              <p className="text-sm text-orange-400 mb-2">Insufficient balance to spin</p>
              <button
                onClick={() => setShowDeposit(true)}
                className="flex items-center gap-1.5 text-sm text-white border border-gray-700 rounded-lg px-4 py-1.5 hover:bg-gray-800 transition-colors mx-auto"
              >
                <Plus className="w-3.5 h-3.5" /> Top up wallet
              </button>
            </div>
          )}

          {/* Spin error */}
          {spinError && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-4 py-2 w-full max-w-sm justify-center">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {spinError}
            </div>
          )}
        </div>

        {/* Top-up shortcut */}
        {balanceCents >= spinCostCents && (
          <div className="flex justify-end">
            <button
              onClick={() => setShowDeposit(true)}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-lg px-4 py-2 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Top up wallet
            </button>
          </div>
        )}

        {/* Prize grid */}
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
            Available prizes
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRIZES.filter(p => p.type !== 'ZERO').map(prize => (
              <div
                key={prize.type}
                className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-3 flex items-center gap-3 hover:border-gray-700 transition-colors"
              >
                <span className="text-2xl leading-none">{prize.icon}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{prize.label}</div>
                  <div className="text-xs text-gray-500">{prize.prob}% chance</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Result modal ───────────────────────────────────────────────────── */}
      {result && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setResult(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-sm w-full text-center space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-5xl leading-none">{prizeByType(result.prizeType).icon}</div>
            <div className="text-xl font-bold">
              {result.prizeType === 'ZERO' ? 'Better luck next time!' : 'You won!'}
            </div>
            <div className="text-gray-300 font-medium">{result.prizeName}</div>
            {result.prizeValue > 0 && (
              <div className="text-sm text-gray-400">Value: {fmtKes(result.prizeValue)}</div>
            )}
            {result.prizeDescription && (
              <div className="text-sm text-gray-500">{result.prizeDescription}</div>
            )}
            <button
              onClick={() => setResult(null)}
              className="mt-2 w-full py-2.5 rounded-xl bg-white text-gray-950 font-bold text-sm hover:bg-gray-100 transition-colors"
            >
              Awesome!
            </button>
          </div>
        </div>
      )}

      {/* ── Deposit modal ──────────────────────────────────────────────────── */}
      {showDeposit && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          onClick={!depositBusy ? closeDeposit : undefined}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full space-y-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Top up spin wallet</h2>
              {!depositBusy && (
                <button onClick={closeDeposit} className="text-gray-500 hover:text-white" aria-label="Close">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Amount input in modal */}
            {(deposit.phase === 'idle' || deposit.phase === 'failed') && (
              <div className="space-y-1.5">
                <label htmlFor="modal-amount" className="block text-sm font-medium text-gray-300">
                  Deposit amount (KES)
                </label>
                <input
                  id="modal-amount"
                  type="number"
                  value={spinAmount}
                  onChange={e => setSpinAmount(e.target.value)}
                  min="30"
                  max="70000"
                  step="10"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                />
                <p className="text-xs text-gray-600">Minimum KES 30, Maximum KES 70,000</p>
              </div>
            )}

            {/* Amount display */}
            <div className="bg-gray-800 rounded-xl p-4 flex items-center justify-between">
              <span className="text-sm text-gray-400">You will deposit</span>
              <span className="text-xl font-bold text-yellow-400">KES {spinAmount}</span>
            </div>

            {/* Current balance */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Current balance</span>
              <span className="font-medium">{fmtKes(balanceCents)}</span>
            </div>

            {/* Phone input — only visible when not processing */}
            {(deposit.phase === 'idle' || deposit.phase === 'failed') && (
              <div className="space-y-1.5">
                <label htmlFor="mpesa-phone" className="block text-sm font-medium text-gray-300">
                  Co-op Bank phone number
                </label>
                <input
                  id="mpesa-phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="0712 345 678"
                  maxLength={15}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                />
                <p className="text-xs text-gray-600">Enter your registered phone number</p>
              </div>
            )}

            {/* Status feedback */}
            {deposit.phase !== 'idle' && (
              <div className={`
                flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm
                ${deposit.phase === 'success' ? 'bg-green-950/60 border border-green-900 text-green-300' : ''}
                ${deposit.phase === 'failed'  ? 'bg-red-950/60 border border-red-900 text-red-300' : ''}
                ${depositBusy                 ? 'bg-gray-800 border border-gray-700 text-gray-300' : ''}
              `}>
                {depositBusy             && <Loader2      className="w-4 h-4 animate-spin flex-shrink-0 mt-0.5" />}
                {deposit.phase === 'success' && <CheckCircle  className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                {deposit.phase === 'failed'  && <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                <span>{deposit.message}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              {deposit.phase === 'success' ? (
                <button
                  onClick={closeDeposit}
                  className="flex-1 py-2.5 rounded-xl bg-white text-gray-950 font-bold text-sm hover:bg-gray-100 transition-colors"
                >
                  Done
                </button>
              ) : deposit.phase === 'failed' ? (
                <>
                  <button
                    onClick={() => setDeposit({ phase: 'idle', message: '' })}
                    className="flex-1 py-2.5 rounded-xl bg-white text-gray-950 font-bold text-sm hover:bg-gray-100 transition-colors"
                  >
                    Try again
                  </button>
                  <button
                    onClick={closeDeposit}
                    className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleDeposit}
                    disabled={depositBusy || phone.replace(/\D/g, '').length < 9}
                    className="flex-1 py-2.5 rounded-xl bg-white text-gray-950 font-bold text-sm hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {depositBusy ? 'Processing…' : 'Request Co-op Bank STK'}
                  </button>
                  <button
                    onClick={closeDeposit}
                    disabled={depositBusy}
                    className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 disabled:opacity-40 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>

            {!depositBusy && deposit.phase !== 'success' && deposit.phase !== 'failed' && (
              <p className="text-xs text-gray-600 text-center">
                You'll receive an M-Pesa prompt to confirm with your PIN
              </p>
            )}
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-gray-900 rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-sm border border-gray-800 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Transfer to Spin Wallet</h2>
                <p className="text-xs text-gray-500 mt-1">Move funds from main wallet to spin wallet</p>
              </div>
              <button
                onClick={() => setShowTransfer(false)}
                disabled={transferring}
                className="text-gray-400 hover:text-white disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Balance display */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                <p className="text-xs text-gray-400 mb-1">Available</p>
                <p className="text-lg font-bold text-white">KES {mainBalance.toFixed(2)}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                <p className="text-xs text-gray-400 mb-1">After transfer</p>
                <p className="text-lg font-bold text-white">
                  KES {Math.max(0, mainBalance - (parseFloat(transferAmount || '30'))).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Transfer amount input */}
            <div className="space-y-2">
              <label htmlFor="transfer-amount" className="block text-sm font-medium text-gray-300">
                Transfer amount (KES)
              </label>
              <input
                id="transfer-amount"
                type="number"
                value={transferAmount}
                onChange={e => setTransferAmount(e.target.value)}
                min="30"
                max="70000"
                step="10"
                disabled={transferring}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
              />
              <p className="text-xs text-gray-600">Minimum KES 30, Maximum KES 70,000</p>
            </div>

            {/* Message display */}
            {deposit.message && (
              <div className={`rounded-lg p-3 text-sm ${
                deposit.phase === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                deposit.phase === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              }`}>
                {deposit.message}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleTransfer}
                disabled={transferring || parseFloat(transferAmount || '0') < 30}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {transferring ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Transferring…
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    Transfer Now
                  </>
                )}
              </button>
              <button
                onClick={() => setShowTransfer(false)}
                disabled={transferring}
                className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 font-bold py-3 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
