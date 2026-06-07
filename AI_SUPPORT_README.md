# NVIDIA AI Support Assistant Implementation

Complete NVIDIA-powered AI support system integrated into HustleHub's live chat widget.

## ✨ Features Implemented

### Core AI Capabilities
- **RAG System** - Retrieval-Augmented Generation using NVIDIA embeddings and LLMs
- **Knowledge Base** - Auto-seeded with 16+ FAQs covering all platform features
- **Smart Escalation** - Automatic routing to human support for complex issues
- **Security-First** - Prompt injection protection, data sanitization, audit logging

### User-Facing
- **AI Toggle** - Switch between AI assistant and human support in chat widget
- **Context-Aware** - AI knows which user is chatting and can access their info (with auth)
- **Real-time Responses** - Instant answers using NVIDIA Llama/Nemotron models
- **Visual Feedback** - Loading states, escalation notices, auth prompts

### Backend Infrastructure
- **Rate Limiting** - 30 requests/min per user to prevent abuse
- **Audit Logging** - Every interaction logged for compliance (AI interactions, security events, data access)
- **Safe API Layer** - Limited, sanitized access to user data; never exposes database directly
- **Error Handling** - Graceful degradation, automatic escalation on errors

## 🏗️ Architecture

```
User Chat Widget
       ↓
[AI Toggle: Human/AI]
       ↓
    ↙  ↘
  Human  AI Support
 Support ↓
       RAG Pipeline
       ├─ Retrieval (Search Knowledge Base)
       ├─ Context Building (User info if auth'd)
       ├─ Prompt Creation (Safe, injection-protected)
       ├─ LLM Generation (NVIDIA Llama 2 70B)
       └─ Safety Checks (Escalate if needed)
       ↓
   Response + Metadata
   ├─ Message
   ├─ Escalation flag (if needed)
   ├─ Ticket ID (if escalated)
   └─ Auth requirement (if needed)
       ↓
    Audit Log
```

## 📁 File Structure

```
app/
├── lib/
│   └── services/
│       ├── nvidia-ai.ts              # NVIDIA API wrapper + system prompt
│       ├── knowledge-base.ts          # KB documents + seeding
│       ├── support-api.ts             # Safe API layer (sanitized data)
│       ├── ai-orchestrator.ts         # RAG pipeline orchestration
│       └── audit-logger.ts            # Compliance logging
├── api/support/
│   ├── ai-chat/route.ts               # POST /api/support/ai-chat
│   └── kb-init/route.ts               # POST /api/support/kb-init (admin)
├── hooks/
│   └── useAISupportAssistant.ts        # React hook for AI chat
├── types/
│   └── ai-support.ts                  # TypeScript interfaces
└── components/chat/
    └── UserChatWidget.tsx             # Updated with AI toggle + UI
```

## 🚀 Quick Start

### 1. Set Environment Variables

Add to `.env.local`:
```env
NVIDIA_API_KEY=your_nvidia_api_key_here
```

Get your API key from https://build.nvidia.com/

### 2. Initialize Knowledge Base

The knowledge base seeds automatically on first request, but you can manually initialize it:

```bash
curl -X POST http://localhost:3000/api/support/kb-init \
  -H "Content-Type: application/json"
```

### 3. Test the AI Chat

```bash
curl -X POST http://localhost:3000/api/support/ai-chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I withdraw my money?",
    "conversationId": "conv_123"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Minimum withdrawal is KES 500...",
  "metadata": {
    "escalated": false,
    "source": "kb",
    "requires_auth": false
  }
}
```

## 💬 Usage in Chat Widget

Users will see:
1. **Chat Widget** (bottom-right corner)
2. **AI Toggle** (robot icon in header) - Click to switch to AI Assistant
3. **AI Responses** - Purple theme, instant answers
4. **Escalation Notice** - If issue is complex, shows ticket ID

### Example Interactions

**Public Question:**
```
User: "What is referrals?"
AI: "Referrals allow you to earn commissions... [from knowledge base]"
```

**User-Specific Question (Not Logged In):**
```
User: "What's my balance?"
AI: "Please log in to access account-specific information."
```

**User-Specific Question (Logged In):**
```
User: "What's my referral earnings?"
AI: "Your referral earnings are KES 5,430. You have 12 active referrals..."
```

**Escalation Trigger:**
```
User: "I think my account was hacked"
AI: "Your issue has been escalated. A support specialist will contact you.
     Ticket #TKT-1686212850435"
```

## 🔒 Security

### Authentication & Authorization
- ✅ Prompt injection protection (filters suspicious patterns)
- ✅ Data sanitization (removes passwords, tokens, etc. before sending to AI)
- ✅ Least privilege (AI only accesses approved data)
- ✅ Rate limiting (30 requests/min prevents abuse)
- ✅ Session-based auth (only show user data to that user)

### Audit & Compliance
- ✅ Every AI interaction logged with timestamp, user, message
- ✅ Security events logged separately (injection attempts, unauthorized access)
- ✅ Data access audit trail (tracks who accessed what)
- ✅ Escalations tracked with reason and ticket ID

Query audit logs:
```typescript
import { AuditLogger } from '@/app/lib/services/audit-logger';

// Get user's interaction history
const userLogs = await AuditLogger.getAuditLogsForUser(userId);

// Get security events
const securityEvents = await AuditLogger.getSecurityEvents();
```

## 🎯 What the AI Can Do

**✅ Answer**
- How to register
- How referrals work
- How to withdraw
- Chat Foreigners explanation
- Account settings
- Terms & conditions
- FAQs

**✅ Access (Authenticated Only)**
- User's account balance
- Referral earnings
- Withdrawal history
- Verification status

**✅ Escalate**
- Fraud reports → "Escalated to fraud team"
- Account suspension → "Escalated to account recovery"
- Payment disputes → "Escalated to payments team"
- Legal issues → "Escalated to legal team"
- Threats → "Escalated immediately"

**❌ Cannot Do**
- Access other users' data
- Reveal API keys or credentials
- Bypass authentication
- Delete accounts
- Modify transactions

## 📊 Monitoring

### Track Metrics
```typescript
// Get all AI interactions
const logs = await AuditLog.find({ event_type: 'ai_interaction' });

// Analyze by category
const faqLogs = logs.filter(l => l.data.kb_used);
const escalations = logs.filter(l => l.data.escalated);
```

### Key Metrics
- **AI Usage** - How many users chatted with AI vs human support
- **Escalation Rate** - How often AI escalated to human
- **Most Asked Questions** - What users ask most
- **Response Quality** - Does AI give useful answers?
- **Security Events** - Any injection attempts or abuse?

## 🔧 Customization

### Add New Knowledge Base Documents

In `knowledge-base.ts`:
```typescript
{
  id: 'custom_001',
  category: 'custom',
  title: 'Your Title',
  content: 'Your content here...',
},
```

Then reseed: POST `/api/support/kb-init`

### Customize System Prompt

In `nvidia-ai.ts`:
```typescript
export const SUPPORT_SYSTEM_PROMPT = `
You are...customize here...
`
```

### Add Escalation Keywords

In `ai-orchestrator.ts`:
```typescript
const escalationKeywords = [
  'fraud',
  'hacked',
  // Add more...
];
```

## ⚠️ Limitations & Future Work

**Current Limitations**
- Escalations are logged but not auto-routed to human teams (manual intervention)
- Knowledge base doesn't auto-update (manual seeding required)
- No sentiment analysis (can't detect frustrated users)
- English-only (no multi-language support yet)

**Future Enhancements**
- [ ] Auto-route escalations to support team via email/Slack
- [ ] Sentiment analysis to detect frustrated users
- [ ] Multi-language support
- [ ] Voice chat support
- [ ] Model fine-tuning on HustleHub data
- [ ] A/B testing different models
- [ ] User feedback on AI responses
- [ ] Integration with external knowledge bases

## 🐛 Troubleshooting

**Issue: "NVIDIA_API_KEY is not set"**
- Ensure env var is added to `.env.local`
- Restart dev server: `npm run dev`

**Issue: AI gives generic responses**
- Knowledge base not seeded: POST `/api/support/kb-init`
- Check `is_active: true` on KB documents

**Issue: Rate limit exceeded**
- User hit 30 requests/min limit
- Wait 60 seconds and retry
- Check for bot abuse

**Issue: Escalation not working**
- Verify user is authenticated
- Check escalation keywords match user's message
- Review audit logs for errors

## 📚 Documentation Files

- **NVIDIA_AI_SETUP.md** - Detailed setup guide
- **This README** - Overview and usage
- **Code comments** - Inline documentation in services

## 🤝 Support

For issues or questions:
1. Check NVIDIA_AI_SETUP.md
2. Review audit logs: `AuditLogger.getAuditLogsForUser()`
3. Check console output for error messages
4. Verify NVIDIA API key is valid at https://build.nvidia.com/

## 📝 License

Same as HustleHub main project.
