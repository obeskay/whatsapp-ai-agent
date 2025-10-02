import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupDashboard(port) {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Serve static files
  app.use(express.static(path.join(__dirname, '../public')));

  // Dashboard HTML
  app.get('/dashboard', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp AI Agent Dashboard</title>
    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .pulse { animation: pulse 2s infinite; }
    </style>
</head>
<body class="bg-gray-900 text-white">
    <div class="container mx-auto px-4 py-8">
        <!-- Header -->
        <div class="bg-gray-800 rounded-lg p-6 mb-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-teal-400">WhatsApp AI Agent</h1>
                    <p class="text-gray-400 mt-2">Real-time monitoring dashboard</p>
                </div>
                <div id="connection-status" class="flex items-center">
                    <div id="status-indicator" class="w-3 h-3 rounded-full bg-gray-500 mr-2"></div>
                    <span id="status-text" class="text-gray-400">Disconnected</span>
                </div>
            </div>
        </div>

        <!-- Stats Grid -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-gray-800 rounded-lg p-4">
                <h3 class="text-gray-400 text-sm mb-1">Status</h3>
                <p id="agent-status" class="text-2xl font-bold">Offline</p>
            </div>
            <div class="bg-gray-800 rounded-lg p-4">
                <h3 class="text-gray-400 text-sm mb-1">Active Chats</h3>
                <p id="active-chats" class="text-2xl font-bold">0</p>
            </div>
            <div class="bg-gray-800 rounded-lg p-4">
                <h3 class="text-gray-400 text-sm mb-1">Messages Processed</h3>
                <p id="total-messages" class="text-2xl font-bold">0</p>
            </div>
            <div class="bg-gray-800 rounded-lg p-4">
                <h3 class="text-gray-400 text-sm mb-1">Voice Messages</h3>
                <p id="voice-messages" class="text-2xl font-bold">0</p>
            </div>
        </div>

        <!-- QR Code Section -->
        <div id="qr-section" class="bg-gray-800 rounded-lg p-6 mb-6 hidden">
            <h2 class="text-xl font-bold mb-4 text-teal-400">Scan QR Code</h2>
            <div class="flex justify-center">
                <div id="qr-code" class="bg-white p-4 rounded-lg"></div>
            </div>
            <p class="text-center mt-4 text-gray-400">Scan with WhatsApp to connect</p>
        </div>

        <!-- Recent Messages -->
        <div class="bg-gray-800 rounded-lg p-6">
            <h2 class="text-xl font-bold mb-4 text-teal-400">Recent Messages</h2>
            <div id="messages-container" class="space-y-3 max-h-96 overflow-y-auto">
                <p class="text-gray-500 text-center py-8">No messages yet...</p>
            </div>
        </div>

        <!-- Controls -->
        <div class="mt-6 flex gap-4">
            <button onclick="clearMessages()" class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors">
                Clear Messages
            </button>
            <button onclick="restartAgent()" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
                Restart Agent
            </button>
            <button onclick="exportLogs()" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors">
                Export Logs
            </button>
        </div>
    </div>

    <script>
        const socket = io();
        let voiceMessageCount = 0;

        // Connection status
        socket.on('connect', () => {
            document.getElementById('status-indicator').className = 'w-3 h-3 rounded-full bg-green-500 mr-2 pulse';
            document.getElementById('status-text').textContent = 'Connected';
        });

        socket.on('disconnect', () => {
            document.getElementById('status-indicator').className = 'w-3 h-3 rounded-full bg-red-500 mr-2';
            document.getElementById('status-text').textContent = 'Disconnected';
        });

        // WhatsApp connection status
        socket.on('connection-update', (data) => {
            const statusEl = document.getElementById('agent-status');
            if (data.state === 'open') {
                statusEl.textContent = 'Online';
                statusEl.className = 'text-2xl font-bold text-green-400';
                document.getElementById('qr-section').classList.add('hidden');
            } else if (data.state === 'close') {
                statusEl.textContent = 'Offline';
                statusEl.className = 'text-2xl font-bold text-red-400';
            } else {
                statusEl.textContent = 'Connecting...';
                statusEl.className = 'text-2xl font-bold text-yellow-400';
            }
        });

        // QR Code
        socket.on('qr-code', (data) => {
            const qrSection = document.getElementById('qr-section');
            const qrContainer = document.getElementById('qr-code');

            qrSection.classList.remove('hidden');
            qrContainer.innerHTML = '<pre style="font-size: 8px; line-height: 0.6;">' + data.qr + '</pre>';
        });

        // Status updates
        socket.on('status', (data) => {
            document.getElementById('active-chats').textContent = data.activeConversations || 0;
            document.getElementById('total-messages').textContent = data.totalMessages || 0;
        });

        // New messages
        socket.on('new-message', (data) => {
            addMessage({
                type: 'received',
                from: data.from,
                messageType: data.type,
                time: new Date(data.timestamp).toLocaleTimeString()
            });

            if (data.type === 'audioMessage') {
                voiceMessageCount++;
                document.getElementById('voice-messages').textContent = voiceMessageCount;
            }
        });

        // Response sent
        socket.on('response-sent', (data) => {
            addMessage({
                type: 'sent',
                to: data.to,
                content: data.response.content || data.response.text,
                time: new Date(data.timestamp).toLocaleTimeString()
            });
        });

        function addMessage(msg) {
            const container = document.getElementById('messages-container');

            const messageEl = document.createElement('div');
            messageEl.className = msg.type === 'received'
                ? 'bg-gray-700 rounded-lg p-3 border-l-4 border-blue-500'
                : 'bg-gray-700 rounded-lg p-3 border-l-4 border-green-500';

            const typeIcon = msg.messageType === 'audioMessage' ? '🎤' : '💬';
            const direction = msg.type === 'received' ? 'From' : 'To';
            const contact = msg.from || msg.to;

            messageEl.innerHTML = \`
                <div class="flex justify-between items-start">
                    <div>
                        <span class="text-xs text-gray-400">\${direction}: \${contact}</span>
                        <p class="text-sm mt-1">\${typeIcon} \${msg.content || msg.messageType || 'Message'}</p>
                    </div>
                    <span class="text-xs text-gray-500">\${msg.time}</span>
                </div>
            \`;

            container.insertBefore(messageEl, container.firstChild);

            // Remove placeholder
            const placeholder = container.querySelector('.text-gray-500');
            if (placeholder) placeholder.remove();

            // Keep only last 50 messages
            while (container.children.length > 50) {
                container.removeChild(container.lastChild);
            }
        }

        function clearMessages() {
            const container = document.getElementById('messages-container');
            container.innerHTML = '<p class="text-gray-500 text-center py-8">No messages yet...</p>';
        }

        function restartAgent() {
            if (confirm('Are you sure you want to restart the agent?')) {
                socket.emit('restart-agent');
            }
        }

        function exportLogs() {
            socket.emit('export-logs');
            alert('Logs exported to app.log file');
        }

        // Request initial status
        socket.emit('get-status');
        setInterval(() => {
            socket.emit('get-status');
        }, 5000);
    </script>
</body>
</html>
    `);
  });

  // Start dashboard server
  server.listen(port, () => {
    console.log(chalk.blue(`📊 Dashboard running on http://localhost:${port}/dashboard`));
  });

  return io;
}