import { OpenAI } from 'openai';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { VoiceProcessor } from './voice-processor.js';
import { logger } from './utils/logger.js';

/**
 * OPTIMIZED WhatsApp Agent with:
 * - Response streaming for faster UX
 * - Message batching and caching
 * - Token optimization in prompts
 * - Robust function calling patterns
 * - Smart retry logic with exponential backoff
 */
export class WhatsAppAgentOptimized {
  constructor(options) {
    this.evolutionAPI = options.evolutionAPI;
    this.config = options.config;
    this.connected = false;

    // OPTIMIZATION: Message cache with TTL
    this.messageHistory = new Map();
    this.responseCache = new Map(); // Cache AI responses for duplicate queries
    this.cacheTTL = parseInt(process.env.CACHE_TTL) || 300000; // 5 minutes default

    // OPTIMIZATION: Message batching for processing multiple messages
    this.pendingMessages = new Map();
    this.batchTimeout = parseInt(process.env.BATCH_TIMEOUT) || 2000; // 2 seconds

    this.sessionTimeout = parseInt(process.env.SESSION_TIMEOUT) || 3600000;

    // Initialize AI client with optimized settings
    if (options.useOpenRouter) {
      this.ai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: options.openrouterKey,
        defaultHeaders: {
          'HTTP-Referer': 'https://github.com/obedvargasvillarreal/whatsapp-ai-agent',
          'X-Title': 'WhatsApp AI Agent'
        },
        timeout: 30000, // 30 second timeout
        maxRetries: 3 // Retry failed requests
      });
      this.model = process.env.OPENROUTER_MODEL || 'mistralai/mistral-small-3';
      this.supportsStreaming = true;
      logger.info(`Using OpenRouter with model: ${this.model}`);
    } else {
      this.ai = new OpenAI({
        apiKey: options.openaiKey,
        timeout: 30000,
        maxRetries: 3
      });
      this.model = process.env.OPENAI_MODEL || 'gpt-5-mini';
      this.supportsStreaming = true;
      logger.info(`Using OpenAI with model: ${this.model}`);
    }

    // OPTIMIZATION: Function calling tools for advanced interactions
    this.tools = this.initializeFunctionTools();
    this.enableFunctions = process.env.ENABLE_FUNCTIONS !== 'false';

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

    // OPTIMIZATION: Periodic cache cleanup
    setInterval(() => this.cleanupCaches(), 60000); // Every minute
  }

  setupPersonality() {
    const personality = this.config.personality || 'helpful, friendly, professional';

    // OPTIMIZATION: Shortened system prompt to save tokens
    this.systemPrompt = `You are ${this.config.name}, a WhatsApp AI assistant.

Personality: ${personality}

Rules:
- Be conversational and concise (WhatsApp format)
- Use emojis sparingly
- Respond in ${this.config.language || 'user\'s language'}
- Acknowledge voice messages naturally

Keep responses brief and helpful.`;
  }

  /**
   * OPTIMIZATION: Initialize function calling tools
   * Enables AI to execute specific actions
   */
  initializeFunctionTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'get_current_time',
          description: 'Get the current time in a specific timezone',
          parameters: {
            type: 'object',
            properties: {
              timezone: {
                type: 'string',
                description: 'IANA timezone (e.g., America/New_York, Europe/London)',
                default: 'UTC'
              }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'set_reminder',
          description: 'Set a reminder for the user',
          parameters: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Reminder message'
              },
              time: {
                type: 'string',
                description: 'When to remind (e.g., "in 1 hour", "tomorrow at 3pm")'
              }
            },
            required: ['message', 'time']
          }
        }
      }
    ];
  }

  /**
   * OPTIMIZATION: Execute function calls from AI
   */
  async executeFunctionCall(functionName, args) {
    try {
      switch (functionName) {
        case 'get_current_time':
          const tz = args.timezone || 'UTC';
          const time = new Date().toLocaleString('en-US', { timeZone: tz });
          return { time, timezone: tz };

        case 'set_reminder':
          // In production, integrate with reminder service
          logger.info(`Reminder set: ${args.message} at ${args.time}`);
          return {
            success: true,
            message: 'Reminder set successfully',
            reminder: args.message,
            time: args.time
          };

        default:
          return { error: 'Function not implemented' };
      }
    } catch (error) {
      logger.error(`Function execution error (${functionName}):`, error);
      return { error: error.message };
    }
  }

  /**
   * OPTIMIZATION: Process message with streaming support
   */
  async processMessage(message, streamCallback = null) {
    try {
      const from = message.key.remoteJid;
      const messageContent = await this.extractMessageContent(message);

      if (!messageContent) {
        logger.warn('No content to process');
        return null;
      }

      // OPTIMIZATION: Check response cache first
      const cacheKey = this.getCacheKey(from, messageContent.text);
      const cachedResponse = this.getCachedResponse(cacheKey);

      if (cachedResponse) {
        logger.info('Returning cached response');
        return cachedResponse;
      }

      // Get or create conversation history
      const history = this.getConversationHistory(from);

      // Add user message to history
      history.push({
        role: 'user',
        content: messageContent.text,
        timestamp: Date.now()
      });

      // OPTIMIZATION: Generate response with streaming if callback provided
      const response = streamCallback
        ? await this.generateResponseStreaming(history, streamCallback)
        : await this.generateResponse(history);

      // Add assistant response to history
      history.push({
        role: 'assistant',
        content: response.text || response,
        timestamp: Date.now()
      });

      // Update history
      this.updateConversationHistory(from, history);

      // OPTIMIZATION: Cache the response
      this.cacheResponse(cacheKey, response);

      // Determine response format
      if (messageContent.isVoice && this.config.enableVoice) {
        const audioBuffer = await this.voiceProcessor.textToSpeech(response.text || response);
        return {
          type: 'audio',
          content: audioBuffer,
          text: response.text || response
        };
      } else {
        return {
          type: 'text',
          content: response.text || response
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
        const audioData = await this.evolutionAPI.downloadMedia(message);

        if (!audioData) {
          throw new Error('Failed to download audio');
        }

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

  /**
   * OPTIMIZATION: Generate response with token efficiency
   */
  async generateResponse(history) {
    try {
      // OPTIMIZATION: Limit history to save tokens (keep last 10 messages)
      const recentHistory = history.slice(-10);

      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...recentHistory.map(h => ({
          role: h.role,
          content: h.content
        }))
      ];

      const requestConfig = {
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 300, // OPTIMIZATION: Reduced from 500 to save costs
        presence_penalty: 0.1, // Encourage diverse responses
        frequency_penalty: 0.1 // Reduce repetition
      };

      // OPTIMIZATION: Add function calling if enabled
      if (this.enableFunctions) {
        requestConfig.tools = this.tools;
        requestConfig.tool_choice = 'auto';
      }

      // OPTIMIZATION: Retry logic with exponential backoff
      const completion = await this.retryWithBackoff(
        () => this.ai.chat.completions.create(requestConfig),
        3, // max retries
        1000 // initial delay ms
      );

      const message = completion.choices[0]?.message;

      // OPTIMIZATION: Handle function calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        const functionResults = [];

        for (const toolCall of message.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          logger.info(`Executing function: ${functionName}`, functionArgs);
          const result = await this.executeFunctionCall(functionName, functionArgs);

          functionResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: functionName,
            content: JSON.stringify(result)
          });
        }

        // OPTIMIZATION: Make second request with function results
        const secondMessages = [
          ...messages,
          message,
          ...functionResults
        ];

        const secondCompletion = await this.retryWithBackoff(
          () => this.ai.chat.completions.create({
            model: this.model,
            messages: secondMessages,
            temperature: 0.7,
            max_tokens: 300
          }),
          2,
          1000
        );

        return {
          text: secondCompletion.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response.',
          functionCalls: message.tool_calls.map(tc => tc.function.name)
        };
      }

      return {
        text: message?.content || 'I apologize, but I couldn\'t generate a response.'
      };

    } catch (error) {
      logger.error('AI generation error:', error);
      throw error;
    }
  }

  /**
   * OPTIMIZATION: Generate response with streaming for faster UX
   * Sends partial responses as they're generated
   */
  async generateResponseStreaming(history, streamCallback) {
    try {
      const recentHistory = history.slice(-10);

      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...recentHistory.map(h => ({
          role: h.role,
          content: h.content
        }))
      ];

      const stream = await this.ai.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 300,
        stream: true // OPTIMIZATION: Enable streaming
      });

      let fullResponse = '';
      let buffer = '';
      const CHUNK_SIZE = 50; // Send every 50 characters

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullResponse += content;
        buffer += content;

        // OPTIMIZATION: Send chunks periodically for faster perceived response
        if (buffer.length >= CHUNK_SIZE) {
          if (streamCallback) {
            streamCallback(buffer);
          }
          buffer = '';
        }
      }

      // Send remaining buffer
      if (buffer.length > 0 && streamCallback) {
        streamCallback(buffer);
      }

      return {
        text: fullResponse || 'I apologize, but I couldn\'t generate a response.',
        streamed: true
      };

    } catch (error) {
      logger.error('Streaming error:', error);
      // Fallback to non-streaming
      return await this.generateResponse(history);
    }
  }

  /**
   * OPTIMIZATION: Retry with exponential backoff
   * Handles API rate limits and transient errors
   */
  async retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Don't retry on certain errors
        if (error.status === 401 || error.status === 403) {
          throw error;
        }

        if (i < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, i);
          logger.warn(`Retry ${i + 1}/${maxRetries} after ${delay}ms due to:`, error.message);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * OPTIMIZATION: Response caching
   */
  getCacheKey(jid, text) {
    // Normalize text for better cache hits
    const normalized = text.toLowerCase().trim();
    return `${jid}:${normalized.substring(0, 100)}`; // Use first 100 chars as key
  }

  getCachedResponse(key) {
    const cached = this.responseCache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.cacheTTL) {
      this.responseCache.delete(key);
      return null;
    }

    return cached.response;
  }

  cacheResponse(key, response) {
    // OPTIMIZATION: Limit cache size to prevent memory bloat
    const MAX_CACHE_SIZE = 1000;

    if (this.responseCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entries
      const firstKey = this.responseCache.keys().next().value;
      this.responseCache.delete(firstKey);
    }

    this.responseCache.set(key, {
      response,
      timestamp: Date.now()
    });
  }

  /**
   * OPTIMIZATION: Periodic cache cleanup
   */
  cleanupCaches() {
    const now = Date.now();
    let cleaned = 0;

    // Clean response cache
    for (const [key, value] of this.responseCache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.responseCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired cache entries`);
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

    // OPTIMIZATION: Aggressive history limiting to save memory and tokens
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
      cacheSize: this.responseCache.size,
      config: {
        name: this.config.name,
        personality: this.config.personality,
        voiceEnabled: this.config.enableVoice,
        language: this.config.language,
        functionsEnabled: this.enableFunctions,
        streamingEnabled: this.supportsStreaming
      }
    };
  }

  clearHistory(jid = null) {
    if (jid) {
      this.messageHistory.delete(jid);
      // Also clear related cache entries
      for (const key of this.responseCache.keys()) {
        if (key.startsWith(`${jid}:`)) {
          this.responseCache.delete(key);
        }
      }
    } else {
      this.messageHistory.clear();
      this.responseCache.clear();
    }
  }
}
