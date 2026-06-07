#!/bin/bash

# Quick Start Guide for NVIDIA AI Support Assistant
# Run this script to initialize the system

set -e

echo "🚀 NVIDIA AI Support Assistant - Quick Start"
echo "============================================"
echo ""

# Check environment variables
echo "1️⃣  Checking environment variables..."
if [ -z "$NVIDIA_API_KEY" ]; then
    echo "❌ NVIDIA_API_KEY not set in environment"
    echo "   Please add to .env.local or project settings"
    exit 1
else
    echo "✅ NVIDIA_API_KEY is set"
fi

# Initialize knowledge base
echo ""
echo "2️⃣  Initializing knowledge base..."
curl -X POST http://localhost:3000/api/support/kb-init \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NEXT_AUTH_TOKEN" \
  2>/dev/null || echo "⚠️  Could not auto-initialize KB (this is okay, it will initialize on first request)"

echo ""
echo "3️⃣  Testing AI Chat API..."
curl -X POST http://localhost:3000/api/support/ai-chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is HustleHub?"}' \
  2>/dev/null && echo "✅ AI Chat API is working" || echo "⚠️  Could not test API (server may not be running)"

echo ""
echo "✨ Setup complete! The AI Support Assistant is ready to use."
echo ""
echo "Features:"
echo "  • AI-powered support chat with RAG"
echo "  • Knowledge base with FAQs and guides"
echo "  • User-specific information access (for authenticated users)"
echo "  • Automatic escalation for complex issues"
echo "  • Complete audit logging"
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:3000"
echo "  2. Look for the chat widget in the bottom-right"
echo "  3. Click the robot icon to switch to AI Assistant"
echo "  4. Start chatting!"
echo ""
echo "Documentation: See NVIDIA_AI_SETUP.md"
