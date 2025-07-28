'use client';

import { useState, useRef } from 'react';

export default function AudioTestPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testResults, setTestResults] = useState<string[]>([]);
  const [transcriptionStatus, setTranscriptionStatus] = useState<{
    configured: boolean;
    activeSessions: number;
    message: string;
    troubleshooting?: string[];
  } | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationIdRef = useRef<number | null>(null);

  const addResult = (message: string, isError = false) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [...prev, `${timestamp} ${isError ? '❌' : '✅'} ${message}`]);
  };

  const checkTranscriptionStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/transcription-status');
      const data = await response.json();
      setTranscriptionStatus(data);
      return data.configured;
    } catch {
      addResult('Failed to check transcription status', true);
      return false;
    }
  };

  const testAudioPipeline = async () => {
    setTestStatus('testing');
    setTestResults([]);
    
    // Step 1: Check API configuration
    addResult('Checking AssemblyAI configuration...');
    const isConfigured = await checkTranscriptionStatus();
    
    if (!isConfigured) {
      addResult('AssemblyAI API key not configured!', true);
      setTestStatus('error');
      return;
    }
    
    addResult('AssemblyAI is configured');
    
    // Step 2: Request microphone permission
    addResult('Requesting microphone permission...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });
      
      mediaStreamRef.current = stream;
      addResult('Microphone access granted');
      
      // Step 3: Set up audio visualization
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      // Monitor audio levels
      const updateAudioLevel = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(average / 255);
          animationIdRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };
      updateAudioLevel();
      
      setIsRecording(true);
      addResult('Audio capture started - Speak into your microphone!');
      
      // Step 4: Create test transcription session
      addResult('Creating test transcription session...');
      const testResponse = await fetch('http://localhost:3001/test-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const testData = await testResponse.json();
      if (testData.success) {
        addResult('Test session created successfully');
        addResult('Transcription is active for 30 seconds - try speaking!');
        setTestStatus('success');
      } else {
        addResult(`Failed to create test session: ${testData.message}`, true);
        setTestStatus('error');
      }
      
    } catch (error) {
      addResult(`Microphone access denied: ${error}`, true);
      setTestStatus('error');
    }
  };

  const stopRecording = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    setIsRecording(false);
    setAudioLevel(0);
    addResult('Audio capture stopped');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Audio Pipeline Test</h1>
        
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
          
          <div className="space-y-4">
            <button
              onClick={testAudioPipeline}
              disabled={testStatus === 'testing' || isRecording}
              className={`px-6 py-3 rounded font-semibold ${
                testStatus === 'testing' || isRecording
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {testStatus === 'testing' ? 'Testing...' : 'Start Audio Test'}
            </button>
            
            {isRecording && (
              <button
                onClick={stopRecording}
                className="px-6 py-3 bg-red-600 rounded font-semibold hover:bg-red-700"
              >
                Stop Recording
              </button>
            )}
          </div>
          
          {isRecording && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">Audio Level</span>
                <span className="text-sm">{Math.round(audioLevel * 100)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-green-500 h-3 rounded-full transition-all duration-100"
                  style={{ width: `${audioLevel * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {transcriptionStatus && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">AssemblyAI Status</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>API Key Configured:</span>
                <span className={transcriptionStatus.configured ? 'text-green-400' : 'text-red-400'}>
                  {transcriptionStatus.configured ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Active Sessions:</span>
                <span>{transcriptionStatus.activeSessions || 0}</span>
              </div>
              {!transcriptionStatus.configured && (
                <div className="mt-4 p-3 bg-yellow-900/50 rounded">
                  <p className="text-yellow-400 font-semibold mb-2">Setup Instructions:</p>
                  <ol className="text-yellow-300 text-xs space-y-1">
                    {transcriptionStatus.troubleshooting?.map((step: string, i: number) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>
          {testResults.length === 0 ? (
            <p className="text-gray-400">No test results yet. Click &quot;Start Audio Test&quot; to begin.</p>
          ) : (
            <div className="space-y-1 font-mono text-sm">
              {testResults.map((result, index) => (
                <div key={index} className={result.includes('❌') ? 'text-red-400' : 'text-green-400'}>
                  {result}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-blue-900/30 rounded-lg">
          <h3 className="font-semibold mb-2">How to test:</h3>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            <li>Click &quot;Start Audio Test&quot; to begin</li>
            <li>Allow microphone access when prompted</li>
            <li>Speak clearly into your microphone</li>
            <li>Check the backend console for transcript logs</li>
            <li>The test session will last for 30 seconds</li>
          </ol>
        </div>
      </div>
    </div>
  );
}