'use server';

import getServerSession from 'next-auth';
import { connectToDatabase } from '@/app/lib/mongoose';
import { auth } from '@/auth.config';

interface InitiateGamingDepositResult {
  success: boolean;
  message: string;
  data?: {
    messageReference: string;
    amount: number;
    phoneNumber: string;
    depositId: string;
  };
}

export async function initiateGameingDeposit(amountCents: number): Promise<InitiateGamingDepositResult> {
  try {
    const session = await getServerSession(auth);

    if (!session?.user?.id) {
      return {
        success: false,
        message: 'User not authenticated',
      };
    }

    const userId = session.user.id as string;
    const phoneNumber = (session.user as any)?.phone_number || '';

    if (!phoneNumber) {
      return {
        success: false,
        message: 'Phone number not found in profile',
      };
    }

    await connectToDatabase();

    // Validate amount
    if (amountCents < 1000) { // 10 KES minimum
      return {
        success: false,
        message: 'Minimum deposit is KES 10',
      };
    }

    if (amountCents > 100000000) { // 1M KES maximum
      return {
        success: false,
        message: 'Maximum deposit is KES 1,000,000',
      };
    }

    // Generate message reference
    const messageReference = `GAMING_${Date.now()}${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    // For now, we'll just return success with the message reference
    // In production, this would integrate with Co-op Bank and create proper transaction records

    return {
      success: true,
      message: 'Gaming deposit initiated successfully',
      data: {
        messageReference,
        amount: amountCents / 100,
        phoneNumber,
        depositId: messageReference,
      },
    };
  } catch (error) {
    console.error('[Gaming] Error initiating deposit:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to initiate gaming deposit',
    };
  }
}

export async function getGamingWalletBalance() {
  try {
    const session = await getServerSession(auth);

    if (!session?.user?.id) {
      return {
        success: false,
        message: 'User not authenticated',
      };
    }

    await connectToDatabase();

    // Fetch gaming wallet balance from database
    // For now, return placeholder
    return {
      success: true,
      data: {
        balance: 0,
        totalWagered: 0,
        totalWinnings: 0,
      },
    };
  } catch (error) {
    console.error('[Gaming] Error fetching wallet balance:', error);
    return {
      success: false,
      message: 'Failed to fetch gaming wallet balance',
    };
  }
}

export async function recordGameResult(
  gameId: string,
  betAmount: number,
  result: 'win' | 'loss',
  winnings: number
) {
  try {
    const session = await getServerSession(auth);

    if (!session?.user?.id) {
      return {
        success: false,
        message: 'User not authenticated',
      };
    }

    await connectToDatabase();

    // Record the game result in database
    // This would update the gaming wallet balance and transaction history

    return {
      success: true,
      message: 'Game result recorded successfully',
    };
  } catch (error) {
    console.error('[Gaming] Error recording game result:', error);
    return {
      success: false,
      message: 'Failed to record game result',
    };
  }
}
