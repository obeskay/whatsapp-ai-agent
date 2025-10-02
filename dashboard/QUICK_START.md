# Dashboard Quick Start Guide

Get the WhatsApp AI Agent Dashboard running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- WhatsApp AI Agent backend running on port 3003
- Terminal access

## Installation (One-time)

```bash
# Navigate to dashboard directory
cd dashboard

# Run setup script (installs dependencies)
./setup.sh

# Alternative: Manual install
npm install
```

## Development

```bash
# Start development server
npm run dev

# Dashboard available at:
# http://localhost:3004
```

## Production

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Verification

### 1. Check Backend is Running
```bash
curl http://localhost:3003/health
# Should return: {"status":"ok",...}
```

### 2. Open Dashboard
Visit: http://localhost:3004

### 3. Verify Real-time Connection
Open browser console (F12), look for:
```
Connected to backend
```

## Quick Fixes

### Port Already in Use
```bash
# Change port in package.json
"dev": "next dev -p 3005"  # Use different port
```

### Can't Connect to Backend
```bash
# Check .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:3003" > .env.local
```

### Styling Issues
```bash
# Restart dev server
# Ctrl+C to stop
npm run dev
```

## File Structure

```
dashboard/
├── app/              # Pages
│   ├── page.jsx      # Dashboard home
│   ├── conversations/ # Conversations page
│   └── settings/     # Settings page
├── components/       # UI components
└── lib/              # Utilities
```

## URLs

- **Dashboard Home**: http://localhost:3004/
- **Conversations**: http://localhost:3004/conversations
- **Settings**: http://localhost:3004/settings
- **Backend API**: http://localhost:3003/health

## Environment Variables

Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3003
```

## Common Commands

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Production build
npm run build

# Start production
npm start

# Lint code
npm run lint
```

## Troubleshooting

**Issue**: Dashboard won't start
**Fix**:
```bash
rm -rf node_modules .next
npm install
```

**Issue**: No real-time updates
**Fix**: Check backend is running and Socket.IO is enabled

**Issue**: Styling broken
**Fix**: Clear .next folder and restart

## Support

See full documentation:
- `README.md` - Complete guide
- `INTEGRATION.md` - Backend integration
- Main app README - Overall system docs

## Development Tips

1. **Hot Reload**: Changes auto-reload in dev mode
2. **Console**: Check browser console for errors (F12)
3. **Network**: Monitor WebSocket in DevTools Network tab
4. **Components**: Edit files in `components/ui/` to customize

## Next Steps

1. ✅ Install dependencies (`npm install`)
2. ✅ Start dashboard (`npm run dev`)
3. ✅ Verify connection (check browser console)
4. 🎨 Customize theme (edit `app/globals.css`)
5. 📊 Add features (extend pages in `app/`)

Happy monitoring! 🚀
