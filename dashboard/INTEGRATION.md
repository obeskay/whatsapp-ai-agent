# Dashboard Integration Guide

Complete guide for integrating the Next.js dashboard with the WhatsApp AI Agent backend.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    WhatsApp AI Agent System                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  Express Server  │◄───────►│  Next.js Dashboard│         │
│  │  (Port 3003)     │         │  (Port 3004)      │         │
│  │                  │         │                   │         │
│  │  - Webhooks      │         │  - React UI       │         │
│  │  - Socket.IO     │         │  - Socket.IO      │         │
│  │  - REST API      │         │  - Real-time      │         │
│  └────────┬─────────┘         └──────────────────┘          │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  WhatsApp Agent  │         │  Evolution API   │          │
│  │  - Voice Proc    │◄───────►│  - QR Code       │          │
│  │  - AI Processing │         │  - Messages      │          │
│  │  - Sessions      │         │  - Media         │          │
│  └──────────────────┘         └──────────────────┘          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Communication Flow

### 1. WebSocket Events (Real-time)

**Dashboard → Backend:**
```javascript
socket.emit('get-status')      // Request current agent status
socket.emit('get-messages')    // Request recent messages
```

**Backend → Dashboard:**
```javascript
socket.emit('status', statusData)              // Agent status update
socket.emit('messages', messagesArray)         // Recent messages
socket.emit('new-message', messageData)        // New message notification
socket.emit('connection-update', { state })    // WhatsApp connection state
socket.emit('qr-code', { qr })                // QR code for connection
```

### 2. REST API Endpoints

**GET /health**
```javascript
// Request
fetch('http://localhost:3003/health')

// Response
{
  status: 'ok',
  agent: {
    connected: true,
    activeSessions: 5,
    messagesCount: 142,
    avgResponseTime: 850
  },
  timestamp: '2025-10-02T12:00:00.000Z'
}
```

## Data Models

### Status Object
```typescript
interface AgentStatus {
  connected: boolean
  activeSessions: number
  messagesCount: number
  avgResponseTime: number  // milliseconds
}
```

### Message Object
```typescript
interface Message {
  from: string              // Phone number with @s.whatsapp.net
  type: string             // 'conversation', 'audioMessage', etc.
  timestamp: Date
  content?: string         // For text messages
  transcription?: string   // For voice messages
}
```

### Conversation Object
```typescript
interface Conversation {
  id: string
  contact: string          // Phone number
  lastMessage: string
  timestamp: Date
  status: 'active' | 'resolved'
  messageCount: number
}
```

## Backend Implementation Requirements

The Express backend needs to expose these Socket.IO handlers:

```javascript
// src/index.js
io.on('connection', (socket) => {
  // Status request
  socket.on('get-status', () => {
    socket.emit('status', {
      connected: agent.isConnected(),
      activeSessions: agent.getActiveSessions(),
      messagesCount: agent.getMessagesCount(),
      avgResponseTime: agent.getAvgResponseTime()
    })
  })

  // Messages request
  socket.on('get-messages', () => {
    socket.emit('messages', agent.getRecentMessages(10))
  })
})

// Broadcast events
io.emit('new-message', messageData)
io.emit('connection-update', { state: 'open' })
io.emit('response-sent', responseData)
```

## Agent Class Integration

The `WhatsAppAgent` class should implement these methods:

```javascript
class WhatsAppAgent {
  // Status methods
  isConnected() {
    return this.connected
  }

  getActiveSessions() {
    return this.sessions.size
  }

  getMessagesCount() {
    return this.messageCounter
  }

  getAvgResponseTime() {
    // Calculate average from response times array
    return this.calculateAverage(this.responseTimes)
  }

  // Message methods
  getRecentMessages(limit = 10) {
    return this.messages.slice(-limit).reverse()
  }

  // Session management
  setConnected(state) {
    this.connected = state
    // Broadcast to dashboard
    io.emit('connection-update', { state: state ? 'open' : 'close' })
  }
}
```

## CORS Configuration

The backend needs CORS configured for the dashboard:

```javascript
// src/cors-config.js
export function getCorsConfig() {
  return {
    origin: [
      'http://localhost:3004',      // Development
      'http://localhost:3000',      // Alternative
      process.env.DASHBOARD_URL     // Production
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
}
```

## Environment Variables

### Backend (.env)
```env
PORT=3003
DASHBOARD_PORT=3004
WEBHOOK_URL=http://localhost:3003/webhook
WEBHOOK_SECRET=your-webhook-secret
```

### Dashboard (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3003
```

## Security Considerations

### 1. Webhook Signature Verification
```javascript
// Already implemented in src/index.js
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-webhook-signature']
  const secret = process.env.WEBHOOK_SECRET

  // Verify using HMAC SHA256
  // ... verification logic
}
```

### 2. Rate Limiting
```javascript
// Applied to webhook endpoint
app.post('/webhook', rateLimit, verifyWebhookSignature, async (req, res) => {
  // Handle webhook
})
```

### 3. Socket.IO Authentication (Optional)
```javascript
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  if (isValidToken(token)) {
    next()
  } else {
    next(new Error('Authentication error'))
  }
})
```

## Deployment Considerations

### Development
```bash
# Terminal 1 - Backend
npm run dev

# Terminal 2 - Dashboard
cd dashboard
npm run dev
```

### Production
```bash
# Build dashboard
cd dashboard
npm run build

# Start both services
npm start                    # Backend on 3003
cd dashboard && npm start   # Dashboard on 3004
```

### Using Process Manager (PM2)
```json
{
  "apps": [
    {
      "name": "whatsapp-agent",
      "script": "src/index.js",
      "cwd": "/path/to/app",
      "env": {
        "NODE_ENV": "production",
        "PORT": "3003"
      }
    },
    {
      "name": "whatsapp-dashboard",
      "script": "node_modules/next/dist/bin/next",
      "args": "start -p 3004",
      "cwd": "/path/to/app/dashboard",
      "env": {
        "NODE_ENV": "production"
      }
    }
  ]
}
```

## Troubleshooting

### Dashboard can't connect to backend
1. Check backend is running on port 3003
2. Verify CORS configuration includes dashboard URL
3. Check firewall settings
4. Verify Socket.IO connection: `io('http://localhost:3003')`

### Real-time updates not working
1. Check Socket.IO connection status in browser console
2. Verify backend is emitting events
3. Check for network errors in browser DevTools
4. Ensure WebSocket connections are not blocked

### Data not displaying
1. Verify API endpoint responses with curl or Postman
2. Check browser console for errors
3. Verify data structure matches expected types
4. Check backend is sending correct event names

## Testing

### Test WebSocket Connection
```javascript
// In browser console
const socket = io('http://localhost:3003')
socket.on('connect', () => console.log('Connected!'))
socket.emit('get-status')
socket.on('status', data => console.log('Status:', data))
```

### Test REST API
```bash
# Health check
curl http://localhost:3003/health

# Expected response
{
  "status": "ok",
  "agent": { ... },
  "timestamp": "..."
}
```

## Future Enhancements

### Analytics Dashboard
- Message volume charts
- Response time graphs
- User engagement metrics
- Conversation sentiment analysis

### Advanced Features
- Export conversations to CSV/JSON
- Search and filter messages
- Automated responses configuration
- Multi-language support in UI

### Real-time Collaboration
- Multiple dashboard users
- Role-based access control
- Live chat takeover
- Team notifications
