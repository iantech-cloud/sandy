'use client'

import Link from 'next/link'
import { ArrowRight, Bot, BriefcaseBusiness, Gift, Search, ShoppingBag, WalletCards } from 'lucide-react'

const earningWays = [
  { href: '/dashboard/deals', icon: Search, label: 'Deal Finder', title: 'Compare before you buy', copy: 'Search eBay offers, compare delivery and seller feedback, then shop through tracked links.', tone: 'bg-indigo-50 text-indigo-700' },
  { href: '/dashboard/gigs', icon: BriefcaseBusiness, label: 'Gig Marketplace', title: 'Sell what you know', copy: 'List writing, design, tutoring, CV and marketing services. Keep your earnings in a dedicated wallet.', tone: 'bg-emerald-50 text-emerald-700' },
  { href: '/dashboard/cashback', icon: Gift, label: 'Cashback & Rewards', title: 'Get rewarded for shopping', copy: 'Earn cashback, referral bonuses and loyalty points when tracked purchases settle.', tone: 'bg-amber-50 text-amber-700' },
  { href: '/dashboard/analyzer', icon: Bot, label: 'AI Deal Analyzer', title: 'Know if it is a good deal', copy: 'Paste a product URL for a transparent deal score, alternatives and affiliate recommendations.', tone: 'bg-fuchsia-50 text-fuchsia-700' },
  { href: '/dashboard/resources', icon: ShoppingBag, label: 'Digital Resources', title: 'Buy and sell useful resources', copy: 'Discover templates, business kits, prompts and study materials with secure downloads.', tone: 'bg-sky-50 text-sky-700' },
]

export default function EarningHub({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? 'py-10 px-4 md:px-12 bg-bg-subtle' : 'py-16 px-4 md:px-12 bg-bg-subtle'} aria-labelledby="earning-hub-title">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">More ways to hustle</p>
            <h2 id="earning-hub-title" className="mt-2 text-3xl md:text-4xl font-bold text-heading text-balance">One platform. Five new income streams.</h2>
            <p className="mt-3 max-w-2xl text-text-muted leading-6">Each product has its own wallet, activity ledger and M-Pesa withdrawal path, so you always know where your money came from.</p>
          </div>
          <Link href="/dashboard/earn" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800">Open earning hub <ArrowRight className="w-4 h-4" /></Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {earningWays.map(({ href, icon: Icon, label, title, copy, tone }) => (
            <Link key={href} href={href} className="group rounded-2xl border border-border bg-surface p-5 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone}`}><Icon className="w-5 h-5" aria-hidden="true" /></div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
              <h3 className="mt-2 font-bold text-heading leading-snug">{title}</h3>
              <p className="mt-2 text-sm text-text-muted leading-6">{copy}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600">Explore <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export const walletSources = [
  { key: 'deal_finder', label: 'Deal Finder', balance: 0, pending: 0, icon: Search },
  { key: 'freelance_gigs', label: 'Gig Marketplace', balance: 0, pending: 0, icon: BriefcaseBusiness },
  { key: 'cashback_rewards', label: 'Cashback & Rewards', balance: 0, pending: 0, icon: Gift },
  { key: 'ai_analyzer', label: 'AI Analyzer', balance: 0, pending: 0, icon: Bot },
  { key: 'digital_resources', label: 'Digital Resources', balance: 0, pending: 0, icon: ShoppingBag },
]

export { WalletCards }
