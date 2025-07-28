import React from 'react';

interface GamePlayer {
  id: string;
  name: string;
  position?: { x: number; y: number };
}

interface VoiceRacerDisplayProps {
  players: { [key: string]: GamePlayer };
  playerPositions?: { [key: string]: number };
  playerWords?: { [key: string]: string };
  trackLength: number;
}

const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#DDA0DD'];

// Mapping of single words to two-word phrases for better voice recognition
const wordDisplayMap: { [key: string]: string } = {
  'go': 'go now',
  'run': 'run fast',
  'fast': 'fast car',
  'zoom': 'zoom in',
  'dash': 'dash it',
  'rush': 'rush up',
  'move': 'move it',
  'race': 'race me',
  'speed': 'speed up',
  'quick': 'quick go',
  'fly': 'fly by',
  'jet': 'jet go',
  'bolt': 'bolt up',
  'zip': 'zip it',
  'push': 'push it',
  'drive': 'drive on',
  'boost': 'boost me',
  'gas': 'gas it',
  'win': 'win it',
  'jump': 'jump up',
  'ride': 'ride on',
  'roll': 'roll it',
  'spin': 'spin it',
  'drift': 'drift by'
};

export default function VoiceRacerDisplay({ players, playerPositions, playerWords, trackLength }: VoiceRacerDisplayProps) {
  const playerArray = Object.values(players);
  
  return (
    <div className="w-full bg-gradient-to-br from-purple-900/50 to-pink-900/50 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">
      <h3 className="text-3xl font-black mb-6 text-transparent bg-gradient-to-r from-pink-400 to-yellow-400 bg-clip-text text-center">
        🏎️ Voice Racer Championship
      </h3>
      
      {/* Race Track */}
      <div className="space-y-6">
        {playerArray.map((player, index) => {
          const position = playerPositions?.[player.id] || 0;
          const percentage = (position / trackLength) * 100;
          const color = colors[index % colors.length];
          const word = playerWords?.[player.id] || 'go';
          const displayWord = wordDisplayMap[word.toLowerCase()] || word;
          const carEmojis = ['🏎️', '🚗', '🚙', '🚕', '🚎', '🚐'];
          const carEmoji = carEmojis[index % carEmojis.length];
          
          return (
            <div key={player.id} className="relative group">
              {/* Player info */}
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{carEmoji}</span>
                  <span className="text-white font-bold text-lg">{player.name}</span>
                </div>
                <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full px-4 py-1">
                  <span className="text-sm font-black text-gray-900">&quot;{displayWord}&quot;</span>
                </div>
              </div>
              
              {/* Track */}
              <div className="relative h-16 rounded-2xl overflow-hidden shadow-inner bg-gray-900/50">
                {/* Track texture */}
                <div className="absolute inset-0 opacity-20">
                  <div className="h-full bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800" />
                  <div 
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `repeating-linear-gradient(
                        90deg,
                        transparent,
                        transparent 10px,
                        rgba(255,255,255,0.1) 10px,
                        rgba(255,255,255,0.1) 20px
                      )`
                    }}
                  />
                </div>
                
                {/* Progress trail */}
                <div 
                  className="absolute top-0 left-0 h-full transition-all duration-300 ease-out opacity-80"
                  style={{ 
                    width: `${percentage}%`,
                    background: `linear-gradient(90deg, ${color}40 0%, ${color} 100%)`,
                    boxShadow: `0 0 20px ${color}50`
                  }}
                />
                
                {/* Speed effect */}
                {percentage > 0 && percentage < 100 && (
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 h-1 bg-gradient-to-l from-transparent to-white opacity-50"
                    style={{ 
                      left: `${Math.max(0, percentage - 10)}%`,
                      width: `${Math.min(10, percentage)}%`
                    }}
                  />
                )}
                
                {/* Car */}
                <div 
                  className="absolute top-1/2 transform -translate-y-1/2 transition-all duration-300 ease-out"
                  style={{ 
                    left: `${Math.min(percentage, 94)}%`
                  }}
                >
                  <div className="relative">
                    {/* Car shadow */}
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/30 rounded-full blur-sm" />
                    {/* Car emoji */}
                    <div className="text-4xl filter drop-shadow-lg transform group-hover:scale-110 transition-transform">
                      {carEmoji}
                    </div>
                  </div>
                </div>
                
                {/* Finish line */}
                <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-transparent to-white/10" />
                <div className="absolute right-0 top-0 bottom-0 w-6 bg-checkered opacity-50" />
                <div className="absolute right-6 top-0 bottom-0 flex items-center">
                  <span className="text-2xl">🏁</span>
                </div>
              </div>
              
              {/* Progress indicator */}
              <div className="flex justify-between items-center mt-2">
                <div className="text-sm text-gray-400">
                  Progress: <span className="text-white font-bold">{percentage.toFixed(0)}%</span>
                </div>
                <div className="text-sm text-gray-400">
                  Position: <span className="text-white font-bold">{position.toFixed(1)}m</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Race Stats */}
      <div className="mt-6 bg-gray-900/50 rounded-2xl p-4 border border-white/10">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-gray-400 text-sm">Track Length</p>
            <p className="text-white font-bold text-lg">{trackLength}m</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Players Racing</p>
            <p className="text-white font-bold text-lg">{playerArray.length}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Leader</p>
            <p className="text-white font-bold text-lg">
              {playerArray.reduce((leader, player) => {
                const pos = playerPositions?.[player.id] || 0;
                const leaderPos = playerPositions?.[leader.id] || 0;
                return pos > leaderPos ? player : leader;
              }, playerArray[0])?.name || '-'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Styles for checkered pattern */}
      <style jsx>{`
        .bg-checkered {
          background-image: repeating-linear-gradient(
            45deg,
            #000,
            #000 5px,
            #fff 5px,
            #fff 10px
          );
        }
        @keyframes speed-lines {
          0% { transform: translateX(0); }
          100% { transform: translateX(-20px); }
        }
      `}</style>
    </div>
  );
}