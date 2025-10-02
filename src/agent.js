import { OpenAI } from 'openai';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { VoiceProcessor } from './voice-processor.js';
import { logger } from './utils/logger.js';

export class WhatsAppAgent {
  constructor(options) {
    this.evolutionAPI = options.evolutionAPI;
    this.config = options.config;
    this.connected = false;
    this.messageHistory = new Map();
    this.sessionTimeout = parseInt(process.env.SESSION_TIMEOUT) || 3600000;

    // Initialize AI client
    if (options.useOpenRouter) {
      this.ai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: options.openrouterKey,
        defaultHeaders: {
          'HTTP-Referer': 'https://github.com/obedvargasvillarreal/whatsapp-ai-agent',
          'X-Title': 'WhatsApp AI Agent'
        }
      });
      this.model = 'openai/gpt-4o-mini';
    } else {
      this.ai = new OpenAI({
        apiKey: options.openaiKey
      });
      this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    }

    // Initialize voice processor if enabled
    if (this.config.enableVoice) {
      this.voiceProcessor = new VoiceProcessor({
        openaiKey: options.openaiKey,
        whisperModel: process.env.WHISPER_MODEL || 'whisper-1',
        ttsModel: process.env.TTS_MODEL || 'tts-1',
        ttsVoice: process.env.TTS_VOICE || 'nova'
      });
    }

    this.setupPersonality();
  }

  setupPersonality() {
    const personality = this.config.personality || 'helpful, friendly, professional';

    this.systemPrompt = `You are ${this.config.name}, a WhatsApp AI assistant.

Your personality traits: ${personality}

Guidelines:
- Be conversational and natural, this is WhatsApp not formal email
- Keep responses concise but helpful (WhatsApp messages should be easy to read)
- Use emojis occasionally to be friendly but don't overdo it
- If asked about yourself, mention you're an AI assistant helping through WhatsApp
- Be helpful and try to understand the user's intent
- If you receive a voice message transcription, acknowledge it naturally
- Adapt your tone to match the conversation style

Language: Respond in ${this.config.language || 'the same language as the user'}.`;
  }

  async processMessage(message) {
    try {
      const from = message.key.remoteJid;
      const messageContent = await this.extractMessageContent(message);

      if (!messageContent) {
        logger.warn('No content to process');
        return null;
      }

      // Get or create conversation history
      const history = this.getConversationHistory(from);

      // Add user message to history
      history.push({
        role: 'user',
        content: messageContent.text,
        timestamp: Date.now()
      });

      // Process with AI
      const response = await this.generateResponse(history);

      // Add assistant response to history
      history.push({
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      });

      // Update history
      this.updateConversationHistory(from, history);

      // Determine response format
      if (messageContent.isVoice && this.config.enableVoice) {
        // Generate voice response
        const audioBuffer = await this.voiceProcessor.textToSpeech(response);
        return {
          type: 'audio',
          content: audioBuffer,
          text: response
        };
      } else {
        // Send text response
        return {
          type: 'text',
          content: response
        };
      }

    } catch (error) {
      logger.error('Message processing error:', error);
      return {
        type: 'text',
        content: 'Sorry, I encountered an error processing your message. Please try again.'
      };
    }
  }

  async extractMessageContent(message) {
    const messageObj = message.message;

    // Handle text messages
    if (messageObj.conversation) {
      return {
        text: messageObj.conversation,
        isVoice: false
      };
    }

    if (messageObj.extendedTextMessage?.text) {
      return {
        text: messageObj.extendedTextMessage.text,
        isVoice: false
      };
    }

    // Handle voice messages
    if (messageObj.audioMessage && this.config.autoTranscribe) {
      try {
        logger.info('Processing voice message...');

        // Download audio from Evolution API
        const audioData = await this.evolutionAPI.downloadMedia(message);

        if (!audioData) {
          throw new Error('Failed to download audio');
        }

        // Transcribe audio
        const transcript = await this.voiceProcessor.transcribeAudio(audioData);

        return {
          text: `[Voice Message]: ${transcript}`,
          isVoice: true,
          originalAudio: audioData
        };

      } catch (error) {
        logger.error('Voice processing error:', error);
        return {
          text: '[Unable to process voice message]',
          isVoice: true
        };
      }
    }

    // Handle image messages with caption
    if (messageObj.imageMessage?.caption) {
      return {
        text: `[Image with caption]: ${messageObj.imageMessage.caption}`,
        isVoice: false
      };
    }

    return null;
  }

  async generateResponse(history) {
    try {
      // Prepare messages for AI
      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...history.slice(-10).map(h => ({
          role: h.role,
          content: h.content
        }))
      ];

      // Generate response
      const completion = await this.ai.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 500
      });

      return completion.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response.';

    } catch (error) {
      logger.error('AI generation error:', error);
      throw error;
    }
  }

  getConversationHistory(jid) {
    if (!this.messageHistory.has(jid)) {
      this.messageHistory.set(jid, []);
    }

    const history = this.messageHistory.get(jid);

    // Clean old messages
    const now = Date.now();
    const filtered = history.filter(msg =>
      (now - msg.timestamp) < this.sessionTimeout
    );

    // Limit history size
    const maxHistory = parseInt(process.env.MAX_MESSAGES_HISTORY) || 50;
    if (filtered.length > maxHistory) {
      return filtered.slice(-maxHistory);
    }

    return filtered;
  }

  updateConversationHistory(jid, history) {
    this.messageHistory.set(jid, history);
  }

  getRecentMessages(limit = 20) {
    const allMessages = [];

    this.messageHistory.forEach((history, jid) => {
      history.forEach(msg => {
        allMessages.push({
          ...msg,
          from: jid
        });
      });
    });

    // Sort by timestamp and return recent ones
    return allMessages
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  setConnected(status) {
    this.connected = status;
  }

  getStatus() {
    return {
      connected: this.connected,
      activeConversations: this.messageHistory.size,
      totalMessages: Array.from(this.messageHistory.values())
        .reduce((sum, history) => sum + history.length, 0),
      config: {
        name: this.config.name,
        personality: this.config.personality,
        voiceEnabled: this.config.enableVoice,
        language: this.config.language
      }
    };
  }

  clearHistory(jid = null) {
    if (jid) {
      this.messageHistory.delete(jid);
    } else {
      this.messageHistory.clear();
    }
  }
}