'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Loader, CheckCircle2 } from 'lucide-react';

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
}

type UnlockStatus = 'idle' | 'pending' | 'polling' | 'success' | 'failed';

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

  useEffect(() => {
    const loadPerson = async () => {
      try {
        const res = await fetch(`/api/chat-foreigners/bots?type=details&botId=${personId}`);
        const data = await res.json();
        if (data.success) {
          setPerson(data.data);
        } else {
          router.push('/dashboard/chat-foreigners');
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
        } else if (pollCount > 20) {
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
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (!person) return null;

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle2 className="mx-auto text-green-500 mb-4" size={64} />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Unlocked!</h2>
          <p className="text-slate-600 mb-4">
            You now have access to chat with {person.name}. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/dashboard/chat-foreigners"
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition"
        >
          <ArrowLeft size={20} />
          Back to Chat Foreigners
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Person profile */}
          {person.avatar_url ? (
            <div className="h-48 bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center overflow-hidden">
              <img
                src={person.avatar_url}
                alt={person.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="h-48 bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
              <span className="text-white text-6xl font-bold">{person.name[0]}</span>
            </div>
          )}

          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900">{person.name}</h1>
              {person.username && (
                <p className="text-slate-500">@{person.username}</p>
              )}
              {person.bio && (
                <p className="text-slate-600 mt-2">{person.bio}</p>
              )}

              <div className="grid grid-cols-2 gap-3 mt-4">
                {person.personalityType && (
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide">Personality</p>
                    <p className="text-sm text-blue-900 mt-1">{person.personalityType}</p>
                  </div>
                )}
                {person.speakingStyle && (
                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-xs text-purple-500 font-semibold uppercase tracking-wide">Speaking Style</p>
                    <p className="text-sm text-purple-900 mt-1">{person.speakingStyle}</p>
                  </div>
                )}
                {person.mood && (
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-green-500 font-semibold uppercase tracking-wide">Mood</p>
                    <p className="text-sm text-green-900 mt-1">{person.mood}</p>
                  </div>
                )}
                {person.interests && (
                  <div className="bg-orange-50 rounded-lg p-3">
                    <p className="text-xs text-orange-500 font-semibold uppercase tracking-wide">Interests</p>
                    <p className="text-sm text-orange-900 mt-1">{person.interests}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment form */}
            <div className="border-t border-slate-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Lock size={18} className="text-slate-500" />
                  <span className="font-semibold text-slate-700">Unlock Access</span>
                </div>
                <span className="text-2xl font-bold text-slate-900">
                  KES {(person.unlockCost_cents / 100).toFixed(0)}
                </span>
              </div>

              {status === 'polling' ? (
                <div className="text-center py-6">
                  <Loader className="animate-spin text-blue-600 mx-auto mb-3" size={32} />
                  <p className="font-semibold text-slate-900">Waiting for M-Pesa payment...</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Check your phone and enter your M-Pesa PIN to complete payment.
                  </p>
                  <p className="text-xs text-slate-400 mt-2">Checking status... ({pollCount}/20)</p>
                </div>
              ) : (
                <form onSubmit={handleUnlock} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      {error}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      M-Pesa Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="254712345678"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">Format: 254712345678</p>
                  </div>
                  <button
                    type="submit"
                    disabled={status === 'pending'}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
                  >
                    {status === 'pending' ? (
                      <>
                        <Loader size={18} className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Lock size={18} />
                        Pay KES {(person.unlockCost_cents / 100).toFixed(0)} &amp; Unlock
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
