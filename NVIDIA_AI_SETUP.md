# NVIDIA AI Support Assistant - Setup Guide

## Overview

This implementation adds NVIDIA-powered AI support to HustleHub's live chat system. The AI assistant can answer questions about the platform, help with account issues, and escalate complex problems to human support.

## Environment Variables Required

Add these to your `.env.local` or project environment:

```env
# NVIDIA API Configuration
NVIDIA_API_KEY=your_nvidia_api_key_here
NVIDIA_LLM_ENDPOINT=https://integrate.api.nvidia.com/v1
NVIDIA_EMBED_ENDPOINT=https://integrate.api.nvidia.com/v1

# Optional: Override model choices
NVIDIA_LLM_MODEL=meta/llama-2-70b-chat
NVIDIA_EMBED_MODEL=nvidia/nv-embed-v1
```

## Getting NVIDIA API Key

1. Visit [NVIDIA AI Foundation Models](https://build.nvidia.com/)
2. Sign up or log in
3. Create a new API key in the API Keys section
4. Use the key in your environment variables

## Implementation Architecture

### Core Components

1. **NVIDIA AI Service** (`app/lib/services/nvidia-ai.ts`)
   - Handles LLM requests and embeddings
   - Contains system prompt and prompt injection protection

2. **Knowledge Base** (`app/lib/services/knowledge-base.ts`)
   - Stores FAQ, guides, and policy information
   - Auto-seeded with default content on first run
   - Searchable by category and keywords

3. **Support API Layer** (`app/lib/services/support-api.ts`)
   - Provides secure, limited data access to the AI
   - Returns only approved user information
   - Implements principle of least privilege

4. **AI Orchestrator** (`app/lib/services/ai-orchestrator.ts`)
   - RAG pipeline: retrieves relevant docs, builds context, generates response
   - Handles authentication checks
   - Manages escalations to human support
   - Protects against prompt injection

5. **Audit Logger** (`app/lib/services/audit-logger.ts`)
   - Logs all AI interactions for compliance
   - Tracks security events
   - Records data access for audit trails

### API Endpoints

- **POST `/api/support/ai-chat`** - Send message to AI
  - Rate limited to 30 requests/min per user
  - Returns AI response with metadata
  - Handles escalations

- **POST `/api/support/kb-init`** - Initialize knowledge base (admin only)
  - Seeds default knowledge base documents
  - Should be run once after deployment

## Features

### AI Capabilities

✅ **Public Knowledge**
- FAQ answers
- Platform features explanation
- Registration guidance
- Referral program details
- Withdrawal process
- Terms and policies

✅ **User-Specific Information** (authenticated users only)
- Check account balance
- Referral earnings
- Withdrawal status
- Verification status

✅ **Security**
- Prompt injection protection
- Automatic escalation for sensitive issues (fraud, suspension, etc.)
- Audit logging of all interactions
- Data sanitization

### Escalation Types

Issues automatically escalated to human support:
- Fraud reports
- Account suspensions
- Payment disputes
- Legal issues
- Threats or harassment
- Technical errors

## Integration with Chat Widget

The `UserChatWidget` now has:

1. **AI Toggle Button** - Switch between AI assistant and human support
2. **AI-Specific UI** - Purple theme for AI vs. blue for human support
3. **Escalation Notices** - Shows when issue is escalated with ticket ID
4. **Context-Aware** - AI knows to ask for auth when needed

### Component Usage

```tsx
import UserChatWidget from '@/app/components/chat/UserChatWidget';

export default function Page() {
  return <UserChatWidget />;
}
```

## Usage Flow

1. User opens chat widget
2. Toggle between AI Assistant (default) or Human Support
3. Type message to AI
4. AI responds with:
   - Direct answer (from KB or LLM)
   - Authentication prompt (if account info needed but not logged in)
   - Escalation + ticket ID (for complex issues)
5. If escalated, human support takes over

## Monitoring & Analytics

Track in audit logs:
- Most asked questions
- AI accuracy
- Escalation rate
- User satisfaction
- Failed queries
- Security events

Query logs:
```typescript
import { AuditLogger } from '@/app/lib/services/audit-logger';

// Get all logs for a user
const logs = await AuditLogger.getAuditLogsForUser(userId);

// Get security events
const securityEvents = await AuditLogger.getSecurityEvents();
```

## Security Best Practices

1. **Never expose NVIDIA_API_KEY** - Keep in backend only
2. **Monitor API usage** - Watch for unusual patterns
3. **Review escalations** - Manually check escalated issues
4. **Update knowledge base** - Keep information current
5. **Rate limiting** - 30 requests/min per user (prevents abuse)
6. **Data sanitization** - Never send internal fields to AI
7. **Audit logging** - Review logs regularly for security issues

## Testing

### Test the AI Assistant

```bash
curl -X POST http://localhost:3000/api/support/ai-chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I withdraw my money?"}'
```

### Initialize Knowledge Base

```bash
curl -X POST http://localhost:3000/api/support/kb-init \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Troubleshooting

### "NVIDIA_API_KEY is not set"
- Ensure environment variable is defined
- Check `.env.local` or vercel/project environment variables
- Restart dev server after adding env vars

### "Too many requests"
- User has exceeded rate limit (30/min)
- Wait a minute and try again
- Check for automated bot abuse

### AI gives generic responses
- Knowledge base may not be seeded
- Run `/api/support/kb-init` endpoint
- Check that documents are marked `is_active: true`

### Escalation not working
- Verify user is authenticated (if accessing user data)
- Check that issue type matches escalation keywords
- Review audit logs for error details

## Future Enhancements

- [ ] Multi-language support
- [ ] Sentiment analysis for user frustration
- [ ] Integration with external knowledge bases
- [ ] A/B testing different LLM models
- [ ] User feedback on AI response quality
- [ ] Custom fine-tuning of models
- [ ] Voice support
- [ ] Mobile app integration
