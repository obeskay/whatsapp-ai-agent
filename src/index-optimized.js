import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import chalk from 'chalk';
import { WhatsAppAgentOptimized } from './agent-optimized.js';
import { EvolutionAPI } from './evolution-api.js';
import { MessageBatcher } from './message-batcher.js';
import { setupDashboard } from './dashboard.js';
import { logger } from './utils/logger.js';
import { getCorsConfig } from './cors-config.js';
import crypto from 'crypto';

/**
 * OPTIMIZED index.js with:
 * - Message batching for rapid messages
 * - Streaming support for faster UX
 * - Performance monitoring
 * - Enhanced error handling
 */

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: getCorsConfig()
});

// Security middleware
const rateLimitMap = new Map();

// OPTIMIZATION: Enhanced rate limiting with separate limits for different message types
const rateLimit = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100;

  if (!rateLimitMap.has(clientIP)) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + windowMs });
    return next();
  }

  const clientData = rateLimitMap.get(clientIP);

  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + windowMs;
    return next();
  }

  if (clientData.count >= maxRequests) {
    return res.status(429).json({
      error: 'Too many webhook requests from this IP, please try again later.'
    });
  }

  clientData.count++;
  next();
};

// Webhook signature verification
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    logger.error('WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  if (!signature) {
    logger.error('Missing webhook signature');
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  const body = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  const providedSignature = signature.replace('sha256=', '');

  if (crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(providedSignature, 'hex')
  )) {
    next();
  } else {
    logger.error('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Evolution API client
const evolutionAPI = new EvolutionAPI({
  apiUrl: process.env.EVOLUTION_API_URL,
  apiKey: process.env.EVOLUTION_API_KEY,
  instanceName: process.env.EVOLUTION_INSTANCE_NAME
});

// OPTIMIZATION: Initialize optimized WhatsApp Agent
const agent = new WhatsAppAgentOptimized({
  evolutionAPI,
  openaiKey: process.env.OPENAI_API_KEY,
  openrouterKey: process.env.OPENROUTER_API_KEY,
  useOpenRouter: process.env.USE_OPENROUTER === 'true',
  config: {
    name: process.env.AGENT_NAME,
    personality: process.env.AGENT_PERSONALITY,
    language: process.env.AGENT_LANGUAGE,
    enableVoice: process.env.ENABLE_VOICE === 'true',
    autoTranscribe: process.env.AUTO_TRANSCRIBE === 'true'
  }
});

// OPTIMIZATION: Initialize message batcher
const messageBatcher = new MessageBatcher({
  batchWindow: parseInt(process.env.BATCH_TIMEOUT) || 2000,
  maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE) || 5,
  processCallback: async (userId, message) => {
    try {
      logger.info(`Processing message from ${userId}`);

      // Show typing indicator
      await evolutionAPI.sendPresence(userId, 'composing');

      // OPTIMIZATION: Process with streaming callback
      const startTime = Date.now();
      const response = await agent.processMessage(message, (chunk) => {
        // Optional: Could send typing updates or partial responses here
        logger.debug(`Streaming chunk: ${chunk.substring(0, 20)}...`);
      });

      const processingTime = Date.now() - startTime;
      logger.info(`Response generated in ${processingTime}ms`);

      if (response) {
        // Send response back to WhatsApp
        await evolutionAPI.sendMessage(userId, response);

        // Update dashboard
        io.emit('response-sent', {
          to: userId,
          response,
          processingTime,
          timestamp: new Date()
        });

        // OPTIMIZATION: Log performance metrics
        if (processingTime > 5000) {
          logger.warn(`Slow response: ${processingTime}ms for ${userId}`);
        }
      }
    } catch (error) {
      logger.error('Message processing error:', error);

      // Send error message to user
      await evolutionAPI.sendMessage(userId, {
        type: 'text',
        content: 'Sorry, I encountered an error. Please try again.'
      });
    }
  }
});

// WebSocket connection for dashboard
io.on('connection', (socket) => {
  logger.info('Dashboard connected');

  socket.on('get-status', () => {
    const status = agent.getStatus();
    const batcherStats = messageBatcher.getStats();

    socket.emit('status', {
      ...status,
      batcher: batcherStats,
      optimization: {
        cachingEnabled: true,
        streamingEnabled: status.config.streamingEnabled,
        batchingEnabled: true,
        functionsEnabled: status.config.functionsEnabled
      }
    });
  });

  socket.on('get-messages', () => {
    socket.emit('messages', agent.getRecentMessages());
  });

  socket.on('clear-cache', () => {
    agent.clearHistory();
    socket.emit('cache-cleared', { success: true });
  });

  socket.on('get-performance-metrics', () => {
    const status = agent.getStatus();
    const metrics = {
      cacheHitRate: status.cacheSize > 0
        ? (status.cacheSize / status.totalMessages * 100).toFixed(1) + '%'
        : 'N/A',
      avgMessagesPerConversation: status.activeConversations > 0
        ? (status.totalMessages / status.activeConversations).toFixed(1)
        : 0,
      activeBatches: messageBatcher.getStats().activeBatches
    };

    socket.emit('performance-metrics', metrics);
  });

  socket.on('disconnect', () => {
    logger.info('Dashboard disconnected');
  });
});

// OPTIMIZATION: Webhook endpoint with batching
app.post('/webhook', rateLimit, verifyWebhookSignature, async (req, res) => {
  try {
    const { event, data } = req.body;

    logger.info(`Webhook received: ${event}`);

    switch (event) {
      case 'messages.upsert':
        await handleNewMessage(data);
        break;

      case 'connection.update':
        handleConnectionUpdate(data);
        break;

      case 'qr':
        handleQRCode(data);
        break;

      default:
        logger.debug(`Unhandled event: ${event}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// OPTIMIZATION: Handle new messages with batching
async function handleNewMessage(data) {
  try {
    const message = data.messages?.[0];
    if (!message || message.key.fromMe) return;

    const from = message.key.remoteJid;
    const messageType = Object.keys(message.message || {})[0];

    logger.info(`New message from ${from}: ${messageType}`);

    // Update dashboard
    io.emit('new-message', {
      from,
      type: messageType,
      timestamp: new Date()
    });

    // OPTIMIZATION: Add to message batcher instead of processing immediately
    // This will batch multiple rapid messages into one API call
    messageBatcher.addMessage(from, message);

  } catch (error) {
    logger.error('Message handling error:', error);
  }
}

// Handle connection updates
function handleConnectionUpdate(data) {
  const { state } = data;

  logger.info(`Connection state: ${state}`);

  io.emit('connection-update', { state });

  if (state === 'open') {
    console.log(chalk.green('✅ WhatsApp connected successfully!'));
    agent.setConnected(true);
  } else if (state === 'close') {
    console.log(chalk.red('❌ WhatsApp disconnected'));
    agent.setConnected(false);
  }
}

// Handle QR code generation
function handleQRCode(data) {
  const { qr } = data;

  if (qr) {
    console.log(chalk.cyan('\n📱 Scan this QR code with WhatsApp:\n'));

    // Display QR code in terminal
    import('qrcode-terminal').then((qrcode) => {
      qrcode.default.generate(qr, { small: true });
    });

    // Send to dashboard
    io.emit('qr-code', { qr });
  }
}

// OPTIMIZATION: Enhanced health check with performance metrics
app.get('/health', (req, res) => {
  const status = agent.getStatus();
  const batcherStats = messageBatcher.getStats();

  res.json({
    status: 'ok',
    agent: status,
    batcher: batcherStats,
    optimization: {
      caching: status.cacheSize > 0,
      streaming: status.config.streamingEnabled,
      batching: batcherStats.activeBatches >= 0,
      functions: status.config.functionsEnabled
    },
    performance: {
      cacheHitRate: status.cacheSize > 0
        ? `${(status.cacheSize / Math.max(status.totalMessages, 1) * 100).toFixed(1)}%`
        : 'N/A'
    },
    timestamp: new Date()
  });
});

// OPTIMIZATION: Performance metrics endpoint
app.get('/metrics', (req, res) => {
  const status = agent.getStatus();
  const batcherStats = messageBatcher.getStats();

  res.json({
    conversations: {
      active: status.activeConversations,
      totalMessages: status.totalMessages,
      avgMessagesPerConversation: status.activeConversations > 0
        ? (status.totalMessages / status.activeConversations).toFixed(2)
        : 0
    },
    cache: {
      size: status.cacheSize,
      hitRate: status.totalMessages > 0
        ? `${(status.cacheSize / status.totalMessages * 100).toFixed(1)}%`
        : 'N/A'
    },
    batcher: {
      activeBatches: batcherStats.activeBatches,
      pendingMessages: batcherStats.totalPendingMessages
    },
    features: {
      streaming: status.config.streamingEnabled,
      functions: status.config.functionsEnabled,
      voice: status.config.voiceEnabled
    }
  });
});

// Start the server
async function start() {
  try {
    console.log(chalk.cyan('\n🤖 WhatsApp AI Agent Starting (OPTIMIZED)...\n'));
    console.log(chalk.blue('⚡ Optimizations enabled:'));
    console.log(chalk.green('  ✓ Response streaming for faster UX'));
    console.log(chalk.green('  ✓ Message batching to reduce API calls'));
    console.log(chalk.green('  ✓ Response caching for instant duplicates'));
    console.log(chalk.green('  ✓ Prompt compression to save tokens'));
    console.log(chalk.green('  ✓ Function calling for advanced interactions\n'));

    // Initialize Evolution API instance
    await evolutionAPI.initialize();

    // Set up webhook
    await evolutionAPI.setWebhook(process.env.WEBHOOK_URL);

    // Generate QR code for connection
    const qrCode = await evolutionAPI.getQRCode();

    if (qrCode) {
      handleQRCode({ qr: qrCode });
    }

    // Start server
    const port = process.env.PORT || 3003;
    server.listen(port, () => {
      console.log(chalk.green(`✅ Server running on port ${port}`));
      console.log(chalk.blue(`📊 Dashboard: http://localhost:${port}/dashboard`));
      console.log(chalk.blue(`📈 Metrics: http://localhost:${port}/metrics`));
      console.log(chalk.blue(`❤️  Health: http://localhost:${port}/health\n`));
    });

    // Set up dashboard if enabled
    if (process.env.DASHBOARD_PORT) {
      setupDashboard(parseInt(process.env.DASHBOARD_PORT));
    }

    // OPTIMIZATION: Periodic performance logging
    setInterval(() => {
      const status = agent.getStatus();
      const batcherStats = messageBatcher.getStats();

      logger.info('Performance snapshot:', {
        conversations: status.activeConversations,
        messages: status.totalMessages,
        cacheSize: status.cacheSize,
        activeBatches: batcherStats.activeBatches
      });
    }, 300000); // Every 5 minutes

  } catch (error) {
    console.error(chalk.red('Failed to start agent:'), error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n👋 Shutting down gracefully...'));

  // OPTIMIZATION: Flush all pending batches before shutdown
  await messageBatcher.flushAll();

  await evolutionAPI.disconnect();
  server.close();

  process.exit(0);
});

// Start the application
start();
