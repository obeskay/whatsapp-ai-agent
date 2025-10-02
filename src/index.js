import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import chalk from 'chalk';
import { WhatsAppAgent } from './agent.js';
import { EvolutionAPI } from './evolution-api.js';
import { setupDashboard } from './dashboard.js';
import { logger } from './utils/logger.js';
import { getCorsConfig } from './cors-config.js';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: getCorsConfig()
});

// Security middleware
const rateLimitMap = new Map();

// Rate limiting middleware
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

// Initialize WhatsApp Agent
const agent = new WhatsAppAgent({
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

// WebSocket connection for dashboard
io.on('connection', (socket) => {
  logger.info('Dashboard connected');

  socket.on('get-status', () => {
    socket.emit('status', agent.getStatus());
  });

  socket.on('get-messages', () => {
    socket.emit('messages', agent.getRecentMessages());
  });

  socket.on('disconnect', () => {
    logger.info('Dashboard disconnected');
  });
});

// Webhook endpoint for Evolution API with security
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

// Handle new messages
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

    // Process message with agent
    const response = await agent.processMessage(message);

    if (response) {
      // Send response back to WhatsApp
      await evolutionAPI.sendMessage(from, response);

      // Update dashboard
      io.emit('response-sent', {
        to: from,
        response,
        timestamp: new Date()
      });
    }
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    agent: agent.getStatus(),
    timestamp: new Date()
  });
});

// Start the server
async function start() {
  try {
    console.log(chalk.cyan('\n🤖 WhatsApp AI Agent Starting...\n'));

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
    });

    // Set up dashboard if enabled
    if (process.env.DASHBOARD_PORT) {
      setupDashboard(parseInt(process.env.DASHBOARD_PORT));
    }

  } catch (error) {
    console.error(chalk.red('Failed to start agent:'), error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n👋 Shutting down gracefully...'));

  await evolutionAPI.disconnect();
  server.close();

  process.exit(0);
});

// Start the application
start();