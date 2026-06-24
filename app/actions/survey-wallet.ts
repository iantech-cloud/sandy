'use server';

import { auth } from '@/auth';
import { connectToDatabase } from '@/app/lib/mongoose';
import { Profile, Transaction } from '@/app/lib/models';
import { Query } from 'mongoose';

// Helper function to find profile by email
async function findProfileByEmail(email: string) {
  const query = Profile.findOne({ email }) as Query<any | null, any>;
  const result = await (query as any).lean().exec();
  return result;
}

interface SurveyWalletData {
  totalEarnings: number;
  surveysCompleted: number;
  lastSurveyDate: Date | null;
  nextAvailableDate?: string;
}

interface SurveyTransaction {
  id: string;
  amount: number;
  description: string;
  date: Date;
  status: 'pending' | 'completed' | 'failed';
  score?: number;
  survey_title?: string;
}

/**
 * Get survey wallet data for current user
 */
export async function getSurveyWallet(): Promise<{
  success: boolean;
  data?: SurveyWalletData;
  message?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return {
        success: false,
        message: 'You must be logged in.',
      };
    }

    await connectToDatabase();

    const user = await findProfileByEmail(session.user.email);
    if (!user) {
      return {
        success: false,
        message: 'User profile not found.',
      };
    }

    // Get all survey transactions for this user
    const surveyTransactions: any[] = await Transaction.find({
      user_id: user._id,
      type: 'SURVEY',
      status: 'completed',
    }).sort({ created_at: -1 }).lean();

    const totalEarnings = surveyTransactions.reduce(
      (sum, tx) => sum + (tx.amount_cents || 0),
      0
    );

    const surveysCompleted = surveyTransactions.length;
    const lastSurveyDate = surveyTransactions.length > 0 
      ? surveyTransactions[0].created_at 
      : null;

    // Calculate next Tuesday
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilTuesday = dayOfWeek === 2 ? 0 : (9 - dayOfWeek) % 7;
    const nextTuesday = new Date(today);
    nextTuesday.setDate(nextTuesday.getDate() + daysUntilTuesday);
    const nextAvailableDate = nextTuesday.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });

    return {
      success: true,
      data: {
        totalEarnings: totalEarnings / 100, // Convert cents to KES
        surveysCompleted,
        lastSurveyDate,
        nextAvailableDate,
      },
    };
  } catch (error: any) {
    console.error('[SurveyWallet] Error:', error);
    return {
      success: false,
      message: 'Failed to get survey wallet data.',
    };
  }
}

/**
 * Get survey earning transactions
 */
export async function getSurveyTransactions(limit: number = 10): Promise<{
  success: boolean;
  data?: SurveyTransaction[];
  message?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return {
        success: false,
        message: 'You must be logged in.',
      };
    }

    await connectToDatabase();

    const user = await findProfileByEmail(session.user.email);
    if (!user) {
      return {
        success: false,
        message: 'User profile not found.',
      };
    }

    const transactions: any[] = await Transaction.find({
      user_id: user._id,
      type: 'SURVEY',
    })
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();

    const formattedTransactions: SurveyTransaction[] = transactions.map((tx) => ({
      id: tx._id?.toString() || '',
      amount: (tx.amount_cents || 0) / 100,
      description: tx.description || 'Survey completion',
      date: tx.created_at || new Date(),
      status: tx.status as 'pending' | 'completed' | 'failed',
      score: tx.metadata?.score,
      survey_title: tx.metadata?.survey_id,
    }));

    return {
      success: true,
      data: formattedTransactions,
    };
  } catch (error: any) {
    console.error('[SurveyTransactions] Error:', error);
    return {
      success: false,
      message: 'Failed to get survey transactions.',
    };
  }
}
