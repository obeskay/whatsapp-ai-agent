# WhatsApp AI Agent

Voice-enabled WhatsApp bot using Evolution API and modern LLMs (OpenAI/OpenRouter).

## What it does

Turns your WhatsApp into an AI assistant that handles both text and voice messages. Connect via QR code, and it processes conversations with voice transcription and synthesis.

## Requirements

- Node.js 18+
- Evolution API instance (local or cloud)
- OpenAI key (for voice) OR OpenRouter key (for chat only)
- WhatsApp account

## Quick Start

```bash
git clone https://github.com/obedvargasvillarreal/whatsapp-ai-agent.git
cd whatsapp-ai-agent
npm install
cp .env.example .env
```

Edit `.env` with your credentials:

```env
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=your-key
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-5-mini
```

Test your setup:
```bash
npm test
```

Start the agent:
```bash
npm start
```

Scan the QR code with WhatsApp and you're live.

## Model Recommendations (Oct 2025)

For WhatsApp use cases (fast, cheap, good enough):

- `mistralai/mistral-small-3` - Best bang for buck. Ultra-fast, supports function calling. $0.20/$0.60 per 1M tokens.
- `openai/gpt-5-mini` - Reliable, good value
- `deepseek/deepseek-r1-distill-qwen-32b` - Open source, cheap
- `meta-llama/llama-3.1-70b` - 128K context for long chats

Premium (slower, pricier, better quality):
- `anthropic/claude-sonnet-4.5` - Best reasoning ($3/$15 per 1M)
- `openai/gpt-5` - Multimodal flagship

## How it works

1. Evolution API handles WhatsApp connection
2. Webhooks send incoming messages to the agent
3. Voice messages get transcribed via Whisper
4. LLM processes the message (maintaining conversation context)
5. Text responses go back as-is, or get synthesized to voice with TTS
6. Reply sent back through Evolution API

## Dashboard

There's a Next.js dashboard at `localhost:3004` for monitoring:

```bash
cd dashboard
npm install
npm run dev
```

Shows active sessions, message counts, conversation history. Built with Next.js 14 + shadcn/ui.

## Voice Processing

- Transcription: OpenAI Whisper API
- Synthesis: OpenAI TTS API
- Supports OGG/MP3/WAV formats
- Auto-detect language

Voice requires OpenAI key. OpenRouter doesn't support Whisper/TTS yet.

## Configuration

**Agent personality** - Edit system prompt in `.env`:
```env
AGENT_PERSONALITY=helpful, friendly, professional
```

**Voice settings**:
```env
ENABLE_VOICE=true
TTS_VOICE=nova  # or alloy, echo, fable, onyx, shimmer
```

**Rate limits**:
```env
MAX_MESSAGES_PER_MINUTE=20
MAX_VOICE_MESSAGES_PER_MINUTE=5
```

## OpenRouter Setup

Set `USE_OPENROUTER=true` in `.env` and configure:

```env
OPENROUTER_API_KEY=your-key
OPENROUTER_MODEL=mistralai/mistral-small-3
```

Note: Voice features require OpenAI key regardless.

## Evolution API

Run locally:
```bash
docker run -d --name evolution-api -p 8080:8080 evolutionapi/evolution-api:latest
```

Or use a cloud instance. Get API key from Evolution dashboard.

## Troubleshooting

**QR code not showing**: Check Evolution API is running and accessible
**Voice not working**: Verify OpenAI API key is set (not OpenRouter)
**Messages not received**: Check webhook URL is publicly accessible
**High latency**: Try Mistral Small 3 instead of GPT-5

Run `npm test` to diagnose connection issues.

## Project Structure

```
src/
  agent.js         - Core AI agent logic
  evolution-api.js - Evolution API client
  voice-processor.js - Whisper + TTS handling
  index.js         - Express server + webhooks

dashboard/         - Next.js monitoring UI
config/           - Agent personalities, filters
```

## License

MIT

## Contact

Obed Vargas Villarreal
- [obeskay.com](https://obeskay.com)
- [hola@obeskay.com](mailto:hola@obeskay.com)
