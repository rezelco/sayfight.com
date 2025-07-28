'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import VoiceRacerDisplay from '@/components/VoiceRacerDisplay';
import TugOfWarDisplay from '@/components/TugOfWarDisplay';
import QRCode from 'react-qr-code';
import { wordDisplayMap } from '@/lib/phraseMappings';

const STORAGE_KEY = 'sayfight-host-room';

interface Player {
  id: string;
  name: string;
  connected?: boolean;
  ready?: boolean;
  hasMic?: boolean;
}

interface Command {
  playerId: string;
  playerName?: string;
  command: string;
  type: string;
  timestamp: Date;
}

interface TranscriptEvent {
  playerId: string;
  text: string;
  confidence: number;
  timestamp: Date;
}

interface GamePlayer {
  id: string;
  name: string;
  position?: { x: number; y: number };
}

interface GameState {
  mode: string;
  status: string;
  players: { [key: string]: GamePlayer };
  trackLength?: number;
  playerPositions?: { [key: string]: number };
  playerWords?: { [key: string]: string };
  teams?: {
    red: string[];
    blue: string[];
  };
  ropePosition?: number;
  winner?: string;
}

export default function HostPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<'waiting' | 'preparing' | 'playing' | 'finished'>('waiting');
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [recentCommands, setRecentCommands] = useState<Command[]>([]);
  const [recentTranscripts, setRecentTranscripts] = useState<TranscriptEvent[]>([]);
  const [currentGame, setCurrentGame] = useState<GameState | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [selectedGameMode, setSelectedGameMode] = useState<string>('voice_racer');
  // const [hostDisconnected, setHostDisconnected] = useState(false);
  const hasAttemptedReconnect = useRef(false);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    const newSocket = io(socketUrl, {
      timeout: 5000, // 5 second timeout for testing
      reconnectionDelay: 1000,
      reconnectionDelayMax: 3000
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      
      // Check for existing room in sessionStorage
      const storedRoom = sessionStorage.getItem(STORAGE_KEY);
      
      if (storedRoom && !hasAttemptedReconnect.current) {
        hasAttemptedReconnect.current = true;
        setIsReconnecting(true);
        console.log('Attempting to reconnect to room:', storedRoom);
        newSocket.emit('reconnectRoom', storedRoom);
      } else if (!storedRoom) {
        // Only create new room if no stored room exists
        newSocket.emit('createRoom');
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('roomCreated', (code: string) => {
      setRoomCode(code);
      sessionStorage.setItem(STORAGE_KEY, code);
      setIsReconnecting(false);
    });

    newSocket.on('roomReconnected', (data: { 
      roomCode: string; 
      players: Array<{ id: string; name: string; connected: boolean }>; 
      gameState: 'waiting' | 'playing' | 'finished' 
    }) => {
      console.log('Successfully reconnected to room:', data.roomCode);
      console.log('Players in room:', data.players);
      console.log('Game state:', data.gameState);
      setRoomCode(data.roomCode);
      setPlayers(data.players);
      
      // If the game was finished, reset to waiting state
      if (data.gameState === 'finished') {
        console.log('Game was finished, resetting to lobby');
        setGameState('waiting');
        setCurrentGame(null);
        setCountdown(null);
        setRecentCommands([]);
        // Notify server to reset game state
        newSocket.emit('returnToLobby', data.roomCode);
      } else {
        setGameState(data.gameState);
      }
      
      setIsReconnecting(false);
      sessionStorage.setItem(STORAGE_KEY, data.roomCode);
    });

    newSocket.on('roomNotFound', () => {
      console.log('Room not found, creating new room');
      sessionStorage.removeItem(STORAGE_KEY);
      setIsReconnecting(false);
      newSocket.emit('createRoom');
    });

    newSocket.on('playerJoined', (player: { id: string; name: string }) => {
      setPlayers(prev => [...prev, { ...player, connected: true }]);
    });

    newSocket.on('playerLeft', (playerId: string) => {
      setPlayers(prev => prev.filter(p => p.id !== playerId));
    });

    newSocket.on('playerRemoved', (playerId: string) => {
      setPlayers(prev => prev.filter(p => p.id !== playerId));
    });

    newSocket.on('playerDisconnected', (playerId: string) => {
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, connected: false } : p
      ));
    });

    newSocket.on('playerReconnected', (player: { id: string; name: string }) => {
      console.log('Player reconnected:', player.name);
      setPlayers(prev => prev.map(p => 
        p.id === player.id ? { ...p, connected: true } : p
      ));
    });

    newSocket.on('playerReadyStatus', ({ playerId, ready, hasMic }: { 
      playerId: string; 
      ready: boolean; 
      hasMic: boolean;
    }) => {
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, ready, hasMic } : p
      ));
    });

    newSocket.on('gameStarted', ({ gameMode }: { gameMode: string }) => {
      console.log('Game started event received on host, mode:', gameMode);
      setGameState('preparing');
      // Reset ready state for all players (but keep hasMic status)
      setPlayers(prev => prev.map(p => ({ ...p, ready: false })));
    });

    newSocket.on('allPlayersReady', () => {
      console.log('All players ready, game starting!');
      setGameState('playing');
    });
    
    // Game event handlers
    newSocket.on('gameCountdown', (count: number) => {
      console.log('Countdown:', count);
      setCountdown(count);
      if (count === 0) {
        setTimeout(() => setCountdown(null), 1000);
      }
    });
    
    newSocket.on('gameStateUpdate', (gameState: GameState) => {
      // Keep objects as objects (don't convert to Maps)
      setCurrentGame(gameState);
    });
    
    newSocket.on('gameEnded', (finalState: GameState) => {
      console.log('Game ended:', finalState);
      setGameState('finished');
      setCurrentGame(finalState);
    });


    newSocket.on('playerCommand', (command: Command) => {
      console.log('Received command:', command);
      setRecentCommands(prev => [{
        ...command,
        playerName: command.playerName || 'Unknown Player',
        timestamp: new Date(command.timestamp)
      }, ...prev.slice(0, 9)]);
    });

    newSocket.on('hostTranscript', (transcript: {
      playerId: string;
      playerName: string;
      text: string;
      confidence: number;
      timestamp: string | Date;
    }) => {
      console.log('Received transcript:', transcript);
      setRecentTranscripts(prev => [{
        playerId: transcript.playerId,
        text: transcript.text,
        confidence: transcript.confidence,
        timestamp: new Date(transcript.timestamp)
      }, ...prev.slice(0, 19)]); // Keep last 20 transcripts
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const startGame = () => {
    if (socket) {
      // Check player count based on game mode
      if (selectedGameMode === 'tug_of_war' && players.length % 2 !== 0) {
        alert('Tug of War requires an even number of players!');
        return;
      }
      
      if (players.length >= 1) {
        console.log('Sending startGame event for room:', roomCode, 'mode:', selectedGameMode);
        socket.emit('startGame', { roomCode, gameMode: selectedGameMode });
        // Don't set game state here - wait for server confirmation
      }
    }
  };

  const createNewRoom = () => {
    // Confirm if game is in progress
    if (gameState === 'playing') {
      if (!confirm('Are you sure you want to start a new session? This will end the current game.')) {
        return;
      }
    }
    
    if (socket && isConnected) {
      // Reset all state
      sessionStorage.removeItem(STORAGE_KEY);
      setRoomCode('');
      setPlayers([]);
      setGameState('waiting');
      setCurrentGame(null);
      setCountdown(null);
      setRecentCommands([]);
      setRecentTranscripts([]);
      // setHostDisconnected(false);
      
      // Leave current room if in one
      if (roomCode) {
        socket.emit('leaveRoom', roomCode);
      }
      
      // Create new room
      socket.emit('createRoom');
    }
  };

  const returnToLobby = () => {
    if (socket && roomCode) {
      console.log('Returning to lobby...');
      // Reset game state to waiting
      setGameState('waiting');
      setCurrentGame(null);
      setCountdown(null);
      setRecentCommands([]);
      setRecentTranscripts([]);
      // Reset player ready states
      setPlayers(prev => prev.map(p => ({ ...p, ready: false, hasMic: false })));
      // Notify server to reset game state
      socket.emit('returnToLobby', roomCode);
    }
  };

  const playAgain = () => {
    if (socket && roomCode) {
      console.log('Playing again with same mode...');
      socket.emit('startGame', { roomCode, gameMode: currentGame?.mode || selectedGameMode });
    }
  };

  const removePlayer = (playerId: string) => {
    if (socket && roomCode) {
      console.log('Removing offline player:', playerId);
      socket.emit('removePlayer', { roomCode, playerId });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900 text-white p-4 overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-48 -left-48 w-96 h-96 bg-pink-500/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-48 -right-48 w-96 h-96 bg-teal-500/30 rounded-full blur-3xl animate-pulse animation-delay-2000"></div>
      </div>
      
      <div className="relative max-w-7xl mx-auto h-screen flex flex-col">
        <header className="flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-black bg-gradient-to-r from-pink-400 to-yellow-400 bg-clip-text text-transparent">
              SayFight Host
            </h1>
            <div className="flex items-center gap-4">
              {roomCode && (
                <div className="text-2xl font-bold bg-gray-900/50 px-4 py-2 rounded-xl border border-white/10">
                  Room: <span className="text-yellow-400">{roomCode}</span>
                </div>
              )}
              {roomCode && (
                <button
                  onClick={createNewRoom}
                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-bold shadow-lg hover:shadow-red-500/25 transform hover:scale-105 transition-all duration-200"
                  title="Start a completely new session"
                >
                  🆕 New
                </button>
              )}
            </div>
          </div>
          {(!isConnected || isReconnecting) && (
            <div className="text-center mb-2">
              {!isConnected && (
                <p className="text-red-400 animate-pulse text-sm">🔌 Connecting to server...</p>
              )}
              {isReconnecting && (
                <p className="text-yellow-400 animate-pulse text-sm">🔄 Reconnecting to existing room...</p>
              )}
            </div>
          )}
        </header>

        {gameState === 'waiting' && (
          <div className="flex-1 overflow-hidden">
            {roomCode && (
              <div className="h-full grid lg:grid-cols-3 gap-4">
                {/* Join Info Section */}
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-violet-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
                  <div className="relative h-full bg-gray-900/90 backdrop-blur-xl rounded-2xl p-6 border border-white/10 flex flex-col">
                    <h2 className="text-xl font-bold mb-4 text-transparent bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text">
                      📱 Join Game
                    </h2>
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <div className="bg-white p-4 rounded-xl shadow-2xl mb-4">
                        <QRCode 
                          value={`${window.location.origin}/player?room=${roomCode}`}
                          size={150}
                          level="M"
                        />
                      </div>
                      <div className="bg-gray-800/50 rounded-xl p-3 w-full text-center">
                        <p className="text-sm text-gray-400 mb-1">Room Code</p>
                        <p className="text-3xl font-black tracking-wider text-yellow-400">{roomCode}</p>
                      </div>
                      <p className="text-sm text-gray-400 mt-3">
                        {window.location.origin}/player
                      </p>
                    </div>
                  </div>
                </div>

                {/* Players Section */}
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
                  <div className="relative h-full bg-gray-900/90 backdrop-blur-xl rounded-2xl p-6 border border-white/10 flex flex-col">
                    <h2 className="text-xl font-bold mb-4 text-transparent bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text">
                      👥 Players ({players.length})
                    </h2>
                    <div className="flex-1 overflow-y-auto">
                      {players.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center">
                          <p className="text-gray-400 animate-pulse mb-2">Waiting for players...</p>
                          <div className="text-4xl animate-bounce">👀</div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {players.map((player, index) => {
                            const avatars = ['🦄', '🐨', '🦊', '🐸', '🦁', '🐧', '🦋', '🐙'];
                            const avatar = avatars[index % avatars.length];
                            
                            return (
                              <div
                                key={player.id}
                                className={`bg-gray-800/50 backdrop-blur rounded-xl p-3 flex items-center gap-2 border border-white/5 ${
                                  player.connected === false ? 'opacity-50' : ''
                                }`}
                              >
                                <span className="text-2xl">{avatar}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold truncate">{player.name}</p>
                                  {player.connected === false && (
                                    <p className="text-xs text-red-400">📵 Offline</p>
                                  )}
                                </div>
                                {player.connected === false && (
                                  <button
                                    onClick={() => removePlayer(player.id)}
                                    className="p-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
                                    title="Remove offline player"
                                  >
                                    <span className="text-xs">❌</span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Game Selection Section */}
                <div className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
                  <div className="relative h-full bg-gray-900/90 backdrop-blur-xl rounded-2xl p-6 border border-white/10 flex flex-col">
                    <h2 className="text-xl font-bold mb-4 text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">
                      🎮 Game Mode
                    </h2>
                    <div className="flex-1 flex flex-col justify-center space-y-3">
                      <button
                        onClick={() => setSelectedGameMode('voice_racer')}
                        className={`group relative p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                          selectedGameMode === 'voice_racer' 
                            ? 'bg-gradient-to-br from-pink-500 to-rose-500 border-pink-400 shadow-lg shadow-pink-500/25' 
                            : 'bg-gray-800/50 border-gray-700 hover:border-pink-500/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">🏎️</span>
                          <div className="text-left">
                            <h3 className="font-bold">Voice Racer</h3>
                            <p className="text-sm opacity-75">Say words to race!</p>
                          </div>
                          {selectedGameMode === 'voice_racer' && (
                            <span className="ml-auto text-xl">✅</span>
                          )}
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setSelectedGameMode('tug_of_war')}
                        className={`group relative p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                          selectedGameMode === 'tug_of_war' 
                            ? 'bg-gradient-to-br from-teal-500 to-cyan-500 border-teal-400 shadow-lg shadow-teal-500/25' 
                            : 'bg-gray-800/50 border-gray-700 hover:border-teal-500/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">🪢</span>
                          <div className="text-left">
                            <h3 className="font-bold">Tug of War</h3>
                            <p className="text-sm opacity-75">Team vs team!</p>
                          </div>
                          {selectedGameMode === 'tug_of_war' && (
                            <span className="ml-auto text-xl">✅</span>
                          )}
                        </div>
                        {players.length > 0 && players.length % 2 !== 0 && (
                          <p className="text-xs text-yellow-400 mt-2 text-center">⚠️ Needs even players</p>
                        )}
                      </button>
                    </div>
                    
                    {players.length >= 1 && (
                      <button
                        onClick={startGame}
                        className="mt-4 group relative font-black text-lg text-white transform transition-all duration-300 hover:scale-105 animate-pulse hover:animate-none"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-400 rounded-xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl py-4 shadow-2xl">
                          <span className="flex items-center justify-center gap-2">
                            <span className="text-2xl">🚀</span>
                            Start Game!
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {gameState === 'preparing' && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="bg-gray-900/90 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl text-center max-w-2xl">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-4xl font-black text-transparent bg-gradient-to-r from-pink-400 to-yellow-400 bg-clip-text">
                  🏁 Waiting for Players
                </h2>
                <button
                  onClick={returnToLobby}
                  className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 rounded-xl text-white font-bold transition-all transform hover:scale-105 shadow-lg"
                >
                  ← Back
                </button>
              </div>
              
              <div className="mb-8">
                <p className="text-2xl mb-4">Players must click &quot;Ready&quot; to continue</p>
                <div className="text-3xl font-bold text-transparent bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text">
                  {players.filter(p => p.ready).length} / {players.length} Ready
                </div>
              </div>
              
              <div className="space-y-3">
                {players.map((player, index) => {
                  const avatars = ['🦄', '🐨', '🦊', '🐸', '🦁', '🐧', '🦋', '🐙'];
                  const avatar = avatars[index % avatars.length];
                  
                  return (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between bg-gray-800/50 backdrop-blur rounded-xl p-4 border ${
                        player.ready ? 'border-green-500/50' : 'border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{avatar}</span>
                        <span className="text-xl font-semibold">{player.name}</span>
                      </div>
                      <div className="text-2xl">
                        {player.ready ? (
                          player.hasMic ? '🎤✅' : '⚠️✅'
                        ) : (
                          '⏳'
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {players.some(p => p.ready && !p.hasMic) && (
                <div className="mt-6 bg-yellow-500/20 rounded-xl p-4 border border-yellow-500/50">
                  <p className="text-yellow-300">⚠️ Some players don&apos;t have microphone access</p>
                </div>
              )}
            </div>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="space-y-8">
            {/* Countdown overlay */}
            {countdown !== null && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-yellow-500 rounded-full blur-3xl opacity-75 animate-pulse"></div>
                  <div className="relative text-9xl font-black text-white animate-bounce">
                    {countdown === 0 ? (
                      <span className="text-transparent bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text">GO!</span>
                    ) : (
                      <span className="text-transparent bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text">{countdown}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="text-center">
              <h2 className="text-4xl font-black mb-8 text-transparent bg-gradient-to-r from-pink-400 to-yellow-400 bg-clip-text">
                🎮 Game On!
              </h2>
              
              {/* Game display */}
              {currentGame && currentGame.mode === 'voice_racer' ? (
                <VoiceRacerDisplay 
                  players={currentGame.players}
                  playerPositions={currentGame.playerPositions}
                  playerWords={currentGame.playerWords}
                  trackLength={currentGame.trackLength || 100}
                  onBackToLobby={returnToLobby}
                />
              ) : currentGame && currentGame.mode === 'tug_of_war' ? (
                <TugOfWarDisplay
                  players={currentGame.players}
                  teams={currentGame.teams || { red: [], blue: [] }}
                  playerWords={currentGame.playerWords || {}}
                  ropePosition={currentGame.ropePosition || 0}
                  onBackToLobby={returnToLobby}
                />
              ) : (
                <div className="bg-gray-800 rounded-lg p-8">
                  <p className="text-gray-400">Loading game...</p>
                </div>
              )}
            </div>
            
            {/* Voice activity panel */}
            <div className="bg-gray-900/50 backdrop-blur-xl rounded-3xl p-6 border border-white/10">
              <h3 className="text-2xl font-bold mb-4 text-transparent bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text">
                🎤 Voice Activity
              </h3>
              {recentCommands.length === 0 && recentTranscripts.length === 0 ? (
                <p className="text-gray-400 text-lg animate-pulse">🎵 Listening for voice commands...</p>
              ) : (
                <div className="space-y-3">
                  {recentCommands.map((cmd, idx) => {
                    const isNew = idx === 0;
                    // Find the player to get their assigned word
                    const player = players.find(p => p.name === cmd.playerName);
                    const playerId = player?.id || cmd.playerId;
                    const assignedWord = currentGame?.playerWords?.[playerId];
                    const expectedPhrase = assignedWord ? wordDisplayMap[assignedWord] : null;
                    
                    // Find recent transcripts for this command
                    const relatedTranscripts = recentTranscripts.filter(t => 
                      t.playerId === cmd.playerId && 
                      Math.abs(t.timestamp.getTime() - cmd.timestamp.getTime()) < 2000 // Within 2 seconds
                    );
                    
                    return (
                      <div 
                        key={idx} 
                        className={`bg-gray-800/50 backdrop-blur rounded-2xl p-4 transform transition-all duration-300 border border-white/5 ${
                          isNew ? 'scale-105 border-teal-500/50 shadow-lg shadow-teal-500/20' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">🗣️</span>
                              <span className="font-semibold">{cmd.playerName}</span>
                              <span className="text-gray-500">→</span>
                              <span className="font-bold text-transparent bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text">
                                &quot;{cmd.command}&quot;
                              </span>
                            </div>
                            {expectedPhrase && (
                              <div className="text-sm text-gray-400 ml-7">
                                Expected: <span className="text-green-400">&quot;{expectedPhrase}&quot;</span>
                              </div>
                            )}
                            {relatedTranscripts.length > 0 && (
                              <div className="text-sm text-gray-400 ml-7 mt-1">
                                Heard: <span className="text-blue-400">&quot;{relatedTranscripts[0].text}&quot;</span>
                              </div>
                            )}
                          </div>
                          <span className="text-gray-400 text-xs">
                            {cmd.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {gameState === 'finished' && (
          <div className="flex-1 overflow-y-auto text-center space-y-6 pb-8">
            {/* Confetti effect */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute animate-fall"
                  style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 3}s`,
                    animationDuration: `${3 + Math.random() * 2}s`
                  }}
                >
                  <span className="text-4xl">
                    {['🎆', '🎉', '✨', '🎇'][Math.floor(Math.random() * 4)]}
                  </span>
                </div>
              ))}
            </div>
            
            <h2 className="text-5xl font-black mb-6 text-transparent bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text animate-bounce">
              Game Over!
            </h2>
            
            {currentGame && currentGame.winner && (
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-3xl blur-2xl opacity-75 group-hover:opacity-100 transition-opacity animate-pulse"></div>
                <div className="relative bg-gray-900/90 backdrop-blur-xl rounded-3xl p-10 border-4 border-yellow-400/50">
                  <div className="text-6xl mb-4 animate-bounce">🏆</div>
                  <p className="text-3xl mb-4 font-bold text-yellow-400">Champion!</p>
                  <p className="text-5xl font-black text-white">
                    {currentGame.mode === 'tug_of_war' && currentGame.teams ? (
                      // For Tug of War, show team win
                      <span className={`text-transparent bg-gradient-to-r ${
                        currentGame.teams.red.includes(currentGame.winner) 
                          ? 'from-red-400 to-pink-400' 
                          : 'from-blue-400 to-cyan-400'
                      } bg-clip-text`}>
                        {currentGame.teams.red.includes(currentGame.winner) ? 'Red Team' : 'Blue Team'}
                      </span>
                    ) : (
                      currentGame.players[currentGame.winner]?.name || 'Unknown'
                    )}
                  </p>
                </div>
              </div>
            )}
            
            {/* Final game display */}
            {currentGame && currentGame.mode === 'voice_racer' ? (
              <VoiceRacerDisplay 
                players={currentGame.players}
                playerPositions={currentGame.playerPositions}
                playerWords={currentGame.playerWords}
                trackLength={currentGame.trackLength || 100}
              />
            ) : currentGame && currentGame.mode === 'tug_of_war' ? (
              <TugOfWarDisplay
                players={currentGame.players}
                teams={currentGame.teams || { red: [], blue: [] }}
                playerWords={currentGame.playerWords || {}}
                ropePosition={currentGame.ropePosition || 0}
              />
            ) : null}
            
            <div className="flex gap-4 justify-center mt-6 relative z-10">
              <button
                onClick={playAgain}
                className="group relative px-6 py-3 font-bold text-lg text-white transform transition-all duration-200 hover:scale-105"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-400 rounded-xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl px-6 py-3 shadow-2xl flex items-center gap-2">
                  <span className="text-xl">🔁</span>
                  Play Again
                </div>
              </button>
              <button
                onClick={returnToLobby}
                className="group relative px-6 py-3 font-bold text-lg text-white transform transition-all duration-200 hover:scale-105"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-violet-400 to-purple-400 rounded-xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl px-6 py-3 shadow-2xl flex items-center gap-2">
                  <span className="text-xl">🏠</span>
                  Back to Lobby
                </div>
              </button>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}