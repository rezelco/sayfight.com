import React from 'react';
import { wordDisplayMap } from '@/lib/phraseMappings';

interface GamePlayer {
  id: string;
  name: string;
  position?: { x: number; y: number };
}

interface TugOfWarDisplayProps {
  players: { [key: string]: GamePlayer };
  teams: {
    red: string[];
    blue: string[];
  };
  playerWords: { [key: string]: string };
  ropePosition: number; // -100 to 100
  onBackToLobby?: () => void;
}


export default function TugOfWarDisplay({ players, teams, playerWords, ropePosition, onBackToLobby }: TugOfWarDisplayProps) {
  // Get player objects for each team
  const redTeamPlayers = teams.red.map(id => players[id]).filter(Boolean);
  const blueTeamPlayers = teams.blue.map(id => players[id]).filter(Boolean);
  
  // Calculate rope marker position (convert -100 to 100 range to 0% to 100%)
  const markerPosition = ((ropePosition + 100) / 200) * 100;
  
  // Determine if either team is close to winning
  const redCloseToWin = ropePosition <= -60;
  const blueCloseToWin = ropePosition >= 60;
  
  return (
    <div className="w-full bg-gradient-to-br from-purple-900/50 to-pink-900/50 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-3xl font-black text-transparent bg-gradient-to-r from-red-400 to-blue-400 bg-clip-text">
          🪢 Tug of War Championship
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
      
      {/* Team Display */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* Red Team */}
        <div className={`relative group transform transition-all duration-300 ${redCloseToWin ? 'scale-105' : ''}`}>
          <div className={`absolute inset-0 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl blur-xl opacity-50 ${redCloseToWin ? 'opacity-75 animate-pulse' : ''}`}></div>
          <div className="relative bg-gray-900/70 backdrop-blur rounded-2xl p-6 border-2 border-red-500/50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-2xl font-black text-red-400">Red Team</h4>
              <span className="text-4xl">🔴</span>
            </div>
            
            <div className="space-y-2">
              {redTeamPlayers.map(player => {
                const word = playerWords[player.id] || '';
                const fullPhrase = word ? (wordDisplayMap[word.toLowerCase()] || word) : '';
                return (
                  <div key={player.id} className="bg-red-900/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">💪</span>
                      <span className="text-white font-semibold">{player.name}</span>
                    </div>
                    {fullPhrase && (
                      <div className="ml-7 text-sm text-red-300">
                        Say: <span className="font-bold">&quot;{fullPhrase}&quot;</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Blue Team */}
        <div className={`relative group transform transition-all duration-300 ${blueCloseToWin ? 'scale-105' : ''}`}>
          <div className={`absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl blur-xl opacity-50 ${blueCloseToWin ? 'opacity-75 animate-pulse' : ''}`}></div>
          <div className="relative bg-gray-900/70 backdrop-blur rounded-2xl p-6 border-2 border-blue-500/50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-2xl font-black text-blue-400">Blue Team</h4>
              <span className="text-4xl">🔵</span>
            </div>
            
            <div className="space-y-2">
              {blueTeamPlayers.map(player => {
                const word = playerWords[player.id] || '';
                const fullPhrase = word ? (wordDisplayMap[word.toLowerCase()] || word) : '';
                return (
                  <div key={player.id} className="bg-blue-900/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">💪</span>
                      <span className="text-white font-semibold">{player.name}</span>
                    </div>
                    {fullPhrase && (
                      <div className="ml-7 text-sm text-blue-300">
                        Say: <span className="font-bold">&quot;{fullPhrase}&quot;</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* Rope Display */}
      <div className="relative h-40 bg-gradient-to-b from-gray-900/50 to-gray-800/50 rounded-2xl overflow-hidden border border-white/10">
        {/* Crowd background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 text-6xl animate-bounce" style={{ animationDelay: '0s' }}>👥</div>
          <div className="absolute top-4 left-20 text-5xl animate-bounce" style={{ animationDelay: '0.5s' }}>👥</div>
          <div className="absolute top-0 right-0 text-6xl animate-bounce" style={{ animationDelay: '1s' }}>👥</div>
          <div className="absolute top-4 right-20 text-5xl animate-bounce" style={{ animationDelay: '1.5s' }}>👥</div>
        </div>
        
        {/* Win Zones */}
        <div className="absolute left-0 top-0 bottom-0 w-1/5 bg-gradient-to-r from-red-900/40 to-transparent border-r-4 border-red-600">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-red-400 font-black text-xl transform -rotate-12 opacity-75">RED WINS!</span>
          </div>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/5 bg-gradient-to-l from-blue-900/40 to-transparent border-l-4 border-blue-600">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-blue-400 font-black text-xl transform rotate-12 opacity-75">BLUE WINS!</span>
          </div>
        </div>
        
        {/* Center Line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-yellow-400 to-orange-400 opacity-50"></div>
        
        {/* Ground */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-green-900/50 to-transparent"></div>
        
        {/* Rope */}
        <div className="absolute top-1/2 left-0 right-0 h-12 -translate-y-1/2">
          {/* Rope shadow */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/30 blur-sm"></div>
          
          {/* Main rope */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-yellow-700 via-yellow-600 to-yellow-800 shadow-lg">
            {/* Rope texture */}
            <div className="absolute inset-0 opacity-50" style={{
              backgroundImage: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 3px,
                rgba(0,0,0,0.1) 3px,
                rgba(0,0,0,0.1) 6px
              )`
            }}></div>
          </div>
          
          {/* Rope Marker/Knot */}
          <div 
            className="absolute top-1/2 w-20 h-20 -translate-y-1/2 -translate-x-1/2 transition-all duration-300 ease-out"
            style={{ left: `${markerPosition}%` }}
          >
            <div className="relative w-full h-full">
              {/* Knot glow */}
              <div className={`absolute inset-0 rounded-full blur-xl animate-pulse ${
                ropePosition < 0 ? 'bg-red-400' : 'bg-blue-400'
              } opacity-50`}></div>
              
              {/* Main knot */}
              <div className="relative w-full h-full bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full border-4 border-yellow-700 shadow-2xl flex items-center justify-center transform hover:scale-110 transition-transform">
                <span className="text-4xl">⚡</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Force Indicators */}
        {ropePosition !== 0 && (
          <>
            <div className="absolute top-1/2 left-1/4 -translate-y-1/2 -translate-x-1/2">
              {ropePosition < 0 && (
                <div className="flex items-center gap-2 animate-pulse">
                  <span className="text-4xl text-red-400">←</span>
                  <span className="text-4xl text-red-400">←</span>
                  <span className="text-4xl text-red-400">←</span>
                </div>
              )}
            </div>
            <div className="absolute top-1/2 right-1/4 -translate-y-1/2 translate-x-1/2">
              {ropePosition > 0 && (
                <div className="flex items-center gap-2 animate-pulse">
                  <span className="text-4xl text-blue-400">→</span>
                  <span className="text-4xl text-blue-400">→</span>
                  <span className="text-4xl text-blue-400">→</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Game Status */}
      <div className="mt-6 text-center">
        <div className="bg-gray-900/50 rounded-2xl p-4 border border-white/10">
          {ropePosition === 0 && (
            <p className="text-xl font-bold text-gray-300">⚖️ Perfectly balanced - Pull harder!</p>
          )}
          {ropePosition < 0 && (
            <p className="text-xl font-bold text-transparent bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text">
              🔴 Red team is winning! Pull strength: {Math.abs(ropePosition).toFixed(0)}%
            </p>
          )}
          {ropePosition > 0 && (
            <p className="text-xl font-bold text-transparent bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text">
              🔵 Blue team is winning! Pull strength: {ropePosition.toFixed(0)}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
}