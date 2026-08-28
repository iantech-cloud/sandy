import EarningHub, { walletSources } from '@/app/earning-hub'
import Link from 'next/link'
import { ArrowUpRight, WalletCards } from 'lucide-react'

export default function EarningHubPage() {
  return (
    <main className="min-h-screen bg-bg px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold text-indigo-600">HustleHub wallet centre</p><h1 className="mt-1 text-3xl font-bold text-heading">Your earning hub</h1><p className="mt-2 max-w-2xl text-text-muted">Separate balances for every new income stream. Earnings become withdrawable after verification and settlement.</p></div>
          <Link href="/dashboard/withdrawals" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"><WalletCards className="w-4 h-4" /> Withdraw via M-Pesa</Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {walletSources.map(({ key, label, balance, pending, icon: Icon }) => <article key={key} className="rounded-2xl border border-border bg-surface p-5"><div className="flex items-center justify-between"><div className="rounded-xl bg-indigo-50 p-3 text-indigo-700"><Icon className="w-5 h-5" /></div><span className="text-xs text-text-muted">{key.replace('_', ' ')}</span></div><h2 className="mt-5 font-semibold text-heading">{label}</h2><p className="mt-2 text-2xl font-bold text-heading">KES {balance.toFixed(2)}</p><p className="mt-1 text-xs text-text-muted">KES {pending.toFixed(2)} pending</p><Link href={`/dashboard/${key === 'deal_finder' ? 'deals' : key === 'freelance_gigs' ? 'gigs' : key === 'cashback_rewards' ? 'cashback' : key === 'ai_analyzer' ? 'analyzer' : 'resources'}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600">Open wallet <ArrowUpRight className="w-4 h-4" /></Link></article>)}
        </div>
        <EarningHub compact />
      </div>
    </main>
  )
}
