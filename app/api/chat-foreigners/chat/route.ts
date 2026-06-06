import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, ChatForeignersBot, ChatForeignersBotAccess, Profile } from '@/app/lib/models';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const sessionId = (session?.user as any)?.id || (session?.user as any)?.userId;

    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    await connectToDatabase();

    // Get user
    let currentUser = null;
    if (sessionId) {
      currentUser = await Profile.findOne({ _id: sessionId }).lean();
    }
    if (!currentUser && session.user.email) {
      currentUser = await Profile.findOne({ email: session.user.email }).lean();
    }

    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const { personId, message, history } = await request.json();

    if (!personId || !message) {
      return NextResponse.json({ success: false, error: 'Missing personId or message' }, { status: 400 });
    }

    // Verify access
    const access = await ChatForeignersBotAccess.findOne({
      user_id: (currentUser as any)._id,
      bot_id: personId,
    });

    if (!access) {
      return NextResponse.json({ success: false, error: 'No access to this person' }, { status: 403 });
    }

    // Get person details
    const person = await ChatForeignersBot.findById(personId);
    if (!person) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }

    // Build system prompt from person personality
    const systemPrompt = [
      `You are ${person.name}, a real person available to chat.`,
      person.bio ? `About you: ${person.bio}` : '',
      person.personalityType ? `Your personality: ${person.personalityType}` : '',
      person.speakingStyle ? `Your speaking style: ${person.speakingStyle}` : '',
      person.mood ? `Your current mood: ${person.mood}` : '',
      person.interests ? `Your interests: ${person.interests}` : '',
      `Stay in character as ${person.name}. Be conversational, engaging, and authentic.`,
      `Do NOT mention that you are an AI or a bot. You are a real person named ${person.name}.`,
    ]
      .filter(Boolean)
      .join(' ');

    // Build message history for the AI
    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-10), // Last 10 messages for context
      { role: 'user', content: message },
    ];

    // Call AI
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: aiMessages,
        max_tokens: 500,
        temperature: 0.85,
      }),
    });

    let reply = '';
    if (aiRes.ok) {
      const aiData = await aiRes.json();
      reply = aiData.choices?.[0]?.message?.content || '';
    }

    // Fallback if no AI key or error
    if (!reply) {
      const fallbacks = [
        `That's really interesting! Tell me more.`,
        `I love that topic! As someone passionate about ${person.interests?.split(',')[0] || 'life'}, I can relate.`,
        `Ha! That made me smile. What else is on your mind?`,
        `Hmm, let me think about that... What do you think?`,
        `Great question! From my experience, I would say it depends a lot on perspective.`,
      ];
      reply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    // Update message count
    access.messageCount = (access.messageCount || 0) + 1;

    // Check milestone
    const milestone = person.messageLimitForMilestone || 20;
    let milestoneReached = false;
    if (!access.firstMilestoneComplete && access.messageCount >= milestone) {
      access.firstMilestoneComplete = true;
      access.milestoneCompletedAt = new Date();
      milestoneReached = true;
    }

    await access.save();

    return NextResponse.json({
      success: true,
      reply,
      messageCount: access.messageCount,
      milestoneReached,
    });
  } catch (error) {
    console.error('[CF Chat] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}
