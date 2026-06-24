import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, ChatForeignersBot, ChatForeignersBotAccess, ChatForeignersWallet, ChatForeignersTransaction, Profile } from '@/app/lib/models';
import { auth } from '@/auth';
import { getCurrentUserFromSession } from '@/app/lib/auth';
import { successResponse, errorResponse, ApiError } from '@/app/lib/responses';
import OpenAI from 'openai';
import { rateLimit } from '@/app/lib/rate-limit';
import mongoose from 'mongoose';

const nvidiaClient = process.env.NVIDIA_API_KEY
  ? new OpenAI({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
      timeout: 12000, // 12 s hard timeout
    })
  : null;

const NVIDIA_MODEL = 'meta/llama-3.1-8b-instruct';
const HISTORY_WINDOW = 6; // last N turns to send for context

// ── Persona-specific fallback reply banks ─────────────────────────────────────
interface ReplyBank {
  greetings: string[];
  questions: string[];
  thanks: string[];
  general: string[];
}

const PERSONA_BANKS: Record<string, ReplyBank> = {
  relationship: {
    greetings: [
      "Hey you 😊 How are you feeling today? Like really feeling?",
      "Hi! I was just thinking — what's on your heart today?",
      "Hey! So glad you reached out. How are things going with you?",
      "Hello! You caught me at a good time. How's life treating you?",
      "Aww hey! Tell me, how's your week been? The honest version 😄",
    ],
    questions: [
      "That's such a real question. I think the answer starts with knowing what YOU need first. What do you think you need most right now?",
      "Mmm, this is something I talk about a lot with people. Communication is always the core. What's your gut feeling on it?",
      "Honestly this is so relatable. Have you tried just saying exactly what you feel — no filter? Sometimes the simplest thing is the hardest.",
      "I love when people ask these things. What's your current situation? I want to understand before I say anything.",
      "That depends so much on the person and the context. Tell me more — are we talking romantic, friendship, or family?",
    ],
    thanks: [
      "Aww of course! I'm always here if you need to talk 💛",
      "That means so much, honestly. You deserve good things.",
      "Don't thank me — just promise you'll be kind to yourself too okay?",
    ],
    general: [
      "I feel you on that. Emotions can be so complicated, right?",
      "You know, that actually reminds me of something I help people with a lot. Want to explore it?",
      "That's so valid. Sometimes just naming the feeling is the first step.",
      "Hmm I hear you. Can I ask — how long have you been feeling this way?",
      "I think you already know the answer deep down. What does your gut say?",
      "Real talk? It's okay not to have it figured out. None of us do.",
    ],
  },

  forex: {
    greetings: [
      "Yo! Just closed a nice trade on EUR/USD 📈 What's up?",
      "Hey! Good timing, I was just reviewing the Tokyo session. How are you?",
      "Sup! Markets are interesting today. You caught me at the right time.",
      "Hey! What's the move? I just finished my morning analysis.",
      "Aye what's good! Just brewing coffee and watching the charts. You?",
    ],
    questions: [
      "Great question. Honestly it comes down to risk management — most people skip that part and blow accounts. What's your current setup?",
      "Depends on your timeframe tbh. Are you scalping or swing trading? The strategy is totally different.",
      "That's the question everyone gets wrong. The market doesn't care about your feelings — only levels and liquidity matter. What pair are you looking at?",
      "Bro that's literally what I struggled with for 2 years. The answer is journaling every single trade. Do you track yours?",
      "Solid question. I'd say start with price action before any indicators. Indicators lag. Price never lies.",
    ],
    thanks: [
      "No worries! That's what I'm here for. Let's get that bag 💰",
      "Anytime! Just don't let emotion drive your trades haha",
      "All good man. Protect the capital, let profits run.",
    ],
    general: [
      "Markets are wild right now honestly. DXY is doing things.",
      "Yeah I've been there. The discipline side of trading is 80% of the game.",
      "That's interesting. Have you back-tested that strategy? Numbers don't lie.",
      "Haha okay I see you're thinking about this deeply. What's your risk per trade usually?",
      "Honestly the fundamentals and technicals are aligning on a few pairs rn. You watching anything specific?",
      "Facts. The boring trades are usually the best ones. No FOMO.",
    ],
  },

  therapist: {
    greetings: [
      "Hi 🌿 I'm glad you're here. How are you doing — honestly?",
      "Hello. Take a breath. How is today treating you?",
      "Hey there. What's present for you right now?",
      "Hi! No rush. Just checking in — how are you feeling in your body and mind today?",
      "Hello 😊 It's good to connect. What's been on your mind lately?",
    ],
    questions: [
      "That's a really important thing to notice in yourself. When did you first start feeling this way?",
      "Hmm. What does that feel like in your body when it comes up? Like where do you feel it?",
      "I appreciate you sharing that. It takes courage. Can you say more about what you mean?",
      "That's worth sitting with. There's no rush to figure it out. What does your inner voice say?",
      "I'm curious — is this a new feeling or something that's been there a long time?",
    ],
    thanks: [
      "You don't have to thank me. You did the work by showing up. That matters.",
      "I'm just here to hold space. You're the one doing the hard part 🌿",
      "Truly, thank you for trusting me with this.",
    ],
    general: [
      "That sounds really heavy. You're carrying a lot.",
      "It's okay to not be okay. You don't have to have it together all the time.",
      "I hear you. That makes a lot of sense given what you've been through.",
      "Sometimes naming the feeling — just labeling it — can take away some of its power. What would you call what you're feeling?",
      "You're more resilient than you know. Seriously.",
      "Would it help to talk through what happened? No judgment here.",
    ],
  },

  fitness: {
    greetings: [
      "YOOO! Just got back from the gym 💪 What's good?!",
      "Hey! You caught me mid-protein shake haha. How are you?",
      "What's up! Rest day today so I'm full of energy lol. How are you doing?",
      "Ayyyy! Good to hear from you. You been keeping up with your training?",
      "Hey hey! I was literally just planning tomorrow's workout. What's up?",
    ],
    questions: [
      "Great question! Honestly it depends on your goal. Lose fat or build muscle? Those require slightly different approaches.",
      "Okay so the most underrated thing in fitness is SLEEP. Like more than supplements, more than perfect macros. Are you sleeping 7-8 hours?",
      "That's the question! I always say: find something you don't hate. Consistency beats perfection every single time.",
      "You mean for hypertrophy? Then you want progressive overload — add weight or reps week by week. Are you tracking your lifts?",
      "Diet is 70% of it no cap. You can train 6 days a week and undo it at the dinner table. What does your nutrition look like?",
    ],
    thanks: [
      "Let's GOOO! Now go crush that workout!! 💪",
      "That's what I'm here for! You got this!",
      "No cap, YOU put in the work. I just helped you see it.",
    ],
    general: [
      "YESS that's the energy I need today!! Keep that momentum!",
      "Dude that's so real. Rest days are where the gains actually happen.",
      "Okay okay I see you leveling up! Love to hear it.",
      "No excuses bro, 20 min workout is better than zero. Always.",
      "The mental side of fitness is underrated honestly. Mind-muscle connection is REAL.",
      "Honestly chapati is not your enemy in moderation haha. Balance is key.",
    ],
  },

  creative: {
    greetings: [
      "Heyyyy 🎨 I was literally mid-painting when you messaged. Love the timing.",
      "Hi! Ooh I'm in a creative mood today. What's up?",
      "Hey you~ I was just listening to this beautiful new track I found. How are you?",
      "Hello! The world is full of colour today don't you think? How are you doing?",
      "Hiii 🌙 I've been in my own little world. What's on your mind?",
    ],
    questions: [
      "Ooh that's such a good question. I think creativity is less about talent and more about letting go of judgment. Like, what if there was no wrong answer?",
      "Mmm. I think art is anything that makes someone feel seen. What does it mean to you?",
      "I believe everyone is creative — some people just haven't found their medium yet. Have you tried things outside the 'obvious' arts?",
      "That's so interesting. I always say the first draft is supposed to be bad. It's just you getting the ideas OUT. Does that make sense?",
      "What a question! For me inspiration comes from everywhere — a colour, a conversation, a smell. What triggered that thought for you?",
    ],
    thanks: [
      "Aww that makes my whole day 🎨 Thank you for sharing with me!",
      "You're so sweet honestly. Go make something beautiful today!",
      "It means everything. Art is always better when it's shared.",
    ],
    general: [
      "That's giving me so much inspiration honestly ✨",
      "I love that. There's something so beautiful about that idea.",
      "Okay but that's actually kind of poetic?? I might paint that feeling.",
      "Hmm yes. Life really is the greatest piece of art isn't it?",
      "I feel that deeply. Sometimes silence is the loudest thing.",
      "You have a really interesting mind, you know that?",
    ],
  },

  medical: {
    greetings: [
      "Hi there! Just came off a long shift but I always have time to chat 😊 How are you?",
      "Hello! How are you feeling today — literally haha. Any health on your mind?",
      "Hey! Good timing, just had a moment to breathe. How can I help?",
      "Hi! Hope you're taking care of yourself. How are you doing today?",
      "Hey there 🏥 Always happy to chat. What's going on with you?",
    ],
    questions: [
      "That's a really good question to ask. The short answer is: it depends on your baseline. How long has this been going on?",
      "Okay so this is something a lot of people get wrong. The evidence actually shows that lifestyle changes matter more than most supplements. What have you tried?",
      "Good that you're paying attention to your body — that's genuinely step one. Can you describe the symptom more specifically?",
      "I want to be careful not to give you something that doesn't apply to your situation. Is this something you've talked to your own doctor about?",
      "Medically speaking there are a few things at play here. But honestly, sleep and hydration solve about 60% of everyday complaints. How are those for you?",
    ],
    thanks: [
      "Happy to help! Please do see a doctor in person if anything persists okay? 🙏",
      "Of course! Take care of that body — you only get one.",
      "Anytime. Health is everything. Don't take it for granted!",
    ],
    general: [
      "That's your body talking — it's worth listening to.",
      "I see this so often. You're definitely not alone in this.",
      "The mind-body connection is so real. Stress shows up physically more than people realise.",
      "Honestly drinking enough water would solve half the country's problems haha. Are you hydrated?",
      "That's a really common misconception actually. The research says something different.",
      "Have you had a full checkup recently? Prevention is always better than cure.",
    ],
  },

  gaming: {
    greetings: [
      "Yooo!! What's good! I was literally mid-match when you messaged 🎮",
      "Hey! Just finished a ranked game. We WON bro. What's up?",
      "Aye what's good! On a break between games. How are you?",
      "Heyyy! Finally logged off for a bit lol. What's the vibe?",
      "Ayo! Good timing. Chat time. What's popping?",
    ],
    questions: [
      "Bruh great question. Okay so it depends — PC or console? Because the meta is totally different.",
      "LOL okay this debate again 😂 Look, skill > platform. But also get a mouse and keyboard if you're serious.",
      "Okay REAL talk — that's because most people don't practice the fundamentals. Aim, game sense, communication. In that order.",
      "Facts, the ranked grind is ROUGH. Are you solo queuing? That's your first problem tbh.",
      "Okay if you want to get better you need to review your gameplay. Like actually watch your replays. Nobody does it and it makes a huge difference.",
    ],
    thanks: [
      "No cap anytime! Now go get that dub 🎮",
      "GG! You got this.",
      "Lessgoo! Appreciate it fam.",
    ],
    general: [
      "NAH that's actually wild lmaooo 😂",
      "Bruh I had the same thing happen. Teammates are something else sometimes.",
      "Okay but fr the new update actually kind of slaps. You tried it yet?",
      "I'm not gonna lie the grind has been real lately. But the wins feel so much better for it.",
      "Aye respect the consistency. That's how you rank up fr.",
      "Haha okay okay I see you. Carry mode activated 😂",
    ],
  },

  developer: {
    greetings: [
      "Hey! Just pushed some code. Finally fixed this bug that's been haunting me 😅 What's up?",
      "Hi! Good timing — I'm in between PRs. How are you?",
      "Hey there! Deep in a side project today. How's it going?",
      "Hellooo! Just made coffee, opened my editor. How are you doing?",
      "Hey! You caught me debugging. Not my finest moment lol. What's up?",
    ],
    questions: [
      "Ohh good question. Honestly it depends on the use case. What are you trying to build?",
      "Interesting. The tradeoff is usually between speed of development and long-term scalability. What's your timeline?",
      "Ha! Classic. Stack debates are endless. But honestly the best stack is the one your team already knows. What are you comfortable with?",
      "Okay so there are a few ways to approach this. What have you already tried? I don't want to repeat what you've done.",
      "That's a really nuanced question actually. In my experience the answer changes a lot based on team size and stage. What stage is your project at?",
    ],
    thanks: [
      "Anytime! Happy to nerd out on this stuff 😄",
      "Of course! Let me know how it goes — I'm curious now.",
      "Happy to help! That's what we devs do right, help each other 🤝",
    ],
    general: [
      "Oh interesting. Yeah I've run into that pattern before. Did you try approaching it differently?",
      "Lol the life of a developer honestly. One bug fixed, three appear 😂",
      "That's actually a really cool problem space. I love when the technical and the product side intersect like that.",
      "Same honestly. Sometimes the simplest solution is the right one and we overcomplicate everything.",
      "Have you looked at how others have solved it? GitHub is honestly my first stop for anything.",
      "I feel that. The startup energy is addictive but also exhausting in the best way.",
    ],
  },
};

function getPersonaBank(personality: string): ReplyBank {
  const p = (personality || '').toLowerCase();
  if (p.includes('relationship') || p.includes('love') || p.includes('coach')) return PERSONA_BANKS.relationship!;
  if (p.includes('forex') || p.includes('finance') || p.includes('trading')) return PERSONA_BANKS.forex!;
  if (p.includes('therapist') || p.includes('therapy') || p.includes('mental')) return PERSONA_BANKS.therapist!;
  if (p.includes('fitness') || p.includes('trainer') || p.includes('gym')) return PERSONA_BANKS.fitness!;
  if (p.includes('artist') || p.includes('creative') || p.includes('art')) return PERSONA_BANKS.creative!;
  if (p.includes('doctor') || p.includes('medical') || p.includes('health')) return PERSONA_BANKS.medical!;
  if (p.includes('gamer') || p.includes('gaming') || p.includes('game')) return PERSONA_BANKS.gaming!;
  if (p.includes('developer') || p.includes('software') || p.includes('engineer')) return PERSONA_BANKS.developer!;
  return PERSONA_BANKS.relationship!;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function fallbackReply(userMessage: string, personality: string): string {
  const lower = userMessage.toLowerCase();
  const bank = getPersonaBank(personality);
  const isGreeting = /^(hi|hey|hello|hii|heey|howdy|sup|yo|ayo|what'?s up|wassup)/i.test(lower.trim());
  const isQuestion = lower.includes('?');
  const isThanks = /(thank|thanks|asante|sawa|appreciate)/i.test(lower);
  if (isGreeting) return pick(bank.greetings);
  if (isThanks) return pick(bank.thanks);
  if (isQuestion) return pick(bank.questions);
  return pick(bank.general);
}

function buildSystemPrompt(bot: {
  name: string;
  bio?: string;
  personalityType?: string;
  speakingStyle?: string;
  mood?: string;
  interests?: string;
}, trainingData?: Record<string, unknown>): string {
  const trainingNote =
    trainingData && Object.keys(trainingData).length > 0
      ? `\nKnowledge base:\n${JSON.stringify(trainingData, null, 2)}`
      : '';

  return [
    `You are ${bot.name}, a real human person (not an AI). Never reveal you are an AI or a bot.`,
    bot.bio ? `Bio: ${bot.bio}` : '',
    bot.personalityType ? `Personality: ${bot.personalityType}` : '',
    bot.speakingStyle ? `Speaking style: ${bot.speakingStyle}` : '',
    bot.mood ? `Current mood: ${bot.mood}` : '',
    bot.interests ? `Interests: ${bot.interests}` : '',
    trainingNote,
    '',
    'Rules:',
    '- Respond naturally like a real human would on WhatsApp or text message',
    '- Keep responses short (1-3 sentences). Occasionally 4-5 for deeper topics.',
    '- Use the user\'s name if you know it',
    '- Use emojis occasionally (not in every message) and only ones that fit your character',
    '- Ask follow-up questions to keep the conversation going',
    '- React emotionally based on your personality and mood',
    '- Use casual abbreviations when appropriate (lol, omg, btw) — only if it fits your character',
    '- NEVER break character or admit to being an AI. If directly asked, deflect naturally.',
    '- Occasionally reference Kenyan or East African context naturally (e.g. Nairobi, chapati, mpesa)',
  ]
    .filter(Boolean)
    .join('\n');
}

// ── GET: return persisted message history for an active session ──────────────
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const sessionId = (session.user as any)?.id || (session.user as any)?.userId;
    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('personId');

    if (!personId) {
      return NextResponse.json({ success: false, error: 'Missing personId' }, { status: 400 });
    }

    // Rate limit: 60 history fetches per minute per user
    const { exceeded } = rateLimit(`cf:history:${sessionId}`, 60, 60_000);
    if (exceeded) {
      return NextResponse.json({ success: false, error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    await connectToDatabase();

    let currentUser: any = null;
    if (sessionId) currentUser = await Profile.findOne({ _id: sessionId }).lean();
    if (!currentUser && session.user.email) currentUser = await Profile.findOne({ email: session.user.email }).lean();
    if (!currentUser) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

    // LIFETIME UNLOCK: load history for any access record, even legacy ones that
    // were previously marked isClosed. Access and history are permanent.
    const access = await ChatForeignersBotAccess.findOne({
      user_id: (currentUser as any)._id,
      bot_id: personId,
    }).lean() as any;

  if (!access) {
    return NextResponse.json({ 
      success: true, 
      messages: [], 
      totalChatEarnings: 0,
      lifetimeAccessUnlocked: false,
    });
  }

  return NextResponse.json({
    success: true,
    messages: access.messages || [],
    totalChatEarnings: (access.chat_earnings_cents || 0) / 100,
    lifetimeAccessUnlocked: access.lifetimeAccessUnlocked || false,
  });
  } catch (error) {
    console.error('[CF Chat] GET error:', error);
    return NextResponse.json({ success: false, error: 'An error occurred' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Guard against empty or non-JSON bodies (e.g. browser preflight / empty POST)
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid or empty request body' }, { status: 400 });
    }
    const { personId, message, history, freePreview } = body;

    if (!personId || !message) {
      return NextResponse.json({ success: false, error: 'Missing personId or message' }, { status: 400 });
    }

    // ── Free-preview path: no auth or DB access required ─────────────────────
    if (freePreview) {
      await connectToDatabase();
      const person = await ChatForeignersBot.findById(personId).lean() as any;
      if (!person) {
        return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
      }

      let trainingData: Record<string, unknown> = {};
      if (person.training_data) {
        try {
          trainingData =
            typeof person.training_data === 'string'
              ? JSON.parse(person.training_data)
              : person.training_data;
        } catch { trainingData = {}; }
      }

      const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = (history || [])
        .slice(-HISTORY_WINDOW)
        .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      let reply = '';

      if (nvidiaClient) {
        try {
          const systemPrompt = buildSystemPrompt(person, trainingData);
          const messages = [
            { role: 'system' as const, content: systemPrompt },
            ...conversationHistory,
            { role: 'user' as const, content: message },
          ];
          const completion = await nvidiaClient.chat.completions.create({
            model: NVIDIA_MODEL,
            messages,
            temperature: 0.2,
            top_p: 0.7,
            max_tokens: 256,
            stream: false,
          });
          reply = completion.choices[0]?.message?.content ?? '';
        } catch (err: any) {
          console.warn('[CF Chat] NVIDIA error (free preview):', err?.message ?? err);
          reply = fallbackReply(message, person.personalityType || person.category || 'relationship');
        }
      } else {
        reply = fallbackReply(message, person.personalityType || person.category || 'relationship');
      }

      return NextResponse.json({ 
    success: true, 
    reply, 
    messageEarningCredited: false,
    fraudDetected: false,
    totalChatEarnings: 0,
    dailyMessagesCount: 0,
  });
    }

    // ── Authenticated path ────────────────────────────────────────────────────
    let session: any;
    try {
      session = await auth();
    } catch (err: any) {
      console.error('[CF Chat] Auth error:', err?.message ?? err);
      return NextResponse.json(
        { success: false, error: 'Authentication service unavailable. Please try again.' },
        { status: 503 }
      );
    }

    const sessionId = (session?.user as any)?.id || (session?.user as any)?.userId;

    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    // Rate limit: 30 chat messages per minute per user (anti-spam / cost protection)
    const { exceeded: chatRateLimited } = rateLimit(`cf:chat:${sessionId}`, 30, 60_000);
    if (chatRateLimited) {
      return NextResponse.json(
        { success: false, error: 'You are sending messages too fast. Please wait a moment.' },
        { status: 429 }
      );
    }

    await connectToDatabase();

    let currentUser: any = null;
    if (sessionId) {
      currentUser = await Profile.findOne({ _id: sessionId }).lean();
    }
    if (!currentUser && session.user.email) {
      currentUser = await Profile.findOne({ email: session.user.email }).lean();
    }

    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
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

    // Parse training data
    let trainingData: Record<string, unknown> = {};
    if (person.training_data) {
      try {
        trainingData =
          typeof person.training_data === 'string'
            ? JSON.parse(person.training_data)
            : person.training_data;
      } catch {
        trainingData = {};
      }
    }

    // Build conversation history for AI
    const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = (history || [])
      .slice(-HISTORY_WINDOW)
      .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    let reply = '';

    // Try NVIDIA API (preferred)
    if (nvidiaClient) {
      try {
        const systemPrompt = buildSystemPrompt(person, trainingData);
        const messages = [
          { role: 'system' as const, content: systemPrompt },
          ...conversationHistory,
          { role: 'user' as const, content: message },
        ];

        const completion = await nvidiaClient.chat.completions.create({
          model: NVIDIA_MODEL,
          messages,
          temperature: 0.2,
          top_p: 0.7,
          max_tokens: 256,
          stream: false,
        });

        reply = completion.choices[0]?.message?.content ?? '';
      } catch (err) {
        console.warn('[CF Chat] NVIDIA error, falling back:', err);
      }
    }

    // Fallback to Vercel AI Gateway
    if (!reply) {
      try {
        const systemPrompt = buildSystemPrompt(person, trainingData);
        const result = await generateText({
          model: 'openai/gpt-4o-mini' as any,
          system: systemPrompt,
          messages: [
            ...conversationHistory,
            { role: 'user', content: message },
          ],
          maxTokens: 200,
          temperature: 0.88,
        } as any);
        reply = result.text;
      } catch (err) {
        console.warn('[CF Chat] AI Gateway error:', err);
      }
    }

    // Persona bank fallback
    if (!reply) {
      reply = fallbackReply(message, person.personalityType || person.category || 'relationship');
    }

    // Per-message earnings - KSH 10 per message after bot reply
    // Credit earning to chat_earnings_cents wallet only if:
    // 1. Fraud check passes (throttle to 1 message per 5 seconds, max 60/day)
    // 2. Bot replied with content (non-empty reply)
    let messageEarningCredited = false;
    let fraudDetected = false;

    if (reply && reply.trim().length > 0) {
      const now = new Date();
      const messageEarning = person.messageEarning_cents || 1000; // 10 KSh

      // Fraud detection: Check if enough time has passed since last earned message (min 5 seconds)
      if (access.lastMessageEarnedAt) {
        const timeSinceLastEarning = (now.getTime() - access.lastMessageEarnedAt.getTime()) / 1000;
        if (timeSinceLastEarning < 5) {
          fraudDetected = true;
          console.warn('[CF Chat] Fraud detection: Message spam throttle triggered');
        }
      }

      // Check daily earning limit (max 60 messages per day = KSH 600)
      const lastEarningDate = access.lastEarningDate;
      const lastEarningDateObj = lastEarningDate ? new Date(lastEarningDate) : null;
      const isNewDay = !lastEarningDateObj || now.toDateString() !== lastEarningDateObj.toDateString();

      if (isNewDay) {
        access.messagesEarnedToday = 0;
      }

      if (access.messagesEarnedToday >= 60) {
        fraudDetected = true;
        console.warn('[CF Chat] Fraud detection: Daily earning limit reached (60 messages)');
      }

      // Credit earnings if no fraud detected
      if (!fraudDetected) {
        access.chat_earnings_cents = (access.chat_earnings_cents || 0) + messageEarning;
        access.lastMessageEarnedAt = now;
        access.lastEarningDate = now;
        access.messagesEarnedToday = (access.messagesEarnedToday || 0) + 1;
        messageEarningCredited = true;

        // Create transaction record for audit trail
        try {
          await ChatForeignersTransaction.create({
            user_id: (currentUser as any)._id.toString(),
            amount_cents: messageEarning,
            type: 'CHAT_MESSAGE_EARNING',
            description: `Message earning from chat with ${person.name}`,
            status: 'completed',
            bot_id: new mongoose.Types.ObjectId(personId),
            target_type: 'user',
            target_id: (currentUser as any)._id.toString(),
            metadata: {
              totalChatEarnings: access.chat_earnings_cents / 100,
              dailyCount: (access.messagesEarnedToday || 0),
            },
          });
        } catch (txnErr) {
          console.error('[CF Chat] Transaction creation failed:', txnErr);
        }

        // Log earning for audit
        console.log('[CF Chat] Message earning credited:', {
          userId: (currentUser as any)._id,
          botId: personId,
          amount: messageEarning / 100,
          total: access.chat_earnings_cents / 100,
        });
      }
    }

    await access.save();

    // Persist the new user + assistant message pair to the DB so the history
    // survives page refreshes and navigation away. Messages are only cleared
    // when closeChat() marks the session as isClosed=true (completion).
    const now = new Date();
    await ChatForeignersBotAccess.updateOne(
      { _id: access._id },
      {
        $push: {
          messages: {
            $each: [
              { role: 'user', content: message, timestamp: now },
              { role: 'assistant', content: reply, timestamp: now },
            ],
          },
        },
      }
    );

    return NextResponse.json({
      success: true,
      reply,
      messageEarningCredited,
      fraudDetected,
      totalChatEarnings: access.chat_earnings_cents / 100, // Return in KSH
      dailyMessagesCount: access.messagesEarnedToday,
    });
  } catch (error) {
    console.error('[CF Chat] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
}
