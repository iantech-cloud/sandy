'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  User as UserIcon,
  Mail,
  Phone,
  Trophy,
  Copy,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Award,
  Hash,
} from 'lucide-react';
import { toast } from 'sonner';

interface Profile {
  username: string;
  phone_number: string;
  referral_id: string | null;
  email: string;
  is_verified: boolean;
  is_active: boolean;
  is_approved: boolean;
  status: string;
  ban_reason: string | null;
  banned_at: string | null;
  suspension_reason: string | null;
  suspended_at: string | null;
  level: number;
  rank: string;
  total_earnings: number;
  tasks_completed: number;
  available_spins: number;
}

interface ProfileContentProps {
  initialProfile: Profile | null;
}

export function ProfileContent({ initialProfile }: ProfileContentProps) {
  // useState: ephemeral UI state only (rule 6)
  const [copied, setCopied] = useState(false);

  // React Query: data fetching with caching (rule 2)
  const { data: profile = initialProfile, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'profile'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      const data = await response.json();
      return data.success ? data.data : null;
    },
    initialData: initialProfile,
    staleTime: 60000, // 60 seconds
  });

  const handleCopyReferralCode = async (referralId: string) => {
    try {
      await navigator.clipboard.writeText(referralId);
      setCopied(true);
      toast.success('Referral code copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy referral code');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-3 text-red-800">
          <AlertTriangle className="w-5 h-5" />
          <div>
            <h2 className="font-bold">Error Loading Profile</h2>
            <p className="text-sm">Failed to load your profile data. Please try again.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-8 text-white">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <UserIcon className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{profile.username}</h1>
            <p className="text-blue-100">{profile.rank}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{profile.level}</div>
            <div className="text-blue-100">Level</div>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-2">
          {profile.is_verified && (
            <span className="bg-green-500/30 border border-green-400 text-green-100 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Verified
            </span>
          )}
          {profile.is_approved && (
            <span className="bg-green-500/30 border border-green-400 text-green-100 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Approved
            </span>
          )}
          {profile.is_active && (
            <span className="bg-green-500/30 border border-green-400 text-green-100 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Active
            </span>
          )}
          {profile.status === 'banned' && (
            <span className="bg-red-500/30 border border-red-400 text-red-100 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Banned
            </span>
          )}
          {profile.status === 'suspended' && (
            <span className="bg-yellow-500/30 border border-yellow-400 text-yellow-100 px-3 py-1 rounded-full text-sm flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Suspended
            </span>
          )}
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Contact Information
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-900">{profile.email}</span>
              {profile.is_verified && <CheckCircle className="w-4 h-4 text-green-600" />}
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Phone Number</label>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-gray-900">{profile.phone_number || 'Not provided'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Referral Information */}
      {profile.referral_id && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Hash className="w-5 h-5" />
            Referral Code
          </h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">Your unique referral code:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white border border-blue-300 rounded px-3 py-2 font-mono text-blue-600">
                {profile.referral_id}
              </code>
              <button
                onClick={() => handleCopyReferralCode(profile.referral_id!)}
                className={`px-3 py-2 rounded border transition-colors ${
                  copied
                    ? 'bg-green-100 border-green-300 text-green-700'
                    : 'bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200'
                }`}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            {copied && (
              <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Copied to clipboard!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Account Statistics */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Account Statistics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-gray-600">Total Earnings</p>
            <p className="text-2xl font-bold text-green-600">
              KES {profile.total_earnings?.toLocaleString() || '0'}
            </p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-600">Tasks Completed</p>
            <p className="text-2xl font-bold text-blue-600">{profile.tasks_completed || '0'}</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-gray-600">Available Spins</p>
            <p className="text-2xl font-bold text-purple-600">{profile.available_spins || '0'}</p>
          </div>
        </div>
      </div>

      {/* Ban/Suspension Information */}
      {(profile.status === 'banned' || profile.status === 'suspended') && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-red-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Account {profile.status === 'banned' ? 'Ban' : 'Suspension'} Details
          </h2>
          <div className="space-y-2 text-red-700">
            <p>
              <span className="font-medium">Reason:</span> {profile.ban_reason || profile.suspension_reason || 'No reason provided'}
            </p>
            <p>
              <span className="font-medium">Date:</span>{' '}
              {new Date(profile.banned_at || profile.suspended_at!).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
