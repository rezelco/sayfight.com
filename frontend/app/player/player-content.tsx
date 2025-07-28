'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSearchParams } from 'next/navigation';
import { wordDisplayMap } from '@/lib/phraseMappings';

const STORAGE_KEY = 'sayfight-player-session';

interface PlayerSession {
  roomCode: string;
  playerName: string;
  playerId: string;
}

export default function PlayerContent() {
  const searchParams = useSearchParams();
  const roomFromUrl = searchParams.get('room');
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomCode, setRoomCode] = useState(roomFromUrl?.toUpperCase() || '');
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [gameState, setGameState] = useState<'waiting' | 'preparing' | 'playing' | 'finished'>('waiting');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [micPermissionStatus, setMicPermissionStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');
  // const [hostDisconnected, setHostDisconnected] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcripts, setTranscripts] = useState<Array<{text: string, confidence: number, timestamp: string}>>([]);
  const [showDebug, setShowDebug] = useState(true);
  const [transcriptionStatus, setTranscriptionStatus] = useState<'unknown' | 'active' | 'error' | 'not_configured'>('unknown');
  const [transcriptionError, setTranscriptionError] = useState<string>('');
  const [playerWord, setPlayerWord] = useState<string>('');
  const [gameMode, setGameMode] = useState<string>('');
  const [playerTeam, setPlayerTeam] = useState<'red' | 'blue' | null>(null);
  const [teamWord, setTeamWord] = useState<string>('');
  
  // wordDisplayMap is now imported from @/lib/phraseMappings
  
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const socketRef = useRef<Socket | null>(null);
  const playerIdRef = useRef<string>('');
  const micPermissionStatusRef = useRef<'pending' | 'granted' | 'denied'>('pending');

  const addDebug = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => [`${timestamp}: ${message}`, ...prev.slice(0, 9)]);
    console.log(`[Player Debug] ${message}`);
  };

  // Initialize from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('Checking sessionStorage on mount...');
      const storedSession = sessionStorage.getItem(STORAGE_KEY);
      console.log('StorageKey:', STORAGE_KEY);
      console.log('Stored session:', storedSession);
      if (storedSession) {
        try {
          const session: PlayerSession = JSON.parse(storedSession);
          console.log('Found stored session on mount:', session);
          setIsReconnecting(true);
        } catch (e) {
          console.error('Failed to parse stored session:', e);
          sessionStorage.removeItem(STORAGE_KEY);
        }
      } else {
        console.log('No stored session found');
      }
    }
  }, []);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    const newSocket = io(socketUrl, {
      timeout: 5000, // 5 second timeout for testing
      reconnectionDelay: 1000,
      reconnectionDelayMax: 3000
    });

    const handleConnect = () => {
      console.log('Connected to server');
      setIsConnected(true);
      addDebug('Connected to server');
      
      if (typeof window !== 'undefined') {
        const storedSession = sessionStorage.getItem(STORAGE_KEY);
        
        if (storedSession && !isJoined) {
          try {
            const session: PlayerSession = JSON.parse(storedSession);
            console.log('Attempting to reconnect with stored session:', session);
            setIsReconnecting(true);
            newSocket.emit('reconnectPlayer', { 
              roomCode: session.roomCode, 
              playerId: session.playerId 
            });
          } catch (e) {
            console.error('Failed to parse stored session:', e);
            sessionStorage.removeItem(STORAGE_KEY);
            setIsReconnecting(false);
          }
        }
      }
    };

    newSocket.on('connect', handleConnect);

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
      addDebug('Disconnected from server');
    });

    newSocket.on('joinedRoom', ({ playerId: id, playerName: name, roomCode: code }: { 
      playerId: string; 
      playerName: string; 
      roomCode: string 
    }) => {
      console.log('Successfully joined room:', code, 'as', name, 'with ID:', id);
      setPlayerId(id);
      playerIdRef.current = id;
      setIsJoined(true);
      setRoomCode(code);
      setPlayerName(name);
      setError('');
      addDebug(`Joined room ${code} as ${name}`);
      
      // Store session info
      const session: PlayerSession = { roomCode: code, playerName: name, playerId: id };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      console.log('Stored session:', session);
    });

    newSocket.on('playerReconnected', ({ playerId: id, playerName: name, roomCode: code }: { 
      playerId: string; 
      playerName: string; 
      roomCode: string 
    }) => {
      console.log('Successfully reconnected to room:', code);
      setPlayerId(id);
      playerIdRef.current = id;
      setIsJoined(true);
      setRoomCode(code);
      setPlayerName(name);
      setError('');
      setIsReconnecting(false);
      addDebug(`Reconnected to room ${code}`);
    });

    newSocket.on('reconnectFailed', (message: string) => {
      console.log('Reconnection failed:', message);
      setError(message);
      setIsReconnecting(false);
      sessionStorage.removeItem(STORAGE_KEY);
      addDebug(`Reconnection failed: ${message}`);
    });

    newSocket.on('error', (message: string) => {
      setError(message);
      addDebug(`Error: ${message}`);
    });

    newSocket.on('gameStarted', () => {
      console.log('Game started event received on player side');
      setGameState('preparing');
      // Only reset ready state, preserve mic permission and stream
      setIsReady(false);
      // Stop recording but keep the stream
      if (isRecordingRef.current) {
        stopAudioCapture(true); // true = keep stream
      }
      addDebug('Game starting - waiting for all players...');
    });

    newSocket.on('allPlayersReady', () => {
      console.log('All players ready, game starting!');
      setGameState('playing');
      addDebug('All players ready! Game starting...');
      
      // Auto-start audio capture if we have mic permission
      console.log('[AUDIO] Checking auto-start conditions:', {
        micPermission: micPermissionStatusRef.current,
        isRecording: isRecordingRef.current,
        hasStream: !!mediaStreamRef.current
      });
      
      if (micPermissionStatusRef.current === 'granted' && !isRecordingRef.current) {
        console.log('[AUDIO] Auto-starting audio capture...');
        setTimeout(() => {
          startAudioCapture();
        }, 100);
      } else {
        console.log('[AUDIO] Not auto-starting:', {
          reason: micPermissionStatusRef.current !== 'granted' ? 'No mic permission' : 'Already recording'
        });
      }
    });

    newSocket.on('gameEnded', () => {
      setGameState('finished');
    });

    // Handle host returning to lobby
    newSocket.on('returnedToLobby', () => {
      console.log('Host returned to lobby');
      setGameState('waiting');
      setGameMode('');
      setPlayerWord('');
      setPlayerTeam(null);
      setTeamWord('');
      setTranscripts([]);
      setIsReady(false);
      stopAudioCapture();
      addDebug('Game ended - returned to lobby');
    });

    newSocket.on('hostDisconnected', () => {
      // Only show final disconnection after grace period
      setError('Host has disconnected. Please join a new room.');
      setIsJoined(false);
      setGameState('waiting');
      // setHostDisconnected(true);
      sessionStorage.removeItem(STORAGE_KEY);
    });

    newSocket.on('roomClosed', () => {
      // Host closed the room to start a new one
      setError('The host has started a new game. Please join a new room.');
      setIsJoined(false);
      setGameState('waiting');
      sessionStorage.removeItem(STORAGE_KEY);
      stopAudioCapture();
      addDebug('Host started a new game');
    });

    newSocket.on('removedFromRoom', ({ message }: { message: string }) => {
      // Host removed this player from the room
      setError(message);
      setIsJoined(false);
      setGameState('waiting');
      sessionStorage.removeItem(STORAGE_KEY);
      stopAudioCapture();
      addDebug('Removed from room by host');
      // Reset all player state
      setPlayerId('');
      setPlayerName('');
      setRoomCode('');
      setIsReady(false);
    });

    // Add handler to detect host reconnection via game state updates
    newSocket.on('gameStateUpdate', (gameState: { 
      mode?: string; 
      playerWords?: { [key: string]: string };
      teams?: { red: string[]; blue: string[] };
    }) => {
      // If we get a game state update, host must be connected
      // setHostDisconnected(false);
      
      setGameMode(gameState.mode || '');
      
      // Extract player's word if it's Voice Racer
      if (gameState.mode === 'voice_racer' && gameState.playerWords) {
        const currentPlayerId = playerIdRef.current;
        const word = gameState.playerWords[currentPlayerId] || '';
        if (word) {
          setPlayerWord(word);
          const fullPhrase = wordDisplayMap[word.toLowerCase()] || word;
          addDebug(`Your word is: "${word}" (say "${fullPhrase}")`);
        } else {
          addDebug(`No word found for player ${currentPlayerId} in ${JSON.stringify(gameState.playerWords)}`);
        }
      }
      
      // Handle Tug of War team and word assignment
      if (gameState.mode === 'tug_of_war' && gameState.teams && gameState.playerWords) {
        const currentPlayerId = playerIdRef.current;
        
        // Set team
        if (gameState.teams.red.includes(currentPlayerId)) {
          setPlayerTeam('red');
          addDebug(`You are on RED team!`);
        } else if (gameState.teams.blue.includes(currentPlayerId)) {
          setPlayerTeam('blue');
          addDebug(`You are on BLUE team!`);
        }
        
        // Set word
        const word = gameState.playerWords[currentPlayerId] || '';
        if (word) {
          setTeamWord(word);
          const fullPhrase = wordDisplayMap[word.toLowerCase()] || word;
          addDebug(`Your word is: "${word}" (say "${fullPhrase}")`);
        }
      }
    });

    newSocket.on('playerCommand', (command: { playerId: string; command: string; confidence: number }) => {
      // Commands are relayed by host, so this means host is connected
      // setHostDisconnected(false);
      
      // If this is our command, add it to debug transcripts
      if (command.playerId === playerIdRef.current) {
        const timestamp = new Date().toLocaleTimeString();
        setTranscripts(prev => [{
          text: command.command,
          confidence: command.confidence,
          timestamp
        }, ...prev.slice(0, 9)]);
      }
    });

    // Listen for transcript events (debug mode)
    newSocket.on('transcript', (data: { text: string; confidence: number }) => {
      const timestamp = new Date().toLocaleTimeString();
      setTranscripts(prev => [{
        text: data.text,
        confidence: data.confidence,
        timestamp
      }, ...prev.slice(0, 9)]);
      
      // Set transcription status to active when we receive transcripts
      setTranscriptionStatus('active');
      setTranscriptionError('');
    });
    
    // Listen for transcription errors
    newSocket.on('transcriptionError', (data: { message: string; details: string; apiKeyConfigured: boolean }) => {
      addDebug(`Transcription error: ${data.details}`);
      setTranscriptionStatus(data.apiKeyConfigured ? 'error' : 'not_configured');
      setTranscriptionError(data.details);
    });
    
    // Listen for transcription ready
    newSocket.on('transcriptionReady', () => {
      addDebug('Transcription service is ready');
      setTranscriptionStatus('active');
    });

    setSocket(newSocket);
    socketRef.current = newSocket;

    return () => {
      newSocket.off('connect', handleConnect);
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const joinRoom = () => {
    if (socket && roomCode.length === 4 && playerName.trim()) {
      socket.emit('joinRoom', { roomCode: roomCode.toUpperCase(), playerName });
    }
  };

  const leaveRoom = () => {
    if (socket) {
      socket.emit('leaveRoom');
      setIsJoined(false);
      setGameState('waiting');
      setRoomCode('');
      setPlayerName('');
      setPlayerId('');
      sessionStorage.removeItem(STORAGE_KEY);
      stopAudioCapture();
    }
  };

  const handleReady = async () => {
    if (isReady) {
      // Unready
      setIsReady(false);
      stopAudioCapture(true); // Keep the stream for re-readying
      if (socket) {
        socket.emit('playerNotReady', { roomCode, playerId });
      }
      return;
    }

    // Check if we already have a valid stream
    const existingStream = mediaStreamRef.current;
    if (existingStream && existingStream.getTracks().some(track => track.readyState === 'live')) {
      // We already have permission and a valid stream
      console.log('[READY] Reusing existing media stream');
      setIsReady(true);
      
      if (socket) {
        socket.emit('playerReady', { roomCode, playerId, hasMic: true });
      }
      
      addDebug('Ready with existing microphone!');
      return;
    }

    // Try to get microphone permission
    try {
      addDebug('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      });
      
      // Permission granted - setup audio but don't start sending yet
      mediaStreamRef.current = stream;
      setMicPermissionStatus('granted');
      micPermissionStatusRef.current = 'granted';
      setIsReady(true);
      
      if (socket) {
        socket.emit('playerReady', { roomCode, playerId, hasMic: true });
      }
      
      addDebug('Ready with microphone!');
      
      // Store the stream for later use when game starts
      mediaStreamRef.current = stream;
      
    } catch (err) {
      // Permission denied or error - still mark as ready but without mic
      console.error('Microphone access denied:', err);
      setMicPermissionStatus('denied');
      micPermissionStatusRef.current = 'denied';
      setIsReady(true);
      
      if (socket) {
        socket.emit('playerReady', { roomCode, playerId, hasMic: false });
      }
      
      addDebug('Ready (no microphone access)');
    }
  };

  const startAudioCapture = async () => {
    try {
      console.log('[AUDIO] Starting audio capture...');
      addDebug('Starting audio capture...');
      
      // Check if we already have a stream from the Ready button
      let stream = mediaStreamRef.current;
      
      if (!stream || stream.getTracks().some(track => track.readyState === 'ended')) {
        console.log('[AUDIO] No existing stream, requesting new one...');
        addDebug('Requesting microphone access...');
        
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false, // Disable for clearer voice (game doesn't need echo cancellation)
            noiseSuppression: false, // Can sometimes filter out voice frequencies
            autoGainControl: true,  // Keep AGC for consistent levels
            sampleRate: 16000,
            channelCount: 1         // Ensure mono audio
          }
        });

        console.log('[AUDIO] Got new media stream');
        addDebug('Got new media stream');
        
        mediaStreamRef.current = stream;
      } else {
        console.log('[AUDIO] Reusing existing media stream');
        addDebug('Using existing microphone stream');
      }
      
      // Always create a new AudioContext for a fresh audio pipeline
      console.log('[AUDIO] Creating new AudioContext');
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      
      // Check AudioContext state
      console.log('[AUDIO] AudioContext state:', audioContextRef.current.state);
      addDebug(`AudioContext state: ${audioContextRef.current.state}`);
      
      // Resume AudioContext if suspended
      if (audioContextRef.current.state === 'suspended') {
        console.log('[AUDIO] Resuming AudioContext...');
        await audioContextRef.current.resume();
        console.log('[AUDIO] AudioContext resumed, state:', audioContextRef.current.state);
        addDebug(`AudioContext resumed: ${audioContextRef.current.state}`);
      }
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Add a high-pass filter to reduce low-frequency noise
      const highPassFilter = audioContextRef.current.createBiquadFilter();
      highPassFilter.type = 'highpass';
      highPassFilter.frequency.value = 80; // Cut frequencies below 80Hz (below human voice)
      
      // Use 1024 samples = 64ms at 16kHz (meets AssemblyAI's 50ms minimum)
      const processor = audioContextRef.current.createScriptProcessor(1024, 1, 1);
      
      // Create analyser for audio level monitoring
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      // Start audio level monitoring
      const updateAudioLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Calculate average volume
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(average / 255); // Normalize to 0-1
          
          animationIdRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };
      updateAudioLevel();
      
      let chunkCount = 0;
      const AUDIO_GAIN = 2.5; // Boost audio by 2.5x (reduced from 3x to prevent clipping)
      
      processor.onaudioprocess = (e) => {
        // Use refs to avoid closure issues
        const currentlyRecording = isRecordingRef.current;
        const currentSocket = socketRef.current;
        
        if (currentlyRecording && currentSocket && currentSocket.connected) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = new Int16Array(inputData.length);
          
          for (let i = 0; i < inputData.length; i++) {
            // Apply gain boost
            const boosted = inputData[i] * AUDIO_GAIN;
            // Clamp to prevent clipping
            const clamped = Math.max(-1, Math.min(1, boosted));
            pcmData[i] = Math.max(-32768, Math.min(32767, clamped * 32768));
          }
          
          chunkCount++;
          
          // Log first chunk and every 100th chunk
          if (chunkCount === 1 || chunkCount % 100 === 0) {
            console.log(`[AUDIO] Sending chunk #${chunkCount}, size: ${pcmData.byteLength} bytes, gain: ${AUDIO_GAIN}x`);
            console.log(`[AUDIO] Socket connected: ${currentSocket.connected}`);
            console.log(`[AUDIO] Recording ref: ${currentlyRecording}`);
            addDebug(`Sent audio chunk #${chunkCount} (${pcmData.byteLength} bytes, gain: ${AUDIO_GAIN}x)`);
          }
          
          try {
            currentSocket.emit('audio', pcmData.buffer);
          } catch (error) {
            console.error('[AUDIO] Error sending audio:', error);
            addDebug(`Error sending audio: ${error}`);
          }
        } else {
          // Log why we're not sending on first few attempts
          if (chunkCount < 5) {
            console.log('[AUDIO] Not sending audio chunk:', {
              recording: currentlyRecording,
              hasSocket: !!currentSocket,
              socketConnected: currentSocket?.connected
            });
          }
        }
      };

      // Connect audio chain: source -> filter -> processor -> destination
      source.connect(highPassFilter);
      highPassFilter.connect(processor);
      highPassFilter.connect(analyserRef.current); // Also connect to analyser
      processor.connect(audioContextRef.current.destination);
      
      console.log('[AUDIO] Audio pipeline connected');
      console.log('[AUDIO] Stream tracks:', stream.getTracks().map(t => ({ 
        kind: t.kind, 
        label: t.label, 
        enabled: t.enabled, 
        muted: t.muted,
        readyState: t.readyState
      })));
      
      setIsRecording(true);
      isRecordingRef.current = true;
      console.log('[AUDIO] Audio capture started successfully');
      console.log('[AUDIO] isRecordingRef set to:', isRecordingRef.current);
      addDebug('Audio capture started successfully');
    } catch (err) {
      setError('Failed to access microphone. Please ensure permissions are granted.');
      console.error('Audio capture error:', err);
      addDebug(`Audio capture failed: ${err}`);
    }
  };

  const stopAudioCapture = (keepStream = false) => {
    // Set recording flag to false first to stop audio processing
    setIsRecording(false);
    isRecordingRef.current = false;
    
    // Always close the audio context to clean up processors
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Only stop the media stream if we're fully leaving
    if (!keepStream && mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    
    setAudioLevel(0);
    addDebug('Audio capture stopped' + (keepStream ? ' (keeping mic stream)' : ''));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-pink-600 text-white p-4 overflow-y-auto">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-yellow-500/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-teal-500/30 rounded-full blur-3xl animate-pulse animation-delay-2000"></div>
      </div>
      
      <div className="relative max-w-md mx-auto flex flex-col min-h-screen py-8">
        {!isJoined ? (
          <div className="flex-1 flex items-center">
            <div className="w-full">
          <div className="bg-gray-900/60 backdrop-blur-xl rounded-3xl p-8 space-y-6 border border-white/10 shadow-2xl">
            <div className="text-center">
              <h1 className="text-5xl font-black mb-2 text-transparent bg-gradient-to-r from-yellow-400 to-pink-400 bg-clip-text">
                Join the Fun!
              </h1>
              <p className="text-lg text-gray-300">🎮 Ready to play?</p>
            </div>
            
            {!isConnected && (
              <div className="text-center bg-yellow-500/20 rounded-2xl p-4 border border-yellow-500/50">
                <p className="text-yellow-300 font-bold animate-pulse">🔌 Connecting to server...</p>
              </div>
            )}
            
            {isReconnecting && (
              <div className="text-center bg-teal-500/20 rounded-2xl p-4 border border-teal-500/50">
                <p className="text-teal-300 font-bold animate-pulse">🔄 Reconnecting to game...</p>
              </div>
            )}
            
            {!isReconnecting && (
              <>
                <div className="space-y-2">
                  <label className="block text-lg font-bold mb-2">🙋 Your Name</label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl bg-white/10 backdrop-blur border-2 border-white/20 focus:outline-none focus:border-yellow-400 focus:bg-white/20 transition-all text-lg font-semibold placeholder-white/50"
                    placeholder="Enter your awesome name"
                    maxLength={20}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-lg font-bold mb-2">🎫 Room Code</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      className="w-full px-6 py-6 rounded-2xl bg-gradient-to-r from-yellow-400/20 to-orange-400/20 backdrop-blur border-2 border-yellow-400/50 focus:outline-none focus:border-yellow-400 focus:shadow-lg focus:shadow-yellow-400/25 transition-all text-center text-4xl tracking-wider font-black"
                      placeholder="ABCD"
                      maxLength={4}
                    />
                    {roomFromUrl && (
                      <div className="absolute -top-8 right-0 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-bounce">
                        ✨ Auto-filled!
                      </div>
                    )}
                  </div>
                </div>
                
                {error && (
                  <div className="bg-red-500/20 rounded-2xl p-4 border border-red-500/50">
                    <p className="text-red-300 text-center font-semibold">⚠️ {error}</p>
                  </div>
                )}
                
                <button
                  onClick={joinRoom}
                  disabled={!isConnected || roomCode.length !== 4 || !playerName.trim()}
                  className="group relative w-full py-5 font-black text-xl disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-105 disabled:hover:scale-100"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-400 rounded-2xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl py-5 shadow-2xl">
                    <span className="flex items-center justify-center gap-3">
                      <span className="text-2xl">🚀</span>
                      Let&apos;s Go!
                    </span>
                  </div>
                </button>
              </>
            )}
          </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 w-full">
            <div className="bg-gray-900/60 backdrop-blur-xl rounded-3xl p-6 text-center border border-white/10 shadow-2xl">
              <div className="text-4xl mb-3 animate-bounce">👋</div>
              <h2 className="text-3xl font-black mb-2 text-transparent bg-gradient-to-r from-yellow-400 to-pink-400 bg-clip-text">
                Hi, {playerName}!
              </h2>
              <p className="text-xl text-gray-300 font-semibold">Room: <span className="text-yellow-400">{roomCode}</span></p>
              <button
                onClick={leaveRoom}
                className="mt-4 px-6 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-2xl text-sm font-bold hover:shadow-lg hover:shadow-red-500/25 transform hover:scale-105 transition-all"
              >
                🚪 Leave Room
              </button>
            </div>

            {gameState === 'waiting' && (
              <div className="bg-gray-900/60 backdrop-blur-xl rounded-3xl p-8 text-center border border-white/10 shadow-2xl">
                <div className="text-6xl mb-4 animate-pulse">⏳</div>
                <p className="text-2xl font-bold text-transparent bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text">
                  Waiting for host to start...
                </p>
                <p className="text-lg text-gray-300 mt-2">Get ready for voice-powered fun!</p>
              </div>
            )}

            {(gameState === 'preparing' || gameState === 'playing') && (
              <div className="space-y-4">
                <div className="bg-gray-900/60 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl">
                  <h3 className="text-2xl font-black mb-4 text-center text-transparent bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text">
                    🎮 Game Controls
                  </h3>
                  
                  {gameMode === 'voice_racer' && playerWord && (
                    <div className="mb-6 text-center">
                      <p className="text-xl mb-3 font-semibold">🏎️ Say this word to race:</p>
                      <div className="relative inline-block">
                        <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl blur-xl opacity-75 animate-pulse"></div>
                        <div className="relative bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl px-8 py-4">
                          <p className="text-5xl font-black text-gray-900">
                            {wordDisplayMap[playerWord.toLowerCase()] || playerWord}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {gameMode === 'tug_of_war' && teamWord && (
                    <div className="mb-6 text-center">
                      <div className={`inline-block px-8 py-4 rounded-2xl mb-4 font-black text-xl shadow-lg transform hover:scale-105 transition-all ${
                        playerTeam === 'red' 
                          ? 'bg-gradient-to-r from-red-500 to-pink-500 shadow-red-500/25' 
                          : 'bg-gradient-to-r from-blue-500 to-cyan-500 shadow-blue-500/25'
                      }`}>
                        <p className="flex items-center gap-2">
                          <span className="text-2xl">{playerTeam === 'red' ? '🔴' : '🔵'}</span>
                          {playerTeam === 'red' ? 'RED' : 'BLUE'} TEAM
                        </p>
                      </div>
                      <p className="text-xl mb-3 font-semibold">🪢 Say this word to pull:</p>
                      <div className="relative inline-block">
                        <div className={`absolute inset-0 rounded-2xl blur-xl opacity-75 animate-pulse ${
                          playerTeam === 'red' 
                            ? 'bg-gradient-to-r from-red-400 to-pink-400' 
                            : 'bg-gradient-to-r from-blue-400 to-cyan-400'
                        }`}></div>
                        <div className={`relative rounded-2xl px-8 py-4 ${
                          playerTeam === 'red' 
                            ? 'bg-gradient-to-r from-red-400 to-pink-400' 
                            : 'bg-gradient-to-r from-blue-400 to-cyan-400'
                        }`}>
                          <p className="text-5xl font-black text-gray-900">
                            {wordDisplayMap[teamWord.toLowerCase()] || teamWord}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {gameState === 'preparing' ? (
                    <div className="space-y-4">
                      {!isReady ? (
                        <button
                          onClick={handleReady}
                          className="group relative w-full py-5 font-black text-xl transform transition-all duration-200 hover:scale-105"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-400 rounded-2xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity animate-pulse"></div>
                          <div className="relative bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl py-5 shadow-2xl">
                            <span className="flex items-center justify-center gap-3">
                              <span className="text-2xl">🎤</span>
                              Ready
                            </span>
                          </div>
                        </button>
                      ) : (
                        <div className="space-y-4">
                          <div className={`relative w-full py-5 font-black text-xl rounded-2xl ${
                            micPermissionStatus === 'granted' 
                              ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                              : 'bg-gradient-to-r from-yellow-500 to-orange-500'
                          }`}>
                            <span className="flex items-center justify-center gap-3">
                              <span className="text-2xl">✅</span>
                              {micPermissionStatus === 'granted' ? 'Ready!' : 'Ready (No Mic)'}
                              {micPermissionStatus === 'granted' && <span className="text-lg">🎤</span>}
                              {micPermissionStatus === 'denied' && <span className="text-lg">⚠️</span>}
                            </span>
                          </div>
                          <button
                            onClick={handleReady}
                            className="w-full py-3 bg-gray-600 hover:bg-gray-700 rounded-xl text-white font-bold transition-all"
                          >
                            Not Ready
                          </button>
                        </div>
                      )}
                      <div className="bg-gray-900/50 rounded-xl p-4 text-center">
                        <p className="text-lg">⏳ Waiting for all players to be ready...</p>
                      </div>
                    </div>
                  ) : !isRecording ? (
                    <button
                      onClick={startAudioCapture}
                      className="group relative w-full py-5 font-black text-xl transform transition-all duration-200 hover:scale-105"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-pink-400 rounded-2xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity animate-pulse"></div>
                      <div className="relative bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl py-5 shadow-2xl">
                        <span className="flex items-center justify-center gap-3">
                          <span className="text-2xl">🎙️</span>
                          Activate Voice
                        </span>
                      </div>
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <button
                        onClick={() => stopAudioCapture(false)}
                        className="group relative w-full py-5 font-bold text-xl transform transition-all duration-200 hover:scale-105"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-gray-500 to-gray-600 rounded-2xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative bg-gradient-to-r from-gray-600 to-gray-700 rounded-2xl py-5 shadow-2xl">
                          <span className="flex items-center justify-center gap-3">
                            <span className="text-2xl">🛑</span>
                            Stop Voice Control
                          </span>
                        </div>
                      </button>
                      <div className="flex items-center justify-center space-x-3 bg-red-500/20 rounded-2xl p-3 border border-red-500/50">
                        <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"></div>
                        <p className="text-lg font-bold">🔴 Recording - Speak now!</p>
                      </div>
                      
                      {/* Audio Level Indicator */}
                      <div className="mt-4 bg-gray-800/50 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold">🎙️ Audio Level</span>
                          <span className="text-sm font-bold text-green-400">{Math.round(audioLevel * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-100 bg-gradient-to-r from-green-400 to-emerald-400 shadow-lg shadow-green-400/50"
                            style={{ width: `${audioLevel * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {gameMode === 'voice_racer' && (
                  <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                    <h4 className="font-semibold mb-3 text-xl">🏎️ Voice Racer</h4>
                    <div className="bg-green-600/20 border border-green-600 rounded-lg p-4 mb-4">
                      <p className="text-lg font-bold">Say your word to accelerate!</p>
                    </div>
                    <p className="text-sm text-white/80">Keep saying it to maintain speed!</p>
                    <p className="text-sm text-white/80 mt-2">First to the finish line wins! 🏁</p>
                  </div>
                )}
                
                {gameMode === 'tug_of_war' && (
                  <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
                    <h4 className="font-semibold mb-3 text-xl">🪢 Tug of War</h4>
                    <div className={`border rounded-lg p-4 mb-4 ${
                      playerTeam === 'red' ? 'bg-red-600/20 border-red-600' : 'bg-blue-600/20 border-blue-600'
                    }`}>
                      <p className="text-lg font-bold">Say your team word to pull!</p>
                    </div>
                    <p className="text-sm text-white/80">Work with your teammates!</p>
                    <p className="text-sm text-white/80 mt-2">Pull the rope to your side to win! ⚔️</p>
                  </div>
                )}
                
                {/* Debug Toggle */}
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="w-full py-2 bg-gray-700/50 rounded-lg text-sm hover:bg-gray-700/70 transition-colors"
                >
                  {showDebug ? 'Hide' : 'Show'} Debug Info
                </button>
                
                {/* Debug Panel */}
                {showDebug && (
                  <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Recent Transcripts:</h4>
                      {transcripts.length === 0 ? (
                        <p className="text-sm text-white/60">No transcripts yet...</p>
                      ) : (
                        <div className="space-y-1 text-xs font-mono">
                          {transcripts.map((transcript, i) => (
                            <div key={i} className="flex justify-between items-center">
                              <span className="text-white/80">{transcript.text}</span>
                              <span className="text-white/60">
                                {Math.round(transcript.confidence * 100)}% • {transcript.timestamp}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2">Connection Status:</h4>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span>WebSocket:</span>
                          <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
                            {isConnected ? 'Connected' : 'Disconnected'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Audio Capture:</span>
                          <span className={isRecording ? 'text-green-400' : 'text-gray-400'}>
                            {isRecording ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Player ID:</span>
                          <span className="text-white/60 text-xs">{playerId || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Transcription:</span>
                          <span className={
                            transcriptionStatus === 'active' ? 'text-green-400' : 
                            transcriptionStatus === 'not_configured' ? 'text-yellow-400' :
                            transcriptionStatus === 'error' ? 'text-red-400' : 'text-gray-400'
                          }>
                            {transcriptionStatus === 'active' ? 'Active' :
                             transcriptionStatus === 'not_configured' ? 'API Key Missing' :
                             transcriptionStatus === 'error' ? 'Error' : 'Unknown'}
                          </span>
                        </div>
                      </div>
                      {transcriptionError && (
                        <div className="mt-2 p-2 bg-red-900/50 rounded text-xs">
                          <p className="font-semibold text-red-400">Transcription Error:</p>
                          <p className="text-red-300">{transcriptionError}</p>
                          {transcriptionStatus === 'not_configured' && (
                            <p className="text-yellow-300 mt-1">Please configure ASSEMBLYAI_API_KEY in backend/.env</p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2">Debug Log:</h4>
                      <div className="space-y-1 text-xs font-mono text-white/60 max-h-32 overflow-y-auto">
                        {debugInfo.map((info, i) => (
                          <div key={i}>{info}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {gameState === 'finished' && (
              <div className="bg-gray-900/60 backdrop-blur-xl rounded-3xl p-8 text-center border border-white/10 shadow-2xl">
                <div className="text-6xl mb-4 animate-bounce">🎉</div>
                <h3 className="text-4xl font-black mb-4 text-transparent bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text">
                  Game Over!
                </h3>
                <p className="text-xl text-gray-300 font-semibold">Thanks for playing! 🎆</p>
                <p className="text-lg text-gray-400 mt-2">Wait for the host to start a new game...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}