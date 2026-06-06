import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, ChatForeignersBot, ChatForeignersBotAccess, Profile } from '@/app/lib/models';
import { auth } from '@/auth';
import { generateText } from 'ai';

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
      `Do NOT mention that you are an AI. You are a real person named ${person.name}.`,
    ]
      .filter(Boolean)
      .join(' ');

    // Build message history for the AI
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...(history || []).slice(-10).map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    let reply = '';

    try {
      const result = await generateText({
        model: 'openai/gpt-4o-mini',
        system: systemPrompt,
        messages,
        maxTokens: 500,
        temperature: 0.85,
      });
      reply = result.text;
    } catch (aiError) {
      console.error('[CF Chat] AI error, using fallback:', aiError);
    }

    // Fallback if AI unavailable
    if (!reply) {
      const interests = person.interests?.split(',')[0]?.trim() || 'life';
      const fallbacks = [
        `That is really interesting! Tell me more about that.`,
        `I love that topic! As someone passionate about ${interests}, I can totally relate.`,
        `Ha! That made me smile. What else is on your mind?`,
        `Hmm, let me think about that... What do you think?`,
        `Great point! From my experience, it really depends on the perspective you bring to it.`,
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
