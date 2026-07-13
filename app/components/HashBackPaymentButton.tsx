'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'

interface HashBackPaymentButtonProps {
  amount: number // KES
  type: 'activation' | 'bot_unlock' | 'spin_deposit' | 'aviator_deposit' | 'casino_deposit'
  label?: string
  onSuccess?: (txn: any) => void
  onCancel?: () => void
  onError?: (error: any) => void
  className?: string
}

export function HashBackPaymentButton({
  amount,
  type,
  label = 'Pay Now',
  onSuccess,
  onCancel,
  onError,
  className = ''
}: HashBackPaymentButtonProps) {
  const [loading, setLoading] = useState(false)
  const { data: session } = useSession()
  const accountId = process.env.NEXT_PUBLIC_HASHBACK_ACCOUNT_ID

  if (!accountId) {
    console.error('NEXT_PUBLIC_HASHBACK_ACCOUNT_ID not configured')
    return null
  }

  const handlePay = () => {
    if (!session?.user?.id) {
      onError?.(new Error('User not authenticated'))
      return
    }

    if (!(window as any).HashPay) {
      onError?.(new Error('HashPay not loaded'))
      return
    }

    setLoading(true)

    // Generate unique reference with userId and type
    const reference = `${type}_${session.user.id}_${Date.now()}`

    const handler = (window as any).HashPay.setup({
      account: accountId,
      amount: amount,
      reference: reference,
      onSuccess: (txn: any) => {
        setLoading(false)
        console.log('[v0] Payment success:', txn)
        onSuccess?.(txn)
      },
      onCancel: () => {
        setLoading(false)
        console.log('[v0] Payment cancelled')
        onCancel?.()
      },
      onError: (error: any) => {
        setLoading(false)
        console.error('[v0] Payment error:', error)
        onError?.(error)
      }
    })

    handler.openIframe()
  }

  return (
    <button
      onClick={handlePay}
      disabled={loading}
      className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors ${className}`}
    >
      {loading ? 'Processing...' : label}
    </button>
  )
}
