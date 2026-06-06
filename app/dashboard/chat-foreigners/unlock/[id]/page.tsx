'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, MessageSquare, Loader2, Lock, Sparkles, Globe,
  Zap, ShieldCheck, Info, BadgeCheck, Heart, Clock, Star, Phone, XCircle,
} from 'lucide-react';
import { checkBotUnlockPaymentStatus } from '@/app/actions/chat-foreigners/payments';

interface Person {
  id: string;
  name: string;
  username: string;
  avatar_url?: string;
  bio?: string;
  tagline?: string;
  welcomeMessage?: string;
  purpose?: string;
  nationality?: string;
  languages?: string[];
  availabilityNote?: string;
  personalityType?: string;
  speakingStyle?: string;
  mood?: string;
  interests?: string;
  category: string;
  unlockCost_cents: number;
  unlockPrice: number;
}

type UnlockStatus = 'idle' | 'pending' | 'polling' | 'success' | 'failed' | 'cancelled' | 'timeout';

// Polling constants — identical to the activation waiting page
const POLLING_INTERVAL = 4000;   // 4 s
const MAX_POLLING_ATTEMPTS = 60; // 60 × 4 s = 240 s (~4 min)

const CATEGORY_LABELS: Record<string, string> = {
  relationship_coach: 'Relationships',
  finance_mentor: 'Finance & Investing',
  social_friend: 'Lifestyle',
  business_advisor: 'Business',
  companion: 'Companion',
  therapist: 'Mental Wellness',
  gaming_friend: 'Gaming',
  tech_mentor: 'Tech & Design',
};

const NATIONALITY_FLAGS: Record<string, string> = {
  'American': '🇺🇸',
  'African American': '🇺🇸',
  'British': '🇬🇧',
  'Canadian': '🇨🇦',
  'Australian': '🇦🇺',
  'German': '🇩🇪',
  'French': '🇫🇷',
};

// Credibility stats per personality category
const CATEGORY_STATS: Record<string, { label: string; value: string }[]> = {
  therapist: [{ label: 'Conversations', value: '3.1k+' }, { label: 'Positive', value: '99%' }, { label: 'Rating', value: '4.9' }],
  relationship_coach: [{ label: 'Helped', value: '2.4k+' }, { label: 'Positive', value: '97%' }, { label: 'Rating', value: '4.8' }],
  finance_mentor: [{ label: 'Sessions', value: '1.8k+' }, { label: 'Accurate', value: '96%' }, { label: 'Rating', value: '4.7' }],
  business_advisor: [{ label: 'Advised', value: '1.5k+' }, { label: 'Positive', value: '98%' }, { label: 'Rating', value: '4.8' }],
  tech_mentor: [{ label: 'Solved', value: '2.0k+' }, { label: 'Helpful', value: '97%' }, { label: 'Rating', value: '4.9' }],
  gaming_friend: [{ label: 'Games', value: '500+' }, { label: 'Fun', value: '99%' }, { label: 'Rating', value: '4.8' }],
  default: [{ label: 'Conversations', value: '1.2k+' }, { label: 'Positive', value: '98%' }, { label: 'Rating', value: '4.8' }],
};

export default function UnlockPage() {
  const params = useParams();
  const router = useRouter();
  const personId = params.id as string;

  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [status, setStatus] = useState<UnlockStatus>('idle');
  const [error, setError] = useState('');
  // messageReference (= checkout_request_id) replaces paymentId as the polling key
  const [messageReference, setMessageReference] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [pollCount, setPollCount] = useState(0);
  const [resultDesc, setResultDesc] = useState('');
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const loadPerson = async () => {
      try {
        const [personRes, accessRes] = await Promise.all([
          fetch(`/api/chat-foreigners/bots?type=details&botId=${personId}`),
          fetch(`/api/chat-foreigners/bots?type=check&botId=${personId}`),
        ]);
        const [personData, accessData] = await Promise.all([personRes.json(), accessRes.json()]);

        if (personData.success) {
          setPerson(personData.data);
        } else {
          router.push('/dashboard/chat-foreigners');
          return;
        }

        if (accessData.success && accessData.hasAccess) {
          setHasAccess(true);
        }
      } catch (err) {
        console.error('Error loading person:', err);
      } finally {
        setLoading(false);
      }
    };
    loadPerson();
  }, [personId, router]);

  // Poll payment status — mirrors MpesaWaitingContent from the activation page
  const pollPaymentStatus = useCallback(async () => {
    if (!messageReference) return;

    try {
      const result = await checkBotUnlockPaymentStatus(messageReference);
      setPollCount((prev) => prev + 1);

      if (result.success && result.data) {
        const { status: txStatus, resultDesc: desc } = result.data as any;

        // Still pending / initiated — normal intermediate state, keep waiting
        if (txStatus === 'pending' || txStatus === 'initiated') return;

        setStatus((prev) => {
          if (['success', 'cancelled', 'timeout', 'failed'].includes(prev)) return prev;

          if (txStatus === 'completed') return 'success';
          if (txStatus === 'cancelled') return 'cancelled';
          if (txStatus === 'timeout') return 'timeout';
          if (txStatus === 'failed') { setError(desc || 'Payment failed. Please try again.'); return 'failed'; }
          return prev;
        });

        if (txStatus === 'completed') {
          setTimeout(() => router.push(`/dashboard/chat-foreigners/chat/${personId}`), 2000);
        }
        if (['cancelled', 'timeout', 'failed'].includes(txStatus)) {
          setResultDesc(desc || '');
        }
      }
    } catch (err) {
      console.error('[v0] Poll error:', err);
    }
  }, [messageReference, personId, router, pollCount]);

  // Initial poll as soon as messageReference is set
  useEffect(() => {
    if (messageReference) pollPaymentStatus();
  }, [messageReference]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fixed-interval polling while status === 'polling'
  useEffect(() => {
    if (status !== 'polling') return;

    if (pollCount >= MAX_POLLING_ATTEMPTS) {
      setStatus('timeout');
      setError('Payment request timed out. Please check your M-Pesa history and try again.');
      return;
    }

    const timeout = setTimeout(pollPaymentStatus, POLLING_INTERVAL);
    return () => clearTimeout(timeout);
  }, [status, pollPaymentStatus, pollCount]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!phoneNumber.trim()) {
      setError('Please enter your M-Pesa phone number.');
      return;
    }
    setStatus('pending');

    try {
      const res = await fetch('/api/chat-foreigners/payments/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId: personId, phoneNumber }),
      });
      const data = await res.json();

      if (data.success) {
        // Store both IDs; poll by messageReference (checkout_request_id) for Co-op Bank query
        setPaymentId(data.data.paymentId);
        setMessageReference(data.data.checkoutRequestId);
        setPollCount(0);
        setStatus('polling');
      } else {
        setStatus('failed');
        setError(data.error || 'Failed to initiate payment.');
      }
    } catch {
      setStatus('failed');
      setError('Something went wrong. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-[#0d0d14] items-center justify-center">
        <Loader2 className="animate-spin text-[#00c97a]" size={32} />
      </div>
    );
  }

  if (!person) return null;

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#0d0d14] flex items-center justify-center p-6">
        <div className="bg-[#161622] border border-zinc-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center text-zinc-100">
          <div className="w-16 h-16 bg-[#00c97a]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-[#00c97a]" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Connected!</h2>
          <p className="text-zinc-400 text-sm">
            You can now chat with {person.name}. Redirecting...
          </p>
          <Loader2 className="animate-spin text-[#00c97a] mx-auto mt-4" size={20} />
        </div>
      </div>
    );
  }

  const interestsList = person.interests?.split(',').map((i) => i.trim()).filter(Boolean) ?? [];
  const categoryLabel =
    CATEGORY_LABELS[person.personalityType || ''] ??
    CATEGORY_LABELS[person.category] ??
    person.category;
  const flag = NATIONALITY_FLAGS[person.nationality || ''] ?? '🌐';
  const stats = CATEGORY_STATS[person.personalityType || ''] ?? CATEGORY_STATS.default;
  const unlockPrice = 100; // Fixed KSH 100

  return (
    <div className="flex flex-col min-h-screen bg-[#0d0d14] text-zinc-100 overflow-y-auto">
      {/* Header */}
      <header className="px-4 py-4 flex items-center sticky top-0 bg-[#0d0d14]/90 backdrop-blur-md z-10 border-b border-zinc-800/50">
        <Link
          href="/dashboard/chat-foreigners"
          className="p-2 -ml-2 mr-2 rounded-full hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold text-sm">Profile</h1>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold text-[#00c97a] bg-[#00c97a]/10 border border-[#00c97a]/25 rounded-full px-2.5 py-1">
          <BadgeCheck className="w-3 h-3" />
          AI Verified
        </div>
      </header>

      <div className="max-w-lg mx-auto w-full px-4 pb-16 space-y-4">
        {/* Hero + Avatar */}
        <div className="relative bg-gradient-to-b from-[#00c97a]/10 to-transparent rounded-2xl pt-8 pb-6 flex flex-col items-center text-center gap-3 -mx-0 mt-2">
          <div className="relative">
            <div className="absolute inset-0 -m-1 bg-[#00c97a]/30 rounded-full blur-md" />
            <div className="w-28 h-28 rounded-full overflow-hidden border-3 border-[#0d0d14] shadow-2xl relative bg-zinc-900">
              {person.avatar_url ? (
                <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                  <span className="text-zinc-300 text-4xl font-bold">
                    {person.name.substring(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <span className="absolute bottom-1 right-1 w-5 h-5 bg-[#00c97a] rounded-full border-2 border-[#0d0d14]" />
          </div>

          <div>
            <div className="flex items-center justify-center gap-1.5">
              <h1 className="text-3xl font-bold">{person.name}</h1>
              <BadgeCheck className="w-5 h-5 text-[#00c97a]" />
            </div>
            {person.username && (
              <p className="text-zinc-500 text-xs mt-0.5">@{person.username.replace('@', '')}</p>
            )}
            <div className="flex items-center justify-center gap-2 mt-2 text-xs text-zinc-400">
              <span>{flag} {person.nationality || 'International'}</span>
              <span className="text-zinc-700">·</span>
              <span className="text-[#00c97a] font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-[#00c97a] rounded-full animate-pulse" />
                Active now
              </span>
            </div>
          </div>

          {/* Tagline */}
          {person.tagline && (
            <p className="text-sm text-zinc-300 italic max-w-xs leading-relaxed text-balance">
              &ldquo;{person.tagline}&rdquo;
            </p>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 justify-center">
            <span className="text-[10px] bg-[#00c97a]/10 text-[#00c97a] border border-[#00c97a]/25 rounded-full px-2.5 py-1 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              {categoryLabel}
            </span>
            {person.mood && (
              <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-full px-2.5 py-1 flex items-center gap-1">
                <Heart className="w-2.5 h-2.5" />
                {person.mood.charAt(0).toUpperCase() + person.mood.slice(1)}
              </span>
            )}
            {person.speakingStyle && (
              <span className="text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-full px-2.5 py-1">
                {person.speakingStyle}
              </span>
            )}
          </div>
        </div>

        {/* Welcome message preview */}
        {person.welcomeMessage && (
          <div className="bg-[#161622] border border-[#00c97a]/20 rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-[#00c97a] uppercase tracking-wider mb-2 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Welcome Message
            </p>
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full overflow-hidden border border-zinc-700 bg-zinc-800 shrink-0 mt-0.5">
                {person.avatar_url ? (
                  <img src={person.avatar_url} alt={person.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-zinc-300 font-bold text-xs">
                    {person.name.substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="bg-[#1c1c2e] rounded-xl rounded-tl-sm px-3 py-2.5 border border-zinc-700/40">
                <p className="text-sm text-zinc-200 leading-relaxed">{person.welcomeMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Purpose */}
        {person.purpose && (
          <div className="bg-[#161622] border border-zinc-800 rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Purpose
            </p>
            <p className="text-sm text-zinc-300 leading-relaxed">{person.purpose}</p>
          </div>
        )}

        {/* Bio */}
        {person.bio && (
          <div className="bg-[#161622] border border-zinc-800 rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Info className="w-3 h-3" /> About
            </p>
            <p className="text-sm text-zinc-300 leading-relaxed">{person.bio}</p>
          </div>
        )}

        {/* Credibility stats */}
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="bg-[#161622] border border-zinc-800 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-[#00c97a]">{s.value}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Interests */}
        {interestsList.length > 0 && (
          <div className="bg-[#161622] border border-zinc-800 rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2.5 flex items-center gap-1">
              <Star className="w-3 h-3" /> Interests &amp; Specialties
            </p>
            <div className="flex flex-wrap gap-1.5">
              {interestsList.map((interest, i) => (
                <span
                  key={i}
                  className="text-[10px] bg-[#00c97a]/10 text-[#00c97a] border border-[#00c97a]/25 rounded-full px-2.5 py-1 font-medium"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Availability + languages */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#161622] border border-zinc-800 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Availability
            </p>
            <p className="text-xs text-zinc-300">
              {person.availabilityNote || 'Available 24/7'}
            </p>
          </div>
          <div className="bg-[#161622] border border-zinc-800 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Globe className="w-3 h-3" /> Languages
            </p>
            <p className="text-xs text-zinc-300">
              {(person.languages ?? ['English']).join(', ')}
            </p>
          </div>
        </div>

        {/* Trust & safety */}
        <div className="bg-[#161622] border border-zinc-800 rounded-2xl p-4 space-y-3">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Trust &amp; Safety
          </p>
          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-[#00c97a]/10 flex items-center justify-center shrink-0 mt-0.5">
                <BadgeCheck className="w-3 h-3 text-[#00c97a]" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-200">AI Disclosure</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  {person.name} is an AI-powered personality. Conversations are automated and for entertainment and guidance purposes only.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-[#00c97a]/10 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-3 h-3 text-[#00c97a]" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-200">Privacy Protected</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Your conversations are private and not shared with third parties. Chat data is used only to improve your experience.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-[#00c97a]/10 flex items-center justify-center shrink-0 mt-0.5">
                <Info className="w-3 h-3 text-[#00c97a]" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-200">Safe &amp; Moderated</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  All responses follow strict content guidelines. For support or concerns, contact support@sandy.co.ke.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA / Unlock */}
        {hasAccess ? (
          <Link
            href={`/dashboard/chat-foreigners/chat/${person.id}`}
            className="flex items-center justify-center gap-2 w-full bg-[#00c97a] hover:bg-[#00b06a] text-white font-bold h-14 rounded-full text-base shadow-lg transition-colors"
          >
            <MessageSquare className="w-5 h-5" />
            Open Chat
          </Link>
        ) : (
          <div className="bg-[#161622] border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-200 text-sm">Unlock Full Access</p>
                  <p className="text-[10px] text-zinc-500">One-time payment &middot; via M-Pesa</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-zinc-100">KES {unlockPrice}</p>
              </div>
            </div>

            {/* Value proposition */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {[
                ['Unlimited messages', ''],
                ['KES 100 reward after 20 chats', ''],
                ['Private & secure', ''],
                ['Cancel anytime', ''],
              ].map(([label]) => (
                <div key={label} className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#00c97a]/10 flex items-center justify-center shrink-0">
                    <svg className="w-2 h-2 text-[#00c97a]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                  {label}
                </div>
              ))}
            </div>

            {status === 'polling' ? (
              <div className="flex flex-col items-center py-5 gap-3">
                <Loader2 className="animate-spin text-[#00c97a]" size={32} />
                <p className="font-semibold text-zinc-200 text-sm">Waiting for M-Pesa payment...</p>
                <p className="text-xs text-zinc-500 text-center">Enter your PIN on the Co-op Bank prompt sent to your phone. Do not close this page.</p>
                <p className="text-[10px] text-zinc-600">Checking... ({pollCount}/{MAX_POLLING_ATTEMPTS})</p>
                <button
                  onClick={() => { setStatus('idle'); setPollCount(0); setMessageReference(''); }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors mt-1"
                >
                  Cancel
                </button>
              </div>
            ) : status === 'cancelled' ? (
              <div className="flex flex-col items-center py-5 gap-3">
                <XCircle className="text-amber-400" size={32} />
                <p className="font-semibold text-amber-300 text-sm">Payment Cancelled</p>
                <p className="text-xs text-zinc-400 text-center">{resultDesc || 'You cancelled the M-Pesa prompt.'}</p>
                <button
                  onClick={() => { setStatus('idle'); setPollCount(0); setMessageReference(''); setError(''); setResultDesc(''); }}
                  className="mt-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-full transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : status === 'timeout' ? (
              <div className="flex flex-col items-center py-5 gap-3">
                <XCircle className="text-red-400" size={32} />
                <p className="font-semibold text-red-300 text-sm">Payment Timed Out</p>
                <p className="text-xs text-zinc-400 text-center">No response received. Check your M-Pesa history — if debited, contact support.</p>
                <button
                  onClick={() => { setStatus('idle'); setPollCount(0); setMessageReference(''); setError(''); setResultDesc(''); }}
                  className="mt-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-full transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <form onSubmit={handleUnlock} className="space-y-3">
                {error && (
                  <div className="bg-red-950/50 border border-red-900/50 text-red-400 px-3 py-2.5 rounded-xl text-xs">
                    {error}
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400">M-Pesa Number</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 0712345678"
                    className="w-full bg-[#0d0d14] border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[#00c97a]/50 focus:ring-1 focus:ring-[#00c97a]/20 text-sm"
                    autoComplete="tel"
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === 'pending'}
                  className="w-full bg-[#00c97a] hover:bg-[#00b06a] text-white font-bold h-12 rounded-full transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {status === 'pending' ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      Sending prompt...
                    </>
                  ) : (
                    <>
                      <Lock size={16} />
                      Pay KES {unlockPrice} via M-Pesa
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Referral note */}
        <div className="bg-amber-950/20 border border-amber-800/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-400">Earn KES 1,000 by sharing</p>
            <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
              Share your referral link and earn KES 60 every time someone you invite unlocks a personality.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
