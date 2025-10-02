# WhatsApp AI Agent Dashboard

Beautiful, minimal dashboard for monitoring and managing your WhatsApp AI agent.

## Features

- **Real-time monitoring**: Live connection status and message tracking via Socket.IO
- **Conversation management**: View and filter active conversations
- **Agent configuration**: Monitor and adjust agent settings
- **Teal color scheme**: Matches the existing WhatsApp AI branding
- **Mobile responsive**: Works seamlessly on all devices
- **shadcn/ui components**: Modern, accessible UI components

## Tech Stack

- **Next.js 14** - React framework with App Router
- **shadcn/ui** - High-quality, accessible UI components
- **Tailwind CSS** - Utility-first styling
- **Socket.IO Client** - Real-time WebSocket connection
- **Lucide React** - Beautiful icons

## Installation

```bash
cd dashboard
npm install
```

## Development

```bash
npm run dev
```

Dashboard will run on http://localhost:3004

## Production

```bash
npm run build
npm start
```

## Project Structure

```
dashboard/
├── app/                    # Next.js App Router
│   ├── page.jsx           # Dashboard home
│   ├── conversations/     # Conversations page
│   ├── settings/          # Settings page
│   ├── layout.jsx         # Root layout
│   └── globals.css        # Global styles with teal theme
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   │   ├── card.jsx
│   │   ├── badge.jsx
│   │   ├── button.jsx
│   │   └── tabs.jsx
│   └── navigation.jsx    # Main navigation
└── lib/
    └── utils.js          # Utility functions
```

## API Integration

The dashboard connects to the Express backend running on port 3003:

- **HTTP API**: `http://localhost:3003/health` - Health check and status
- **WebSocket**: `http://localhost:3003` - Real-time updates via Socket.IO

### Socket.IO Events

**Emitted by dashboard:**
- `get-status` - Request current agent status
- `get-messages` - Request recent messages

**Received from backend:**
- `status` - Agent status update
- `messages` - Recent messages list
- `new-message` - New message notification
- `connection-update` - WhatsApp connection state change

## Customization

### Theme Colors

The teal/cyan color scheme is configured in `app/globals.css`:

```css
--primary: 180 78% 42%;  /* Teal */
--accent: 180 78% 42%;   /* Teal */
```

To customize, modify the HSL values in the `:root` and `.dark` sections.

### Components

All UI components are in `components/ui/` and can be customized:
- `card.jsx` - Card containers
- `badge.jsx` - Status badges
- `button.jsx` - Action buttons
- `tabs.jsx` - Tab navigation

## Environment Variables

Create `.env.local` if needed:

```env
NEXT_PUBLIC_API_URL=http://localhost:3003
```

## Pages

### Dashboard (/)
- Real-time status indicators
- Active sessions count
- Message statistics
- Recent activity feed

### Conversations (/conversations)
- List of all conversations
- Filter by status (all/active/resolved)
- Message count and timestamps
- Real-time updates

### Settings (/settings)
- Agent configuration display
- Voice feature status
- AI model information
- API connection status

## Mobile Responsive

The dashboard is fully responsive with:
- Mobile-first design approach
- Responsive grid layouts
- Touch-friendly interactions
- Optimized navigation

## Deployment

For production deployment:

1. Build the dashboard:
```bash
npm run build
```

2. Start production server:
```bash
npm start
```

3. Or deploy to Vercel:
```bash
vercel deploy
```

## Integration with Main App

The main Express server at `src/index.js` includes:

```javascript
if (process.env.DASHBOARD_PORT) {
  setupDashboard(parseInt(process.env.DASHBOARD_PORT));
}
```

This allows the dashboard to run alongside the main agent application.
