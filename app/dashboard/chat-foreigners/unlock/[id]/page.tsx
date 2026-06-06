'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageSquare, Loader2, Briefcase, Sparkles, Heart, Lock } from 'lucide-react';

interface Person {
  id: string;
  name: string;
  username: string;
  avatar_url?: string;
  bio?: string;
  personalityType?: string;
  speakingStyle?: string;
  mood?: string;
  interests?: string;
  category: string;
  unlockCost_cents: number;
  unlockPrice: number;
}

type UnlockStatus = 'idle' | 'pending' | 'polling' | 'success' | 'failed';

const INTEREST_LABELS: Record<string, string> = {
  relationship_coach: 'Relationships',
  finance_mentor: 'Finance & Investing',
  social_friend: 'Lifestyle',
  business_advisor: 'Business & Entrepreneurship',
  companion: 'Deep Conversations',
  therapist: 'Mental Wellness',
  gaming_friend: 'Gaming & Tech',
  tech_mentor: 'Software & Career',
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
  const [paymentId, setPaymentId] = useState('');
  const [pollCount, setPollCount] = useState(0);
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
        console.error('[v0] Error loading person:', err);
      } finally {
        setLoading(false);
      }
    };
    loadPerson();
  }, [personId, router]);

  // Poll payment status
  useEffect(() => {
    if (status !== 'polling' || !paymentId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat-foreigners/payments/status?paymentId=${paymentId}`);
        const data = await res.json();
        setPollCount((prev) => prev + 1);

        if (data.success && data.data?.status === 'completed') {
          setStatus('success');
          clearInterval(interval);
          setTimeout(() => router.push(`/dashboard/chat-foreigners/chat/${personId}`), 2000);
        } else if (data.data?.status === 'failed') {
          setStatus('failed');
          setError('Payment failed. Please try again.');
          clearInterval(interval);
        } else if (pollCount > 24) {
          setStatus('failed');
          setError('Payment timed out. Please check your M-Pesa and try again.');
          clearInterval(interval);
        }
      } catch (err) {
        console.error('[v0] Poll error:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [status, paymentId, personId, pollCount, router]);

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
        setPaymentId(data.data.paymentId);
        setPollCount(0);
        setStatus('polling');
      } else {
        setStatus('failed');
        setError(data.error || 'Failed to initiate payment.');
      }
    } catch (err) {
      setStatus('failed');
      setError('Something went wrong. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-zinc-950 items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!person) return null;

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center text-zinc-100">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Connected!</h2>
          <p className="text-zinc-400 text-sm">
            You can now chat with {person.name}. Redirecting...
          </p>
          <Loader2 className="animate-spin text-primary mx-auto mt-4" size={20} />
        </div>
      </div>
    );
  }

  const interestsList = person.interests?.split(',').map((i) => i.trim()).filter(Boolean) ?? [];
  const categoryLabel =
    INTEREST_LABELS[person.personalityType || ''] ??
    INTEREST_LABELS[person.category] ??
    person.category;
  const unlockPrice = 100; // Fixed KSH 100 for all personalities

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 overflow-y-auto">
      {/* Header */}
      <header className="px-4 py-4 flex items-center sticky top-0 bg-zinc-950/80 backdrop-blur-md z-10 border-b border-zinc-800">
        <Link
          href="/dashboard/chat-foreigners"
          className="p-2 -ml-2 mr-2 rounded-full hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-bold">Profile</h1>
      </header>

      <div className="max-w-2xl mx-auto w-full px-6 py-6 space-y-6 pb-16">
        {/* Hero gradient */}
        <div className="relative -mx-6 -mt-6 h-36 bg-gradient-to-br from-primary/20 via-transparent to-transparent rounded-b-3xl overflow-hidden">
          <div className="absolute inset-0 opacity-30 blur-3xl">
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-primary/40 rounded-full" />
          </div>
        </div>

        {/* Avatar + info */}
        <div className="flex flex-col items-center text-center space-y-4 -mt-20 relative z-10">
          <div className="relative">
            <div className="absolute inset-0 -m-1 bg-gradient-to-br from-primary to-primary/50 rounded-full blur opacity-75 animate-pulse" />
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-zinc-950 shadow-2xl relative bg-zinc-900">
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
            <span className="absolute bottom-1 right-1 w-6 h-6 bg-primary rounded-full border-4 border-zinc-950 shadow-lg" />
          </div>

          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-4xl font-bold text-balance">{person.name}</h1>
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            {person.username && (
              <p className="text-zinc-500 text-sm mt-1">@{person.username.replace('@', '')}</p>
            )}
            <div className="flex items-center justify-center gap-1 mt-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <p className="text-sm font-medium text-primary">Active now</p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 justify-center pt-1">
            <span className="bg-primary/20 text-primary border border-primary/30 rounded-full text-xs font-medium px-3 py-1 flex items-center gap-1">
              <Briefcase className="w-3 h-3" />
              {categoryLabel}
            </span>
            {person.mood && (
              <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-full text-xs font-medium px-3 py-1 flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {person.mood.charAt(0).toUpperCase() + person.mood.slice(1)}
              </span>
            )}
            {person.speakingStyle && (
              <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-full text-xs font-medium px-3 py-1">
                {person.speakingStyle}
              </span>
            )}
          </div>
        </div>

        {/* About */}
        {person.bio && (
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-primary/20 rounded-2xl p-6">
            <h2 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> About
            </h2>
            <p className="text-zinc-200 leading-relaxed text-base italic font-light">{person.bio}</p>
          </div>
        )}

        {/* Interests */}
        {interestsList.length > 0 && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Interests</h2>
            <div className="flex flex-wrap gap-2">
              {interestsList.map((interest, i) => (
                <span
                  key={i}
                  className="bg-primary/15 text-primary border border-primary/40 rounded-full text-xs px-3 py-1.5 font-medium"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Conversations', value: '1.2k+' },
            { label: 'Positive', value: '98%' },
            { label: 'Rating', value: '4.8★' },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">{s.value}</p>
              <p className="text-[11px] text-zinc-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        {hasAccess ? (
          <Link
            href={`/dashboard/chat-foreigners/chat/${person.id}`}
            className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-14 rounded-full text-lg shadow-[0_0_20px_rgba(0,168,132,0.3)] transition-colors"
          >
            <MessageSquare className="w-5 h-5" />
            Open Chat
          </Link>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-zinc-400" />
                <span className="font-semibold text-zinc-300">Unlock to Chat</span>
              </div>
              <span className="text-2xl font-bold text-zinc-100">KES {unlockPrice}</span>
            </div>

            {status === 'polling' ? (
              <div className="flex flex-col items-center py-6 gap-3">
                <Loader2 className="animate-spin text-primary" size={36} />
                <p className="font-semibold text-zinc-200">Waiting for M-Pesa payment...</p>
                <p className="text-sm text-zinc-500 text-center">
                  Enter your PIN on the prompt sent to your phone.
                </p>
                <p className="text-xs text-zinc-600">Checking... ({pollCount}/24)</p>
                <button
                  onClick={() => { setStatus('idle'); setPollCount(0); }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors mt-1"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <form onSubmit={handleUnlock} className="space-y-4">
                {error && (
                  <div className="bg-red-950/50 border border-red-900/50 text-red-400 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-400">M-Pesa Number</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 0712345678"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                    autoComplete="tel"
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === 'pending'}
                  className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-bold h-12 rounded-full transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {status === 'pending' ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
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
      </div>
    </div>
  );
}
