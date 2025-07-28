import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { RoomManager } from './services/RoomManager';
import { TranscriptionManager, TranscriptEvent } from './services/TranscriptionManager';
import { CommandExtractor } from './services/CommandExtractor';
import { GameManager } from './services/GameManager';
import { Player, PlayerCommand } from './types';
import { GameAction } from './types/game';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Configure CORS based on environment
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];

console.log('CORS Origins:', corsOrigins);

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const roomManager = new RoomManager();
const transcriptionManager = new TranscriptionManager(process.env.ASSEMBLYAI_API_KEY || '');
const gameManager = new GameManager();

// Rate limiting for room creation: IP -> last creation timestamp
const roomCreationLimiter = new Map<string, number>();
const ROOM_CREATION_COOLDOWN = 60000; // 1 minute

// Maximum audio chunk size (1MB - way more than needed for 64ms at 16kHz)
const MAX_AUDIO_SIZE = 1024 * 1024; // 1MB

// Track recent commands for deduplication (DISABLED)
// const recentCommands = new Map<string, { command: string; timestamp: number }>();

// Set up transcription event handlers
transcriptionManager.on('transcript', (event: TranscriptEvent) => {
  console.log(`[TRANSCRIPT EVENT] Received transcript [${event.eventId}]: "${event.text}" from player ${event.playerId}`);
  
  // Emit raw transcript to the specific player for debugging
  const room = roomManager.getRoom(event.roomCode);
  if (room) {
    const player = room.players.get(event.playerId);
    if (player && player.socketId) {
      io.to(player.socketId).emit('transcript', {
        text: event.text,
        confidence: event.confidence
      });
    }
    
    // Also emit transcript to host for debugging
    if (room.hostSocketId) {
      io.to(room.hostSocketId).emit('hostTranscript', {
        playerId: event.playerId,
        playerName: player?.name || 'Unknown',
        text: event.text,
        confidence: event.confidence,
        timestamp: event.timestamp
      });
    }
  }
  
  // Get player's assigned word if in a game
  let dynamicWords: string[] = [];
  const game = gameManager.getGame(event.roomCode);
  
  if (game) {
    console.log(`[DEBUG] Game found for room ${event.roomCode}, mode: ${game.mode}, status: ${game.status}`);
    
    if (game.mode === 'voice_racer') {
      const racerGame = game as any; // We know it's VoiceRacerState
      const playerWord = racerGame.playerWords?.get(event.playerId);
      console.log(`[DEBUG] Voice Racer - Player ${event.playerId} assigned word: "${playerWord}"`);
      if (playerWord) {
        dynamicWords = [playerWord];
      }
    } else if (game.mode === 'tug_of_war') {
      const tugGame = game as any; // We know it's TugOfWarState
      const playerWord = tugGame.playerWords?.get(event.playerId);
      console.log(`[DEBUG] Tug of War - Player ${event.playerId} assigned word: "${playerWord}"`);
      if (playerWord) {
        dynamicWords = [playerWord];
      }
    }
  } else {
    console.log(`[DEBUG] No game found for room ${event.roomCode}`);
  }
  
  console.log(`[DEBUG] Checking transcript "${event.text}" against dynamic words: [${dynamicWords.join(', ')}]`);
  const command = CommandExtractor.extract(event.text, event.confidence, dynamicWords);
  
  if (command && command.confidence >= CommandExtractor.getConfidenceThreshold(command.type)) {
    // DUPLICATE CHECKING DISABLED
    
    // Get player name for the command
    let playerName = 'Unknown Player';
    if (room) {
      const player = room.players.get(event.playerId);
      if (player) {
        playerName = player.name;
      }
    }
    
    const playerCommand: PlayerCommand = {
      playerId: event.playerId,
      roomCode: event.roomCode,
      command: command.command,
      type: command.type,
      confidence: command.confidence,
      timestamp: event.timestamp,
      playerName: playerName
    };
    
    // Emit command to the room
    io.to(event.roomCode).emit('playerCommand', playerCommand);
    
    // Also send to game manager if game is active
    const gameAction: GameAction = {
      playerId: event.playerId,
      command: command.command,
      timestamp: event.timestamp,
      matchScore: command.matchScore
    };
    gameManager.processCommand(event.roomCode, gameAction);
  } else {
    console.log(`[COMMAND EXTRACT] No valid command found in: "${event.text}" (checked words: ${dynamicWords.join(', ')})`);
  }
});

// Set up game event handlers
gameManager.on('gameUpdate', ({ roomCode, gameState }) => {
  io.to(roomCode).emit('gameStateUpdate', gameState);
});

gameManager.on('countdown', ({ roomCode, count }) => {
  io.to(roomCode).emit('gameCountdown', count);
});

gameManager.on('gameEnd', ({ roomCode, gameState }) => {
  io.to(roomCode).emit('gameEnded', gameState);
  
  // Update room state
  const room = roomManager.getRoom(roomCode);
  if (room) {
    room.gameState = 'finished';
  }
});

transcriptionManager.on('error', ({ playerId, error }) => {
  console.error(`Transcription error for player ${playerId}:`, error);
  
  // Notify the player about the transcription error
  const roomCode = roomManager.getRoomByPlayerId(playerId);
  if (roomCode) {
    const room = roomManager.getRoom(roomCode);
    if (room) {
      const player = room.players.get(playerId);
      if (player && player.socketId) {
        io.to(player.socketId).emit('transcriptionError', {
          message: 'Voice transcription error occurred',
          details: error.message,
          apiKeyConfigured: !!process.env.ASSEMBLYAI_API_KEY && 
                           process.env.ASSEMBLYAI_API_KEY !== 'your_assemblyai_api_key_here'
        });
      }
    }
  }
});

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(express.json());

// Minimal health check - always available for load balancers
app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

// Development-only endpoints
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  // Detailed health check with system info - development only
  app.get('/health-detailed', (_, res) => {
    const apiKeyConfigured = !!process.env.ASSEMBLYAI_API_KEY && 
                            process.env.ASSEMBLYAI_API_KEY !== 'your_assemblyai_api_key_here';
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      assemblyAI: {
        configured: apiKeyConfigured,
        apiKeyStatus: apiKeyConfigured ? 'configured' : 'missing',
        activeSessions: transcriptionManager.getActiveSessionCount()
      },
      rooms: {
        active: roomManager.getRoomCount(),
        players: roomManager.getTotalPlayerCount()
      }
    });
  });

  app.get('/api/transcription-status', (_, res) => {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    const isConfigured = !!apiKey && apiKey !== 'your_assemblyai_api_key_here' && apiKey.length > 10;
    
    res.json({
      configured: isConfigured,
      activeSessions: transcriptionManager.getActiveSessionCount(),
      apiKeyPresent: !!apiKey,
      apiKeyLength: apiKey ? apiKey.length : 0,
      message: isConfigured 
        ? 'AssemblyAI is configured and ready' 
        : 'AssemblyAI API key not configured. Please set ASSEMBLYAI_API_KEY in backend/.env file',
      troubleshooting: !isConfigured ? [
        '1. Create a backend/.env file if it doesn\'t exist',
        '2. Add: ASSEMBLYAI_API_KEY=your_actual_api_key',
        '3. Get your API key from https://www.assemblyai.com/dashboard',
        '4. Restart the backend server'
      ] : []
    });
  });

  // Audio test endpoint - creates a test transcription session
  app.post('/test-audio', async (_, res) => {
    const testPlayerId = `test_${Date.now()}`;
    const testRoomCode = 'TEST';
    
    try {
      await transcriptionManager.createSession(testPlayerId, testRoomCode);
      
      // Set up test transcript handler
      const testHandler = (event: TranscriptEvent) => {
        if (event.playerId === testPlayerId) {
          console.log(`[TEST] Transcript received: "${event.text}" (confidence: ${event.confidence})`);
        }
      };
      
      transcriptionManager.on('transcript', testHandler);
      
      // Clean up after 30 seconds
      setTimeout(async () => {
        await transcriptionManager.endSession(testPlayerId);
        transcriptionManager.off('transcript', testHandler);
        console.log('[TEST] Audio test session ended');
      }, 30000);
      
      res.json({
        success: true,
        testPlayerId,
        message: 'Test transcription session created for 30 seconds'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to create test transcription session'
      });
    }
  });
} // End of development-only endpoints

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Host creates a room
  socket.on('createRoom', () => {
    // Rate limiting check
    const ip = socket.handshake.address;
    const lastCreation = roomCreationLimiter.get(ip) || 0;
    const now = Date.now();
    
    if (now - lastCreation < ROOM_CREATION_COOLDOWN) {
      const waitTime = Math.ceil((ROOM_CREATION_COOLDOWN - (now - lastCreation)) / 1000);
      socket.emit('error', `Please wait ${waitTime} seconds before creating another room`);
      console.log(`Rate limit hit for IP ${ip} - must wait ${waitTime}s`);
      return;
    }
    
    // Update rate limiter
    roomCreationLimiter.set(ip, now);
    
    const roomCode = roomManager.createRoom(socket.id);
    socket.join(roomCode);
    socket.emit('roomCreated', roomCode);
    console.log(`Room ${roomCode} created by host ${socket.id} from IP ${ip}`);
  });

  // Host reconnects to existing room
  socket.on('reconnectRoom', (roomCode: string) => {
    const room = roomManager.reconnectHost(roomCode, socket.id);
    
    if (room) {
      socket.join(roomCode);
      socket.emit('roomReconnected', {
        roomCode,
        players: Array.from(room.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          connected: p.connected
        })),
        gameState: room.gameState
      });
      console.log(`Host ${socket.id} reconnected to room ${roomCode}`);
    } else {
      socket.emit('roomNotFound');
      console.log(`Room ${roomCode} not found for reconnection`);
    }
  });

  // Player reconnects to room
  socket.on('reconnectPlayer', ({ roomCode, playerId }: { roomCode: string; playerId: string }) => {
    console.log(`Reconnection attempt - Room: ${roomCode}, Player: ${playerId}`);
    const player = roomManager.reconnectPlayer(roomCode, playerId, socket.id);
    
    if (player) {
      socket.join(roomCode);
      socket.emit('playerReconnected', {
        playerId: player.id,
        playerName: player.name,
        roomCode
      });
      
      // Get current game state
      const room = roomManager.getRoom(roomCode);
      if (room) {
        // Notify host that player reconnected
        io.to(room.hostSocketId).emit('playerReconnected', {
          id: player.id,
          name: player.name
        });
        
        // Recreate transcription session
        transcriptionManager.createSession(player.id, roomCode)
          .then(() => {
            console.log(`Transcription session recreated for reconnected player ${player.name}`);
            socket.emit('transcriptionReady');
          })
          .catch(err => {
            console.error(`Failed to recreate transcription session for ${player.name}:`, err);
            socket.emit('transcriptionError', {
              message: 'Failed to recreate voice transcription',
              details: err.message || 'Unknown error',
              apiKeyConfigured: !!process.env.ASSEMBLYAI_API_KEY && 
                               process.env.ASSEMBLYAI_API_KEY !== 'your_assemblyai_api_key_here'
            });
          });
        
        if (room.gameState !== 'waiting') {
          socket.emit('gameStarted');
        }
      }
      
      console.log(`Player ${player.name} successfully reconnected to room ${roomCode}`);
    } else {
      socket.emit('reconnectFailed', 'Unable to reconnect. Please join again.');
      console.log(`Failed reconnection - room exists: ${roomManager.isRoomValid(roomCode)}, player: ${playerId}`);
    }
  });

  // Player joins a room
  socket.on('joinRoom', ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
    const player: Player = {
      id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: playerName,
      roomCode,
      socketId: socket.id,
      connected: true
    };

    const joined = roomManager.joinRoom(roomCode, player);
    
    if (joined) {
      socket.join(roomCode);
      socket.emit('joinedRoom', {
        playerId: player.id,
        playerName: player.name,
        roomCode
      });
      
      // Create transcription session for the player
      console.log(`Creating transcription session for player ${player.name} (${player.id})...`);
      transcriptionManager.createSession(player.id, roomCode)
        .then(() => {
          console.log(`✅ Transcription session created successfully for player ${player.name}`);
          // Notify player that transcription is ready
          socket.emit('transcriptionReady');
          
          // Also send a transcript event to confirm the connection
          setTimeout(() => {
            socket.emit('transcript', {
              text: '[System] Voice transcription is active',
              confidence: 1.0
            });
          }, 1000);
        })
        .catch(err => {
          console.error(`❌ Failed to create transcription session for ${player.name}:`, err);
          socket.emit('transcriptionError', {
            message: 'Failed to initialize voice transcription',
            details: err.message || 'Unknown error',
            apiKeyConfigured: !!process.env.ASSEMBLYAI_API_KEY && 
                             process.env.ASSEMBLYAI_API_KEY !== 'your_assemblyai_api_key_here'
          });
        });
      
      // Notify host about new player
      const room = roomManager.getRoom(roomCode);
      if (room) {
        io.to(room.hostSocketId).emit('playerJoined', {
          id: player.id,
          name: player.name
        });
      }
      
      console.log(`Player ${playerName} joined room ${roomCode}`);
    } else {
      socket.emit('error', 'Invalid room code or game already started');
    }
  });

  // Host starts the game
  socket.on('startGame', ({ roomCode, gameMode }: { roomCode: string; gameMode?: string }) => {
    console.log(`Start game request for room ${roomCode}, mode: ${gameMode || 'voice_racer'} from socket ${socket.id}`);
    const room = roomManager.getRoom(roomCode);
    
    if (room && room.hostSocketId === socket.id) {
      // If room is in finished state, reset it first
      if (room.gameState === 'finished') {
        roomManager.resetRoom(roomCode);
      }
      
      const started = roomManager.startGame(roomCode);
      
      if (started) {
        console.log(`Setting room ${roomCode} to preparing state`);
        
        // Change room state to preparing
        room.gameState = 'preparing';
        
        // Reset ready players
        if (!room.readyPlayers) {
          room.readyPlayers = new Map();
        }
        room.readyPlayers.clear();
        
        // Create game in GameManager but don't start it yet
        try {
          const game = gameManager.createGame(
            roomCode, 
            (gameMode as any) || 'voice_racer', // Use provided game mode or default to voice racer
            room.players
          );
          
          // Send initial game state immediately after creation
          console.log('Sending initial game state after creation');
          // Need to serialize the game state before sending
          const serializedGame = gameManager.getSerializedGameState(roomCode);
          if (serializedGame) {
            console.log('Initial game state:', serializedGame.mode);
            io.to(roomCode).emit('gameStateUpdate', serializedGame);
          }
          
          // Don't start the game yet - wait for all players to be ready
          
          // Broadcast to all clients in the room
          io.to(roomCode).emit('gameStarted', { gameMode: game.mode });
          console.log(`Game created in preparing state for room ${roomCode} with mode: ${game.mode}`);
        } catch (error) {
          console.error(`Failed to create game:`, error);
          socket.emit('error', 'Failed to create game');
          return;
        }
        
        // Log player sockets for debugging
        room.players.forEach((player, playerId) => {
          console.log(`Player ${player.name} (${playerId}) - Socket: ${player.socketId}, Connected: ${player.connected}`);
        });
      } else {
        console.log(`Failed to start game in room ${roomCode} - not enough players`);
        socket.emit('error', 'Need at least 1 player to start');
      }
    } else {
      console.log(`Invalid host or room for start game request - room exists: ${!!room}, is host: ${room?.hostSocketId === socket.id}`);
    }
  });

  // Host returns to lobby
  socket.on('returnToLobby', (roomCode: string) => {
    const room = roomManager.getRoom(roomCode);
    
    if (room && room.hostSocketId === socket.id) {
      // Reset room state
      room.gameState = 'waiting';
      
      // Stop the game in GameManager
      gameManager.endGame(roomCode);
      
      // Notify all players
      io.to(roomCode).emit('returnedToLobby');
      
      console.log(`Room ${roomCode} returned to lobby`);
    }
  });

  // Player marks themselves as ready
  socket.on('playerReady', ({ roomCode, playerId, hasMic }: { roomCode: string; playerId: string; hasMic: boolean }) => {
    const room = roomManager.getRoom(roomCode);
    
    if (room && room.players.has(playerId)) {
      if (!room.readyPlayers) {
        room.readyPlayers = new Map();
      }
      
      room.readyPlayers.set(playerId, { ready: true, hasMic });
      
      // Notify all clients of ready status update
      io.to(roomCode).emit('playerReadyStatus', {
        playerId,
        ready: true,
        hasMic,
        totalReady: Array.from(room.readyPlayers.values()).filter(p => p.ready).length,
        totalPlayers: room.players.size
      });
      
      console.log(`Player ${playerId} is ready (mic: ${hasMic}) in room ${roomCode}`);
      
      // Check if all players are ready
      if (room.gameState === 'preparing') {
        const playerIds = Array.from(room.players.keys());
        const readyStates = playerIds.map(id => ({
          id,
          ready: room.readyPlayers?.get(id)?.ready || false
        }));
        
        console.log(`Ready check for room ${roomCode}:`, readyStates);
        
        const allReady = playerIds.every(id => 
          room.readyPlayers?.get(id)?.ready === true
        );
        
        if (allReady && playerIds.length > 0) {
          console.log(`All players ready in room ${roomCode}, starting game!`);
          io.to(roomCode).emit('allPlayersReady');
          
          // Start the countdown after a short delay
          setTimeout(() => {
            // Update room state to playing
            room.gameState = 'playing';
            gameManager.startGame(roomCode);
          }, 500);
        }
      }
    }
  });

  // Player marks themselves as not ready
  socket.on('playerNotReady', ({ roomCode, playerId }: { roomCode: string; playerId: string }) => {
    const room = roomManager.getRoom(roomCode);
    
    if (room && room.readyPlayers) {
      room.readyPlayers.set(playerId, { ready: false, hasMic: false });
      
      // Notify all clients of ready status update
      io.to(roomCode).emit('playerReadyStatus', {
        playerId,
        ready: false,
        hasMic: false,
        totalReady: Array.from(room.readyPlayers.values()).filter(p => p.ready).length,
        totalPlayers: room.players.size
      });
      
      console.log(`Player ${playerId} is not ready in room ${roomCode}`);
    }
  });

  // Host removes an offline player
  socket.on('removePlayer', ({ roomCode, playerId }: { roomCode: string; playerId: string }) => {
    const room = roomManager.getRoom(roomCode);
    
    if (room && room.hostSocketId === socket.id) {
      const player = room.players.get(playerId);
      
      if (player) {
        const playerName = player.name;
        const playerSocketId = player.socketId;
        
        // Remove from ready players if exists
        if (room.readyPlayers) {
          room.readyPlayers.delete(playerId);
        }
        
        // Use the RoomManager method to properly remove the player
        roomManager.removePlayer(roomCode, playerId);
        
        // End transcription session
        transcriptionManager.endSession(playerId);
        
        // If the player's socket is still connected somehow, notify them
        if (playerSocketId) {
          io.to(playerSocketId).emit('removedFromRoom', {
            message: 'You have been removed from the room by the host.'
          });
        }
        
        // Update all clients about the removal
        io.to(roomCode).emit('playerRemoved', playerId);
        
        console.log(`Host removed offline player ${playerName} (${playerId}) from room ${roomCode}`);
      }
    }
  });

  // Player leaves room voluntarily
  socket.on('leaveRoom', (roomCode?: string) => {
    // If roomCode is provided, it means host is leaving to create new room
    if (roomCode && socket.id === roomManager.getRoom(roomCode)?.hostSocketId) {
      // Host is creating a new room - notify all players immediately
      io.to(roomCode).emit('roomClosed');
      console.log(`Host closing room ${roomCode} to create new one`);
    }
    
    const result = roomManager.leaveRoom(socket.id);
    
    if (result && !result.isHost) {
      // Player left the room
      const room = roomManager.getRoom(result.roomCode);
      if (room && room.hostSocketId) {
        // Notify host that player left
        io.to(room.hostSocketId).emit('playerLeft', result.playerId);
        
        // Remove from ready players
        if (room.readyPlayers) {
          room.readyPlayers.delete(result.playerId);
        }
        
        // End transcription session
        transcriptionManager.endSession(result.playerId);
        
        console.log(`Player ${result.playerId} left room ${result.roomCode}`);
      }
      
      // Leave the socket room
      socket.leave(result.roomCode);
    }
  });

  // Handle audio data from players
  socket.on('audio', (audioData: ArrayBuffer) => {
    console.log(`[AUDIO] Received audio data from socket ${socket.id}, size: ${audioData.byteLength} bytes`);
    
    // Validate audio chunk size
    if (audioData.byteLength > MAX_AUDIO_SIZE) {
      console.warn(`[AUDIO] Rejected oversized audio chunk from ${socket.id}: ${audioData.byteLength} bytes (max: ${MAX_AUDIO_SIZE})`);
      return;
    }
    
    const room = roomManager.getRoomBySocketId(socket.id);
    console.log(`[AUDIO] Room state: ${room?.gameState}, Room code: ${room?.code}`);
    
    if (room && room.gameState === 'playing') {
      // Find the player ID for this socket
      let playerId: string | null = null;
      let playerName: string | null = null;
      for (const [id, player] of room.players) {
        if (player.socketId === socket.id) {
          playerId = id;
          playerName = player.name;
          break;
        }
      }
      
      if (playerId) {
        console.log(`[AUDIO] Forwarding audio from player ${playerName} (${playerId}) to transcription service`);
        transcriptionManager.sendAudio(playerId, audioData);
      } else {
        console.warn(`[AUDIO] Received audio from socket ${socket.id} but could not find player ID`);
      }
    } else {
      if (!room) {
        console.warn(`[AUDIO] Received audio from socket ${socket.id} but no room found`);
      } else if (room.gameState !== 'playing') {
        console.warn(`[AUDIO] Received audio from socket ${socket.id} but game state is ${room.gameState}`);
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Handle player/host leaving
    const result = roomManager.leaveRoom(socket.id);
    if (result) {
      if (result.isHost) {
        // Host disconnected - room is kept alive for reconnection
        console.log(`Host disconnected from room ${result.roomCode}, keeping room alive for reconnection`);
      } else {
        // Player disconnected
        const room = roomManager.getRoom(result.roomCode);
        if (room && room.hostSocketId) {
          // Notify host that player disconnected
          io.to(room.hostSocketId).emit('playerDisconnected', result.playerId);
          
          // Remove from ready players
          if (room.readyPlayers) {
            room.readyPlayers.delete(result.playerId);
          }
          
          // End transcription session
          transcriptionManager.endSession(result.playerId);
        }
      }
    }
  });
});

// Cleanup old rooms every hour
setInterval(() => {
  roomManager.cleanupOldRooms();
}, 60 * 60 * 1000);

// Cleanup old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamp] of roomCreationLimiter.entries()) {
    if (now - timestamp > ROOM_CREATION_COOLDOWN) {
      roomCreationLimiter.delete(ip);
    }
  }
  console.log(`[CLEANUP] Rate limiter size: ${roomCreationLimiter.size} entries`);
}, 5 * 60 * 1000);

// Check for host disconnections to notify players (every 2 seconds)
setInterval(() => {
  const roomsToNotify = roomManager.getRoomsToNotifyHostDisconnect();
  for (const roomCode of roomsToNotify) {
    io.to(roomCode).emit('hostDisconnected');
    console.log(`Notifying players in room ${roomCode} of host disconnection after grace period`);
  }
}, 2000);

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});