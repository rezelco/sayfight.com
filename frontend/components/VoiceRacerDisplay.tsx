import React, { useState, useEffect } from 'react';
import CarIcon from './CarIcon';
import { wordDisplayMap } from '@/lib/phraseMappings';

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
  onBackToLobby?: () => void;
}

const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#DDA0DD'];


export default function VoiceRacerDisplay({ players, playerPositions, playerWords, trackLength, onBackToLobby }: VoiceRacerDisplayProps) {
  const playerArray = Object.values(players);
  const [previousPositions, setPreviousPositions] = useState<{ [key: string]: number }>({});
  const [carDirections, setCarDirections] = useState<{ [key: string]: boolean }>({});
  
  // Track car movement direction
  useEffect(() => {
    if (playerPositions) {
      const newDirections: { [key: string]: boolean } = {};
      
      Object.entries(playerPositions).forEach(([playerId, position]) => {
        const prevPos = previousPositions[playerId] || 0;
        // Car faces left if moving backwards (position decreased)
        newDirections[playerId] = position < prevPos;
      });
      
      setCarDirections(newDirections);
      setPreviousPositions({ ...playerPositions });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerPositions]);
  
  return (
    <div className="w-full bg-gradient-to-br from-purple-900/50 to-pink-900/50 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-3xl font-black text-transparent bg-gradient-to-r from-pink-400 to-yellow-400 bg-clip-text">
          🏎️ Voice Racer Championship
        </h3>
        {onBackToLobby && (
          <button
            onClick={onBackToLobby}
            className="px-6 py-2 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 rounded-2xl text-white font-bold transition-all transform hover:scale-105 shadow-lg"
          >
            ← Back to Lobby
          </button>
        )}
      </div>
      
      {/* Race Track */}
      <div className="space-y-6">
        {playerArray.map((player, index) => {
          const position = playerPositions?.[player.id] || 0;
          const percentage = (position / trackLength) * 100;
          const color = colors[index % colors.length];
          const word = playerWords?.[player.id] || 'go';
          const displayWord = wordDisplayMap[word.toLowerCase()] || word;
          const facingLeft = carDirections[player.id] || false;
          
          return (
            <div key={player.id} className="relative group">
              {/* Player info */}
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-6 flex items-center justify-center">
                    <CarIcon color={color} size={36} facingLeft={facingLeft} />
                  </div>
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
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-3 bg-black/30 rounded-full blur-sm" />
                    {/* Car with custom color */}
                    <div className="transform group-hover:scale-110 transition-transform">
                      <CarIcon 
                        color={color} 
                        size={48} 
                        facingLeft={facingLeft}
                        className="filter drop-shadow-lg"
                      />
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
      
    </div>
  );
}