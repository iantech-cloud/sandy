'use server';

import { connectToDatabase, ChatForeignersBot, ChatForeignersBotAccess, ChatForeignersProfile, ChatForeignersReferralEarning, Profile } from '@/app/lib/models';
import { auth } from '@/auth';

// ========================================================================
// Helper: Get Current User from Session
// ========================================================================
async function getCurrentUserFromSession() {
  const session = await auth();
  const sessionId = (session?.user as any)?.id || (session?.user as any)?.userId;
  
  if (!session?.user || (!sessionId && !session.user.email)) {
    return null;
  }

  let currentUser = null;
  if (sessionId) {
    currentUser = await Profile.findOne({ _id: sessionId }).lean();
  }
  if (!currentUser && session.user.email) {
    const emailPattern = new RegExp(
      `^${session.user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
      'i'
    );
    currentUser = await Profile.findOne({ email: { $regex: emailPattern } }).lean();
  }

  return currentUser;
}

// ========================================================================
// List All Active Bots
// ========================================================================
export async function listChatForeignersBots() {
  try {
    await connectToDatabase();

    const bots = await ChatForeignersBot.find({ isActive: true }).sort({
      created_at: -1,
    });

    return {
      success: true,
      data: bots.map((bot) => ({
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
        isActive: bot.isActive,
        createdAt: bot.created_at,
      })),
    };
  } catch (error) {
    console.error('[ChatForeigners] Bots list error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

// ========================================================================
// Get Bot Details
// ========================================================================
export async function getBotDetails(botId: string) {
  try {
    await connectToDatabase();

    const bot = await ChatForeignersBot.findById(botId);
    if (!bot) {
      return { success: false, error: 'Bot not found' };
    }

    return {
      success: true,
      data: {
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
        nationality: bot.nationality,
        tagline: bot.tagline,
        welcomeMessage: bot.welcomeMessage,
        purpose: bot.purpose,
        languages: bot.languages,
        availabilityNote: bot.availabilityNote,
        category: bot.category,
        unlockCost_cents: bot.unlockCost_cents,
        unlockPrice: bot.unlockCost_cents / 100,
        messageLimitForMilestone: bot.messageLimitForMilestone,
      },
    };
  } catch (error) {
    console.error('[ChatForeigners] Bot details error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

// ========================================================================
// Get User's Bot Access (which bots they've unlocked)
// ========================================================================
export async function getUserBotAccess() {
  try {
    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    const accesses = await ChatForeignersBotAccess.find({
      user_id: currentUser._id,
      isClosed: { $ne: true }, // only active (non-closed) accesses
    })
      .populate('bot_id', 'name description avatar_url category')
      .sort({ unlockedAt: -1 });

    return {
      success: true,
      data: accesses.map((access) => ({
        botId: access.bot_id._id.toString(),
        botName: access.bot_id.name,
        botAvatar: access.bot_id.avatar_url,
        messageCount: access.messageCount,
        firstMilestoneComplete: access.firstMilestoneComplete,
        unlockedAt: access.unlockedAt,
      })),
    };
  } catch (error) {
    console.error('[ChatForeigners] Bot access error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

// ========================================================================
// Check if User Has Access to Bot
// ========================================================================
export async function checkBotAccess(botId: string) {
  try {
    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return { success: false, hasAccess: false, error: 'Not authenticated' };
    }

    const access = await ChatForeignersBotAccess.findOne({
      user_id: currentUser._id,
      bot_id: botId,
    });

    // Access is only valid if it's not closed
    const hasActiveAccess = !!access && !access.isClosed;

    return {
      success: true,
      hasAccess: hasActiveAccess,
      data: access
        ? {
            messageCount: access.messageCount,
            firstMilestoneComplete: access.firstMilestoneComplete,
            isClosed: access.isClosed || false,
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
    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    const access = await ChatForeignersBotAccess.findOne({
      user_id: currentUser._id,
      bot_id: botId,
    });

    if (!access) {
      return { success: false, error: 'No access to this bot' };
    }

    access.messageCount += 1;

    const bot = await ChatForeignersBot.findById(botId);
    if (!bot) {
      return { success: false, error: 'Bot not found' };
    }

    // Check if milestone reached
    let milestoneReached = false;
    if (
      !access.firstMilestoneComplete &&
      access.messageCount >= bot.messageLimitForMilestone
    ) {
      access.firstMilestoneComplete = true;
      access.milestoneCompletedAt = new Date();
      milestoneReached = true;
    }

    await access.save();

    return {
      success: true,
      data: {
        messageCount: access.messageCount,
        milestoneReached,
      },
    };
  } catch (error) {
    console.error('[ChatForeigners] Message count update error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

// ========================================================================
// Record Milestone Bonus (called when milestone reached)
// ========================================================================
export async function recordMilestoneBonus(botId: string) {
  try {
    await connectToDatabase();
    const currentUser = await getCurrentUserFromSession();

    if (!currentUser) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get bot details
    const bot = await ChatForeignersBot.findById(botId);
    if (!bot) {
      return { success: false, error: 'Bot not found' };
    }

    // Check if user was referred
    const profile = await ChatForeignersProfile.findOne({
      user_id: currentUser._id,
    });

    if (!profile?.referralCode) {
      return { success: false, error: 'User profile not found' };
    }

    // Find referrer
    const referrerProfile = await ChatForeignersProfile.findOne({
      referralCode: profile.referralCode,
    });

    if (!referrerProfile) {
      return { success: false, error: 'Referrer not found' };
    }

    // Check if milestone bonus already exists for this bot
    const existingBonus = await ChatForeignersReferralEarning.findOne({
      referrer_id: referrerProfile.user_id,
      referee_id: currentUser._id,
      bot_id: botId,
      earningType: 'milestone_bonus',
    });

    if (existingBonus) {
      return { success: false, error: 'Milestone bonus already claimed' };
    }

    // Record milestone bonus earning
    const earning = await ChatForeignersReferralEarning.create({
      referrer_id: referrerProfile.user_id,
      referee_id: currentUser._id,
      bot_id: botId,
      earningType: 'milestone_bonus',
      amount_cents: bot.milestoneBonus_cents,
      status: 'completed',
    });

    console.log('[ChatForeigners] Milestone bonus recorded:', {
      referrerId: referrerProfile.user_id,
      botId,
      amount: bot.milestoneBonus_cents / 100,
    });

    return {
      success: true,
      data: { earningId: earning._id.toString() },
    };
  } catch (error) {
    console.error('[ChatForeigners] Milestone bonus error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
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
  unlockPrice?: number;
}) {
  try {
    await connectToDatabase();

    const bot = await ChatForeignersBot.create({
      name: data.name,
      username: data.username,
      avatar_url: data.avatar,
      bio: data.bio,
      description: data.bio,
      personalityType: data.personalityType,
      speakingStyle: data.speakingStyle,
      mood: data.mood,
      interests: data.interests,
      unlockCost_cents: (data.unlockPrice || 60) * 100,
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
  } catch (error) {
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
