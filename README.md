# 🎮 SayFight - Voice-Controlled Party Game

A hilarious multiplayer party game where players control their characters using voice commands! Built for the AssemblyAI hackathon, SayFight brings the chaos and fun of games like Jackbox to voice-controlled gaming.

## 🎯 Overview

SayFight is a real-time multiplayer game where players join a shared room and compete in various mini-games using only their voice. Players shout absurd phrases like "pandas hack wifi" or "dolphins bake cookies" to control their characters and compete for victory!

### Game Modes

- **🏎️ Voice Racer**: Race to the finish line by saying your assigned animal phrase. The more of the phrase you say, the faster you go!
- **🪢 Tug of War**: Teams compete by shouting their unique phrases to pull the rope to their side.
- *More game modes coming soon!*

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router) with TypeScript, Tailwind CSS + shadcn/ui
- **Backend**: Node.js + TypeScript with Socket.io for real-time multiplayer
- **Voice Recognition**: AssemblyAI's Universal Streaming API for low-latency transcription
- **Audio Pipeline**: Web Audio API → Socket.io binary transport → AssemblyAI WebSocket
- **Game Engine**: Custom 60 FPS game loop with authoritative server

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x or higher
- npm or yarn
- AssemblyAI API key ([get one free](https://www.assemblyai.com/dashboard))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/sayfight.git
   cd sayfight
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create `backend/.env`:
   ```env
   ASSEMBLYAI_API_KEY=your_api_key_here
   PORT=3001
   NODE_ENV=development
   ```

   Create `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_WS_URL=http://localhost:3001
   ```

4. **Start the development servers**
   ```bash
   # Terminal 1 - Backend
   npm run server

   # Terminal 2 - Frontend  
   npm run dev
   ```

5. **Open http://localhost:3000 in your browser**

## 🎮 How to Play

1. **Host** creates a room and shares the 4-letter room code
2. **Players** join using the room code on their devices
3. **Everyone** grants microphone permissions
4. **Host** selects a game mode and starts the game
5. **Players** see their assigned phrase and shout it to control their character
6. **Have fun** and embrace the chaos!

### Pro Tips
- Say the complete phrase for 2x speed boost!
- Partial phrases (2 out of 3 words) give 1.5x boost
- Just the trigger word gives normal speed
- The host screen shows what was heard vs. what was expected

## 🔧 Development

### Project Structure
```
sayfight/
├── frontend/          # Next.js frontend application
│   ├── app/          # App router pages
│   ├── components/   # React components
│   └── lib/          # Shared utilities
├── backend/          # Node.js backend server
│   ├── src/
│   │   ├── services/ # Game logic, transcription, rooms
│   │   └── types/    # TypeScript types
│   └── dist/         # Compiled output
└── README.md
```

### Available Scripts

- `npm run dev` - Start frontend development server
- `npm run server` - Start backend development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript compiler checks

### Debug Features

The host screen includes powerful debugging tools:
- Real-time transcription display
- Shows expected phrase vs. actual transcription
- Player connection status
- Voice activity monitoring

## 🚀 Deployment

### Environment Variables for Production

Set these environment variables in your production environment:

```env
# Backend
NODE_ENV=production
ASSEMBLYAI_API_KEY=your_api_key_here
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
PORT=3001

# Frontend
NEXT_PUBLIC_WS_URL=wss://your-backend-domain.com
```

### Security Notes

- The `/health` endpoint returns only `{ status: 'ok' }` in production
- Development endpoints (`/health-detailed`, `/api/transcription-status`, `/test-audio`) are automatically disabled when `NODE_ENV=production`
- CORS is restricted to specified origins in production
- Rate limiting prevents room creation spam and oversized audio uploads

### Deployment Platforms

- **Frontend**: Vercel, Netlify, or any static hosting
- **Backend**: Railway, Heroku, AWS, or any Node.js host with WebSocket support

## 🎯 Features

- **Real-time multiplayer** with Socket.io
- **Low-latency voice recognition** (~300-400ms command latency)
- **100 unique absurd phrases** to keep gameplay fresh
- **Automatic reconnection** if players disconnect
- **Host migration** support
- **Mobile-friendly** responsive design
- **Debug mode** for troubleshooting

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the [AssemblyAI Hackathon](https://assemblyai.com)
- Inspired by party games like Jackbox Games
- Thanks to AssemblyAI for the amazing Universal Streaming API

## 🐛 Troubleshooting

### No transcripts appearing?
1. Check that your AssemblyAI API key is correctly set in `backend/.env`
2. Ensure microphone permissions are granted in your browser
3. Check the browser console and backend logs for errors
4. Verify your API key is active and has available credits

### Connection issues?
1. Ensure both frontend and backend servers are running
2. Check that WebSocket connections are allowed by your firewall
3. Verify the `NEXT_PUBLIC_WS_URL` matches your backend address

### Audio not working?
1. Use Chrome, Firefox, or Safari (latest versions)
2. Ensure your microphone isn't being used by another application
3. Check that your browser has microphone permissions
4. Try refreshing the page and granting permissions again

---

Made with ❤️ and 🎤 for the AssemblyAI Hackathon