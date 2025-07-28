import { AssemblyAI, StreamingTranscriber } from 'assemblyai';
import { EventEmitter } from 'events';

interface TranscriptionSession {
  playerId: string;
  roomCode: string;
  transcriber: StreamingTranscriber;
  isConnected: boolean;
  connectionAttempts: number;
}

export interface TranscriptEvent {
  playerId: string;
  roomCode: string;
  text: string;
  confidence: number;
  timestamp: Date;
  eventId?: string; // Add unique ID for debugging
  isPartial?: boolean; // Flag to indicate partial transcript
}

export class TranscriptionManager extends EventEmitter {
  private client: AssemblyAI;
  private sessions: Map<string, TranscriptionSession> = new Map();
  private audioChunkCount: Map<string, number> = new Map();
  private recentTranscripts: Map<string, { text: string; timestamp: number }> = new Map();

  constructor(apiKey: string) {
    super();
    if (!apiKey || apiKey === 'your_assemblyai_api_key_here') {
      console.error('WARNING: AssemblyAI API key not configured! Audio transcription will not work.');
      console.error('Please set ASSEMBLYAI_API_KEY in your backend/.env file');
    }
    this.client = new AssemblyAI({ apiKey });
  }

  async createSession(playerId: string, roomCode: string): Promise<void> {
    // Check if session already exists
    if (this.sessions.has(playerId)) {
      console.warn(`Transcription session already exists for player ${playerId}`);
      return;
    }

    // Check if API key is valid
    if (!process.env.ASSEMBLYAI_API_KEY || process.env.ASSEMBLYAI_API_KEY === 'your_assemblyai_api_key_here') {
      console.error(`Cannot create transcription session - API key not configured`);
      this.emit('error', { 
        playerId, 
        error: new Error('AssemblyAI API key not configured') 
      });
      return;
    }

    try {
      console.log(`Creating transcription session for player ${playerId}...`);
      
      // Log API key status
      const apiKeyLength = process.env.ASSEMBLYAI_API_KEY ? process.env.ASSEMBLYAI_API_KEY.length : 0;
      console.log(`API key status: ${apiKeyLength > 10 ? 'Present' : 'Missing/Invalid'} (length: ${apiKeyLength})`);
      
      const transcriber = this.client.streaming.transcriber({
        sampleRate: 16000,
        formatTurns: true, // Enable formatting like in the sample
        encoding: 'pcm_s16le'
        // Note: endUtteranceSilenceThreshold may not be available in this SDK version
      });
      
      console.log(`Transcriber created, attempting to connect...`);
      
      // Store session immediately so audio can queue
      const newSession = {
        playerId,
        roomCode,
        transcriber,
        isConnected: false,
        connectionAttempts: 0
      };

      // Set up event handlers
      transcriber.on('open', ({ id }: any) => {
        console.log(`✅ Session opened for player ${playerId} with ID: ${id}`);
        
        // Mark session as connected
        const session = this.sessions.get(playerId);
        if (session) {
          session.isConnected = true;
        }
        
        // Emit a session ready event
        this.emit('sessionReady', { playerId, sessionId: id });
      });

      // Handle turn events (main transcript event in SDK v4)
      transcriber.on('turn', (turn: any) => {
        console.log(`[${playerId}] Turn received:`, {
          transcript: turn.transcript,
          timestamp: Date.now()
        });
        
        // Check if turn has transcript
        if (!turn.transcript) {
          return;
        }
        
        const now = Date.now();
        const eventId = `${playerId}_${now}_${Math.random().toString(36).substr(2, 9)}`;
        const event: TranscriptEvent = {
          playerId,
          roomCode,
          text: turn.transcript,
          confidence: 0.9, // Default confidence
          timestamp: new Date(),
          eventId
        };
        
        console.log(`[${playerId}] Emitting transcript event [${eventId}]: "${turn.transcript}"`);
        this.emit('transcript', event);
      });

      transcriber.on('error', (error: Error) => {
        console.error(`Transcription error for player ${playerId}:`, error);
        this.emit('error', { playerId, error });
      });

      transcriber.on('close', (code: number, reason: string) => {
        console.log(`❌ Transcription session closed for player ${playerId}: ${code} - ${reason}`);
        
        // Mark session as disconnected
        const session = this.sessions.get(playerId);
        if (session) {
          session.isConnected = false;
        }
        
        this.sessions.delete(playerId);
        this.audioChunkCount.delete(playerId);
      });

      // Store session BEFORE attempting connection
      this.sessions.set(playerId, newSession);
      
      // Connect to AssemblyAI with retry logic
      let retries = 3;
      let connected = false;
      
      while (retries > 0 && !connected) {
        try {
          console.log(`Attempting to connect to AssemblyAI (attempt ${4 - retries}/3)...`);
          await transcriber.connect();
          connected = true;
          console.log(`Successfully connected to AssemblyAI streaming service`);
          
          // Update session connection attempts
          newSession.connectionAttempts = 4 - retries;
          break;
        } catch (connectError: any) {
          retries--;
          console.error(`Failed to connect to AssemblyAI (${3 - retries}/3):`, connectError);
          console.error(`Error details:`, {
            message: connectError.message,
            code: connectError.code,
            name: connectError.name
          });
          
          if (retries === 0) {
            // Remove session if connection fails
            this.sessions.delete(playerId);
            throw connectError;
          }
          // Wait before retry
          console.log(`Waiting 1 second before retry...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!connected) {
        this.sessions.delete(playerId);
        throw new Error('Failed to connect to AssemblyAI after all retries');
      }

      console.log(`Successfully created transcription session for player ${playerId} in room ${roomCode}`);
      console.log(`Total active sessions: ${this.sessions.size}`);
    } catch (error) {
      console.error(`Failed to create transcription session for player ${playerId}:`, error);
      this.emit('error', { playerId, error });
      throw error;
    }
  }

  sendAudio(playerId: string, audioData: ArrayBuffer): void {
    const session = this.sessions.get(playerId);
    if (!session) {
      console.warn(`No transcription session found for player ${playerId}`);
      return;
    }
    
    if (!session.isConnected) {
      // Don't warn every time - just skip silently while connecting
      return;
    }

    try {
      // Convert ArrayBuffer to Buffer for AssemblyAI
      const buffer = Buffer.from(audioData);
      
      // Track chunk count
      const chunkCount = (this.audioChunkCount.get(playerId) || 0) + 1;
      this.audioChunkCount.set(playerId, chunkCount);
      
      // Debug first chunk and every 100th chunk
      if (chunkCount === 1 || chunkCount % 100 === 0) {
        console.log(`[${playerId}] Audio chunk #${chunkCount}:`);
        console.log(`  - Size: ${buffer.length} bytes`);
        
        // Log first few bytes as hex for debugging
        if (chunkCount === 1 && buffer.length >= 16) {
          const hexBytes = Array.from(buffer.slice(0, 16))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ');
          console.log(`  - First 16 bytes (hex): ${hexBytes}`);
          
          // Check if it looks like PCM data
          const int16View = new Int16Array(buffer.buffer, buffer.byteOffset, Math.min(8, buffer.length / 2));
          console.log(`  - First 8 samples (int16): ${Array.from(int16View).join(', ')}`);
        }
      }
      
      session.transcriber.sendAudio(buffer);
    } catch (error) {
      console.error(`Failed to send audio for player ${playerId}:`, error);
      this.emit('error', { playerId, error });
    }
  }

  async endSession(playerId: string): Promise<void> {
    const session = this.sessions.get(playerId);
    if (!session) {
      return;
    }

    try {
      await session.transcriber.close();
      this.sessions.delete(playerId);
      this.audioChunkCount.delete(playerId);
      // Clean up recent transcripts for this player
      for (const key of this.recentTranscripts.keys()) {
        if (key.startsWith(playerId)) {
          this.recentTranscripts.delete(key);
        }
      }
      console.log(`Ended transcription session for player ${playerId}`);
    } catch (error) {
      console.error(`Error ending session for player ${playerId}:`, error);
    }
  }

  async endAllSessions(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const [playerId] of this.sessions) {
      promises.push(this.endSession(playerId));
    }

    await Promise.all(promises);
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  hasSession(playerId: string): boolean {
    return this.sessions.has(playerId);
  }
}