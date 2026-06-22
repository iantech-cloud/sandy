'use server';

import { connectToDatabase, ChatForeignersBot, ChatForeignersBotAccess, ChatForeignersProfile, ChatForeignersReferralEarning } from '@/app/lib/models';
import { getCurrentUserFromSession } from '@/app/lib/auth';
import { successResponse, errorResponse, ApiError, paginatedResponse } from '@/app/lib/responses';
import { z } from 'zod';

// ========================================================================
// List All Active Bots - Optimized with lean() and select()
// ========================================================================
export async function listChatForeignersBots() {
  try {
    await connectToDatabase();

    const bots = await ChatForeignersBot.find({ isActive: true })
      .select(
        'name username description bio personalityType speakingStyle mood interests ' +
        'avatar_url nationality tagline welcomeMessage purpose languages availabilityNote ' +
        'category unlockCost_cents messageEarning_cents created_at isActive'
      )
      .sort({ created_at: -1 })
      .lean()
      .exec();

    return successResponse(
      bots.map((bot: any) => ({
        id: bot._id.toString(),
        name: bot.name,
        username: bot.username,
        description: bot.description || bot.bio,
        bio: bot.bio,
        personalityType: bot.personalityType,
        speakingStyle: bot.speakingStyle,
        mood: bot.mood,
        interests: bot.interests,
        avatar_url: bot.avatar_url,
        avatar: bot.avatar_url,
        nationality: bot.nationality,
        tagline: bot.tagline,
        welcomeMessage: bot.welcomeMessage,
        purpose: bot.purpose,
        languages: bot.languages,
        availabilityNote: bot.availabilityNote,
        category: bot.category,
        unlockCost_cents: bot.unlockCost_cents,
        unlockPrice: bot.unlockCost_cents / 100,
        messageEarning_cents: bot.messageEarning_cents,
        messageEarningPrice: bot.messageEarning_cents / 100,
        isActive: bot.isActive,
        createdAt: bot.created_at,
      })),
      'Bots retrieved successfully'
    );
  } catch (error) {
    console.error('[ChatForeigners] Bots list error:', error);
    return ApiError.internal('Failed to retrieve bots', error instanceof Error ? error.message : undefined);
  }
}

// ========================================================================
// Get Bot Details - Optimized with lean() and select()
// ========================================================================
export async function getBotDetails(botId: string) {
  try {
    // Validate botId format
    if (!botId || botId.length < 1) {
      return ApiError.badRequest('Bot ID is required');
    }

    await connectToDatabase();

    const bot = await ChatForeignersBot.findById(botId)
      .select(
        'name username description bio personalityType speakingStyle mood interests ' +
        'avatar_url nationality tagline welcomeMessage purpose languages availabilityNote ' +
        'category unlockCost_cents messageEarning_cents created_at'
      )
      .lean()
      .exec();

    if (!bot) {
      return ApiError.notFound('Bot');
    }

    return successResponse({
      id: (bot as any)._id.toString(),
      name: bot.name,
      username: bot.username,
      description: bot.description || bot.bio,
      bio: bot.bio,
      personalityType: bot.personalityType,
      speakingStyle: bot.speakingStyle,
      mood: bot.mood,
      interests: bot.interests,
      avatar_url: bot.avatar_url,
      nationality: bot.nationality,
      tagline: bot.tagline,
      welcomeMessage: bot.welcomeMessage,
      purpose: bot.purpose,
      languages: bot.languages,
      availabilityNote: bot.availabilityNote,
      category: bot.category,
      unlockCost_cents: bot.unlockCost_cents,
      unlockPrice: bot.unlockCost_cents / 100,
      messageEarning_cents: bot.messageEarning_cents,
      messageEarningPrice: bot.messageEarning_cents / 100,
    });
  } catch (error) {
    console.error('[ChatForeigners] Bot details error:', error);
    return ApiError.internal('Failed to retrieve bot details', error instanceof Error ? error.message : undefined);
  }
}

// ========================================================================
// Get User's Bot Access - Optimized with lean()
// ========================================================================
export async function getUserBotAccess() {
  try {
    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return ApiError.unauthorized('Please log in to view your bot access');
    }

    // LIFETIME UNLOCK: include all accesses regardless of isClosed
    const accesses = await ChatForeignersBotAccess.find({
      user_id: currentUser._id.toString(),
    })
      .select('bot_id unlockedAt lifetimeAccessUnlocked chat_earnings_cents')
      .populate('bot_id', 'name description avatar_url category')
      .sort({ unlockedAt: -1 })
      .lean()
      .exec();

    return successResponse(
      accesses
        .filter((access: any) => access.bot_id !== null) // Skip deleted bots
        .map((access: any) => ({
          botId: access.bot_id._id.toString(),
          botName: access.bot_id.name,
          botAvatar: access.bot_id.avatar_url,
          botCategory: access.bot_id.category,
          unlockedAt: access.unlockedAt,
          lifetimeAccessUnlocked: access.lifetimeAccessUnlocked,
          chatEarnings_cents: access.chat_earnings_cents,
          chatEarnings: (access.chat_earnings_cents || 0) / 100,
        })),
      'Bot access retrieved successfully'
    );
  } catch (error) {
    console.error('[ChatForeigners] Bot access error:', error);
    return ApiError.internal('Failed to retrieve bot access', error instanceof Error ? error.message : undefined);
  }
}

// ========================================================================
// Check if User Has Access to Bot - Optimized with lean()
// ========================================================================
export async function checkBotAccess(botId: string) {
  try {
    if (!botId || botId.length < 1) {
      return { success: false, hasAccess: false, error: ApiError.badRequest('Bot ID required') };
    }

    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return { success: false, hasAccess: false, error: 'Not authenticated' };
    }

    const access = await ChatForeignersBotAccess.findOne({
      user_id: currentUser._id.toString(),
      bot_id: botId,
    })
      .select('lifetimeAccessUnlocked unlockedAt isClosed chat_earnings_cents')
      .lean()
      .exec();

    // LIFETIME UNLOCK: any access record means permanent access regardless of isClosed
    const hasActiveAccess = !!access;

    return {
      success: true,
      hasAccess: hasActiveAccess,
      data: access
        ? {
            lifetimeAccessUnlocked: access.lifetimeAccessUnlocked,
            isClosed: access.isClosed || false,
            unlockedAt: access.unlockedAt,
            chatEarnings_cents: (access as any).chat_earnings_cents || 0,
            chatEarnings: ((access as any).chat_earnings_cents || 0) / 100,
          }
        : null,
    };
  } catch (error) {
    console.error('[ChatForeigners] Access check error:', error);
    return {
      success: false,
      hasAccess: false,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

// ========================================================================
// Update Message Count (called after each message in chat)
// ========================================================================
export async function updateBotMessageCount(botId: string) {
  try {
    if (!botId || botId.length < 1) {
      return ApiError.badRequest('Bot ID is required');
    }

    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return ApiError.unauthorized('Please log in to send messages');
    }

    const access = await ChatForeignersBotAccess.findOne({
      user_id: currentUser._id.toString(),
      bot_id: botId,
    });

    if (!access) {
      return ApiError.badRequest('No access to this bot');
    }

    // Note: The message earning logic is handled in the chat route
    // This function is kept for backward compatibility
    
    return successResponse(
      {
        success: true,
        botId,
        userId: currentUser._id.toString(),
      },
      'Message recorded successfully'
    );
  } catch (error) {
    console.error('[ChatForeigners] Message count update error:', error);
    return ApiError.internal('Failed to update message count', error instanceof Error ? error.message : undefined);
  }
}

// ========================================================================
// Record Milestone Bonus (called when milestone reached)
// ========================================================================
export async function recordMilestoneBonus(botId: string) {
  try {
    if (!botId || botId.length < 1) {
      return ApiError.badRequest('Bot ID is required');
    }

    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return ApiError.unauthorized('Please log in to claim milestone bonus');
    }

    // Get bot details
    const bot = await ChatForeignersBot.findById(botId).select('name milestoneBonus_cents').lean();
    if (!bot) {
      return ApiError.notFound('Bot');
    }

    // Check if user was referred
    const profile = await ChatForeignersProfile.findOne({
      user_id: currentUser._id.toString(),
    })
      .select('referralCode')
      .lean();

    if (!profile?.referralCode) {
      return ApiError.badRequest('User profile not found or no referral code');
    }

    // Find referrer
    const referrerProfile = await ChatForeignersProfile.findOne({
      referralCode: profile.referralCode,
    })
      .select('user_id')
      .lean();

    if (!referrerProfile) {
      return ApiError.badRequest('Referrer profile not found');
    }

    // Check if milestone bonus already exists for this bot
    const existingBonus = await ChatForeignersReferralEarning.findOne({
      referrer_id: referrerProfile.user_id,
      referee_id: currentUser._id.toString(),
      bot_id: botId,
      earningType: 'milestone_bonus',
    })
      .select('_id')
      .lean();

    if (existingBonus) {
      return ApiError.badRequest('Milestone bonus already claimed for this bot');
    }

    // Record milestone bonus earning
    const earning = await ChatForeignersReferralEarning.create({
      referrer_id: referrerProfile.user_id,
      referee_id: currentUser._id.toString(),
      bot_id: botId,
      earningType: 'milestone_bonus',
      amount_cents: (bot as any).milestoneBonus_cents || 0,
      status: 'completed',
    });

    console.log('[ChatForeigners] Milestone bonus recorded:', {
      referrerId: referrerProfile.user_id,
      botId,
      amount: ((bot as any).milestoneBonus_cents || 0) / 100,
    });

    return successResponse(
      { earningId: earning._id.toString() },
      'Milestone bonus claimed successfully'
    );
  } catch (error) {
    console.error('[ChatForeigners] Milestone bonus error:', error);
    return ApiError.internal('Failed to claim milestone bonus', error instanceof Error ? error.message : undefined);
  }
}

// ========================================================================
// ADMIN: Create Bot
// ========================================================================
export async function createChatForeignersBot(data: {
  name: string;
  username: string;
  avatar?: string;
  bio?: string;
  personalityType?: string;
  speakingStyle?: string;
  mood?: string;
  interests?: string;
  nationality?: string;
  unlockPrice?: number;
}) {
  try {
    await connectToDatabase();

    // Validate username format: only lowercase letters, digits, and underscores
    const cleanUsername = data.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    // Pre-creation uniqueness check (application-level) before hitting DB index
    const existing = await ChatForeignersBot.findOne({ username: cleanUsername }).lean();
    if (existing) {
      return {
        success: false,
        error: `Username "@${cleanUsername}" is already taken. Please choose a different username.`,
      };
    }

    const nameDuplicate = await ChatForeignersBot.findOne({
      name: { $regex: new RegExp(`^${data.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }).lean();
    if (nameDuplicate) {
      return {
        success: false,
        error: `A person named "${data.name}" already exists. Please use a different name.`,
      };
    }

    const bot = await ChatForeignersBot.create({
      name: data.name.trim(),
      username: cleanUsername,
      avatar_url: data.avatar,
      bio: data.bio,
      description: data.bio,
      personalityType: data.personalityType,
      speakingStyle: data.speakingStyle,
      mood: data.mood,
      interests: data.interests,
      nationality: data.nationality,
      unlockCost_cents: (data.unlockPrice || 100) * 100,
      isActive: true,
    });

    return {
      success: true,
      data: {
        _id: bot._id.toString(),
        name: bot.name,
        username: bot.username,
        avatar: bot.avatar_url,
        bio: bot.bio,
        personalityType: bot.personalityType,
        speakingStyle: bot.speakingStyle,
        mood: bot.mood,
        interests: bot.interests,
        unlockPrice: bot.unlockCost_cents / 100,
      },
    };
  } catch (error: any) {
    // Catch DB-level unique index violation as a last resort
    if (error?.code === 11000) {
      const field = Object.keys(error.keyValue ?? {})[0] ?? 'field';
      return {
        success: false,
        error: `A person with that ${field} already exists. Please choose a different value.`,
      };
    }
    console.error('[ChatForeigners] Bot creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create bot',
    };
  }
}

// ========================================================================
// ADMIN: Update Bot
// ========================================================================
export async function updateChatForeignersBot(botId: string, data: {
  name?: string;
  avatar?: string;
  bio?: string;
  personalityType?: string;
  speakingStyle?: string;
  mood?: string;
  interests?: string;
  unlockPrice?: number;
}) {
  try {
    await connectToDatabase();

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.avatar) updateData.avatar_url = data.avatar;
    if (data.bio) updateData.bio = data.bio;
    if (data.personalityType) updateData.personalityType = data.personalityType;
    if (data.speakingStyle) updateData.speakingStyle = data.speakingStyle;
    if (data.mood) updateData.mood = data.mood;
    if (data.interests) updateData.interests = data.interests;
    if (data.unlockPrice) updateData.unlockCost_cents = data.unlockPrice * 100;

    const bot = await ChatForeignersBot.findByIdAndUpdate(botId, updateData, {
      new: true,
    });

    if (!bot) {
      return { success: false, error: 'Bot not found' };
    }

    return {
      success: true,
      data: {
        _id: bot._id.toString(),
        name: bot.name,
        username: bot.username,
        avatar: bot.avatar_url,
        bio: bot.bio,
        personalityType: bot.personalityType,
        speakingStyle: bot.speakingStyle,
        mood: bot.mood,
        interests: bot.interests,
        unlockPrice: bot.unlockCost_cents / 100,
      },
    };
  } catch (error) {
    console.error('[ChatForeigners] Bot update error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update bot',
    };
  }
}

// ========================================================================
// ADMIN: Delete Bot
// ========================================================================
export async function deleteChatForeignersBot(botId: string) {
  try {
    await connectToDatabase();

    const bot = await ChatForeignersBot.findByIdAndDelete(botId);

    if (!bot) {
      return { success: false, error: 'Bot not found' };
    }

    return {
      success: true,
      data: { botId: bot._id.toString() },
    };
  } catch (error) {
    console.error('[ChatForeigners] Bot delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete bot',
    };
  }
}
