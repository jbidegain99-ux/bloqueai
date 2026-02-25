# Prompt 28: Video Interviews - UI de Sala de Video

## 🎯 Objetivo
Construir la interfaz de usuario para las entrevistas de video, incluyendo la sala de video, controles, estados y flujo completo del candidato.

## 📚 Antes de Comenzar
```bash
# OBLIGATORIO: Revisar documentación del proyecto
cat tasks/todo.md
cat tasks/lessons.md
```

## 🏗️ Componentes a Construir

```
apps/web/app/
├── (authenticated)/
│   ├── candidate/
│   │   └── interviews/
│   │       ├── page.tsx           # Lista de entrevistas del candidato
│   │       └── [id]/
│   │           └── page.tsx       # Sala de video
│   └── employer/
│       └── interviews/
│           ├── page.tsx           # Lista de entrevistas (employer view)
│           └── [id]/
│               ├── page.tsx       # Sala de video (observer mode)
│               └── results/
│                   └── page.tsx   # Resultados post-entrevista
├── components/
│   └── interview/
│       ├── VideoRoom.tsx          # Componente principal de video
│       ├── VideoControls.tsx      # Botones mic/cam/leave
│       ├── ParticipantTile.tsx    # Tile de video de participante
│       ├── InterviewStatus.tsx    # Estados: waiting, connected, ended
│       ├── PreJoinCheck.tsx       # Test de cámara/mic antes de unirse
│       ├── InterviewTimer.tsx     # Timer de duración
│       └── TranscriptPanel.tsx    # Panel de transcripción en tiempo real
```

## 📋 Tareas

### T28.1: Configuración de LiveKit React SDK

#### Archivo: `apps/web/lib/livekit.ts`

```typescript
/**
 * LiveKit configuration and utilities for video interviews.
 */
import { Room, RoomEvent, ConnectionState } from 'livekit-client';

export const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL!;

export interface InterviewRoom {
  roomName: string;
  token: string;
  livekitUrl: string;
}

/**
 * Fetch interview room details and token from API.
 */
export async function getInterviewRoom(interviewId: number): Promise<InterviewRoom> {
  const response = await fetch(`/api/interviews/${interviewId}/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to join interview');
  }
  
  return response.json();
}

/**
 * Start the AI interviewer for a room.
 */
export async function startInterviewer(interviewId: number): Promise<void> {
  const response = await fetch(`/api/interviews/${interviewId}/start`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to start interviewer');
  }
}

/**
 * Room connection state helpers.
 */
export function getConnectionStateLabel(state: ConnectionState): string {
  const labels: Record<ConnectionState, string> = {
    [ConnectionState.Disconnected]: 'Desconectado',
    [ConnectionState.Connecting]: 'Conectando...',
    [ConnectionState.Connected]: 'Conectado',
    [ConnectionState.Reconnecting]: 'Reconectando...',
  };
  return labels[state] || 'Desconocido';
}
```

### T28.2: Pre-Join Check Component

#### Archivo: `apps/web/components/interview/PreJoinCheck.tsx`

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, Mic, MicOff, Video, VideoOff, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PreJoinCheckProps {
  onReady: () => void;
  onCancel: () => void;
}

type DeviceStatus = 'checking' | 'ready' | 'error' | 'denied';

export function PreJoinCheck({ onReady, onCancel }: PreJoinCheckProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStatus, setCameraStatus] = useState<DeviceStatus>('checking');
  const [micStatus, setMicStatus] = useState<DeviceStatus>('checking');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);

  useEffect(() => {
    checkDevices();
    return () => {
      // Cleanup stream on unmount
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const checkDevices = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      setStream(mediaStream);
      setCameraStatus('ready');
      setMicStatus('ready');
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error: any) {
      console.error('Media device error:', error);
      
      if (error.name === 'NotAllowedError') {
        setCameraStatus('denied');
        setMicStatus('denied');
      } else {
        setCameraStatus('error');
        setMicStatus('error');
      }
    }
  };

  const toggleCamera = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const isReady = cameraStatus === 'ready' && micStatus === 'ready';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto p-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Preparar Entrevista</CardTitle>
          <CardDescription>
            Verifica que tu cámara y micrófono funcionen correctamente antes de comenzar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Video Preview */}
          <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${!isCameraOn ? 'hidden' : ''}`}
            />
            {!isCameraOn && (
              <div className="absolute inset-0 flex items-center justify-center">
                <VideoOff className="w-16 h-16 text-gray-500" />
              </div>
            )}
            
            {/* Device Controls Overlay */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              <Button
                variant={isMicOn ? 'default' : 'destructive'}
                size="icon"
                onClick={toggleMic}
                disabled={micStatus !== 'ready'}
              >
                {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>
              <Button
                variant={isCameraOn ? 'default' : 'destructive'}
                size="icon"
                onClick={toggleCamera}
                disabled={cameraStatus !== 'ready'}
              >
                {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>
            </div>
          </div>

          {/* Device Status */}
          <div className="grid grid-cols-2 gap-4">
            <DeviceStatusCard
              icon={Camera}
              label="Cámara"
              status={cameraStatus}
            />
            <DeviceStatusCard
              icon={Mic}
              label="Micrófono"
              status={micStatus}
            />
          </div>

          {/* Permissions Error */}
          {(cameraStatus === 'denied' || micStatus === 'denied') && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Debes permitir el acceso a la cámara y micrófono para continuar.
                Revisa los permisos en tu navegador e intenta de nuevo.
              </AlertDescription>
            </Alert>
          )}

          {/* Tips */}
          <div className="text-sm text-gray-500 space-y-1">
            <p>💡 <strong>Tips para una buena entrevista:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Busca un lugar tranquilo y bien iluminado</li>
              <li>Usa audífonos para mejor calidad de audio</li>
              <li>Cierra otras aplicaciones que usen la cámara</li>
              <li>Asegúrate de tener conexión a internet estable</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button onClick={onReady} disabled={!isReady}>
              {isReady ? 'Unirse a la Entrevista' : 'Verificando...'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function DeviceStatusCard({ 
  icon: Icon, 
  label, 
  status 
}: { 
  icon: typeof Camera; 
  label: string; 
  status: DeviceStatus;
}) {
  const statusConfig = {
    checking: { color: 'text-yellow-500', text: 'Verificando...' },
    ready: { color: 'text-green-500', text: 'Listo' },
    error: { color: 'text-red-500', text: 'Error' },
    denied: { color: 'text-red-500', text: 'Permiso denegado' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <Icon className="w-5 h-5 text-gray-600" />
      <div className="flex-1">
        <p className="font-medium text-sm">{label}</p>
        <p className={`text-xs ${config.color}`}>{config.text}</p>
      </div>
      {status === 'ready' && <CheckCircle className="w-5 h-5 text-green-500" />}
      {(status === 'error' || status === 'denied') && <AlertCircle className="w-5 h-5 text-red-500" />}
    </div>
  );
}
```

### T28.3: Video Room Component (usando LiveKit)

#### Archivo: `apps/web/components/interview/VideoRoom.tsx`

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useRoomContext,
  useParticipants,
  GridLayout,
  ParticipantTile,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track, RoomEvent } from 'livekit-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InterviewTimer } from './InterviewTimer';
import { TranscriptPanel } from './TranscriptPanel';

interface VideoRoomProps {
  token: string;
  serverUrl: string;
  roomName: string;
  interviewId: number;
  isCandidate: boolean;
  onLeave: () => void;
  onInterviewComplete: () => void;
}

export function VideoRoom({
  token,
  serverUrl,
  roomName,
  interviewId,
  isCandidate,
  onLeave,
  onInterviewComplete,
}: VideoRoomProps) {
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);

  const handleConnected = useCallback(() => {
    console.log('Connected to room:', roomName);
    setConnectionError(null);
  }, [roomName]);

  const handleError = useCallback((error: Error) => {
    console.error('Room error:', error);
    setConnectionError(error.message);
  }, []);

  const handleDisconnected = useCallback(() => {
    console.log('Disconnected from room');
    onLeave();
  }, [onLeave]);

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        video={isCandidate}
        audio={isCandidate}
        onConnected={handleConnected}
        onError={handleError}
        onDisconnected={handleDisconnected}
        data-lk-theme="default"
        className="flex-1 flex"
      >
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <InterviewHeader
            isStarted={isStarted}
            showTranscript={showTranscript}
            onToggleTranscript={() => setShowTranscript(!showTranscript)}
          />

          {/* Main Content */}
          <div className="flex-1 flex">
            {/* Video Area */}
            <div className="flex-1 relative">
              <AnimatePresence>
                {connectionError && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute top-4 left-4 right-4 z-10"
                  >
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Error de conexión</AlertTitle>
                      <AlertDescription>{connectionError}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              <CustomVideoGrid isCandidate={isCandidate} />
            </div>

            {/* Transcript Panel */}
            <AnimatePresence>
              {showTranscript && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 320, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="bg-gray-800 border-l border-gray-700"
                >
                  <TranscriptPanel interviewId={interviewId} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="bg-gray-800 border-t border-gray-700 p-4">
            <ControlBar
              variation="verbose"
              controls={{
                camera: isCandidate,
                microphone: isCandidate,
                screenShare: false,
                chat: false,
                leave: true,
              }}
            />
          </div>
        </div>

        <RoomAudioRenderer />
        <RoomEventHandler
          interviewId={interviewId}
          onInterviewComplete={onInterviewComplete}
        />
      </LiveKitRoom>
    </div>
  );
}

function InterviewHeader({
  isStarted,
  showTranscript,
  onToggleTranscript,
}: {
  isStarted: boolean;
  showTranscript: boolean;
  onToggleTranscript: () => void;
}) {
  return (
    <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-white font-semibold">Entrevista en Vivo</h1>
        {isStarted && <InterviewTimer />}
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleTranscript}
          className={`px-3 py-1.5 rounded text-sm transition-colors ${
            showTranscript
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {showTranscript ? 'Ocultar' : 'Mostrar'} Transcripción
        </button>
      </div>
    </div>
  );
}

function CustomVideoGrid({ isCandidate }: { isCandidate: boolean }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const participants = useParticipants();
  const hasAIInterviewer = participants.some(p => p.identity === 'ai-interviewer');

  return (
    <div className="h-full p-4">
      {participants.length === 0 && (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Conectando a la sala...</p>
          </div>
        </div>
      )}

      {participants.length > 0 && !hasAIInterviewer && isCandidate && (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Esperando al entrevistador IA...</p>
            <p className="text-gray-500 text-sm mt-2">Se unirá en unos momentos</p>
          </div>
        </div>
      )}

      <GridLayout tracks={tracks} className="h-full">
        <ParticipantTile />
      </GridLayout>
    </div>
  );
}

function RoomEventHandler({
  interviewId,
  onInterviewComplete,
}: {
  interviewId: number;
  onInterviewComplete: () => void;
}) {
  const room = useRoomContext();

  useEffect(() => {
    const handleDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        
        if (message.type === 'interview_complete') {
          onInterviewComplete();
        }
      } catch (e) {
        console.error('Error parsing room data:', e);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, onInterviewComplete]);

  return null;
}
```

### T28.4: Transcript Panel (Real-time)

#### Archivo: `apps/web/components/interview/TranscriptPanel.tsx`

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TranscriptEntry {
  id: string;
  speaker: 'candidate' | 'ai' | 'system';
  text: string;
  timestamp: Date;
}

interface TranscriptPanelProps {
  interviewId: number;
}

export function TranscriptPanel({ interviewId }: TranscriptPanelProps) {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  // WebSocket connection for real-time transcript
  useEffect(() => {
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}/interviews/${interviewId}/transcript`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'transcript') {
          setEntries((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              speaker: data.speaker,
              text: data.text,
              timestamp: new Date(data.timestamp),
            },
          ]);
        }
      } catch (e) {
        console.error('Error parsing transcript:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('Transcript WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [interviewId]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-white font-medium">Transcripción</h3>
        <p className="text-gray-400 text-xs mt-0.5">En tiempo real</p>
      </div>

      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {entries.length === 0 && (
            <div className="text-gray-500 text-sm text-center py-8">
              La transcripción aparecerá aquí cuando comience la conversación.
            </div>
          )}

          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs font-medium ${
                    entry.speaker === 'ai'
                      ? 'text-indigo-400'
                      : entry.speaker === 'candidate'
                      ? 'text-green-400'
                      : 'text-gray-400'
                  }`}
                >
                  {entry.speaker === 'ai'
                    ? '🤖 Entrevistador'
                    : entry.speaker === 'candidate'
                    ? '👤 Candidato'
                    : '⚙️ Sistema'}
                </span>
                <span className="text-gray-600 text-xs">
                  {entry.timestamp.toLocaleTimeString()}
                </span>
              </div>
              <p className="text-gray-300 text-sm">{entry.text}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}
```

### T28.5: Interview Timer

#### Archivo: `apps/web/components/interview/InterviewTimer.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export function InterviewTimer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-full">
      <Clock className="w-4 h-4 text-red-400" />
      <span className="text-white text-sm font-mono">{formatTime(seconds)}</span>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
      </span>
    </div>
  );
}
```

### T28.6: Candidate Interview Page

#### Archivo: `apps/web/app/(authenticated)/candidate/interviews/[id]/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { PreJoinCheck } from '@/components/interview/PreJoinCheck';
import { VideoRoom } from '@/components/interview/VideoRoom';
import { getInterviewRoom, startInterviewer, InterviewRoom } from '@/lib/livekit';

type InterviewState = 'loading' | 'pre-join' | 'in-room' | 'completed' | 'error';

export default function CandidateInterviewPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = Number(params.id);

  const [state, setState] = useState<InterviewState>('loading');
  const [roomInfo, setRoomInfo] = useState<InterviewRoom | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInterview();
  }, [interviewId]);

  const loadInterview = async () => {
    try {
      setState('loading');
      const room = await getInterviewRoom(interviewId);
      setRoomInfo(room);
      setState('pre-join');
    } catch (err: any) {
      setError(err.message);
      setState('error');
    }
  };

  const handleReady = async () => {
    if (!roomInfo) return;

    try {
      // Join the room
      setState('in-room');

      // Start the AI interviewer
      await startInterviewer(interviewId);
    } catch (err: any) {
      setError(err.message);
      setState('error');
    }
  };

  const handleLeave = () => {
    router.push('/candidate/interviews');
  };

  const handleComplete = () => {
    setState('completed');
    // Redirect to results or thank you page after delay
    setTimeout(() => {
      router.push(`/candidate/interviews/${interviewId}/complete`);
    }, 2000);
  };

  // Loading state
  if (state === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-white">Cargando entrevista...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">😕</span>
          </div>
          <h2 className="text-white text-xl font-semibold mb-2">Error al cargar</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/candidate/interviews')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Volver a mis entrevistas
          </button>
        </div>
      </div>
    );
  }

  // Pre-join check
  if (state === 'pre-join') {
    return (
      <div className="min-h-screen bg-gray-900 py-8">
        <PreJoinCheck
          onReady={handleReady}
          onCancel={() => router.push('/candidate/interviews')}
        />
      </div>
    );
  }

  // In room
  if (state === 'in-room' && roomInfo) {
    return (
      <VideoRoom
        token={roomInfo.token}
        serverUrl={roomInfo.livekitUrl}
        roomName={roomInfo.roomName}
        interviewId={interviewId}
        isCandidate={true}
        onLeave={handleLeave}
        onInterviewComplete={handleComplete}
      />
    );
  }

  // Completed
  if (state === 'completed') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🎉</span>
          </div>
          <h2 className="text-white text-2xl font-semibold mb-2">
            ¡Entrevista completada!
          </h2>
          <p className="text-gray-400">
            Gracias por tu tiempo. Te redirigiremos en un momento...
          </p>
        </motion.div>
      </div>
    );
  }

  return null;
}
```

### T28.7: Candidate Interview List Page

#### Archivo: `apps/web/app/(authenticated)/candidate/interviews/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { format, formatDistanceToNow, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';
import { Video, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Interview {
  id: number;
  job_title: string;
  company_name: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_at: string;
}

export default function CandidateInterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInterviews();
  }, []);

  const fetchInterviews = async () => {
    try {
      const response = await fetch('/api/candidate/interviews', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      setInterviews(data.interviews || []);
    } catch (error) {
      console.error('Error fetching interviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: Interview['status'], scheduledAt: string) => {
    const isUpcoming = isFuture(new Date(scheduledAt));
    
    const configs = {
      scheduled: {
        color: isUpcoming ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700',
        icon: isUpcoming ? Calendar : Clock,
        text: isUpcoming ? 'Programada' : 'Pendiente',
      },
      in_progress: {
        color: 'bg-green-100 text-green-700',
        icon: Video,
        text: 'En progreso',
      },
      completed: {
        color: 'bg-gray-100 text-gray-700',
        icon: CheckCircle,
        text: 'Completada',
      },
      cancelled: {
        color: 'bg-red-100 text-red-700',
        icon: AlertCircle,
        text: 'Cancelada',
      },
    };

    const config = configs[status];
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {config.text}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Mis Entrevistas</h1>
        <p className="text-gray-600 mt-1">
          Entrevistas de video programadas y completadas
        </p>
      </div>

      {interviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No tienes entrevistas programadas
            </h3>
            <p className="text-gray-500 mb-4">
              Cuando un empleador te invite a una entrevista, aparecerá aquí.
            </p>
            <Link href="/candidate/jobs">
              <Button>Explorar trabajos</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {interviews.map((interview, index) => (
            <motion.div
              key={interview.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">
                          {interview.job_title}
                        </h3>
                        {getStatusBadge(interview.status, interview.scheduled_at)}
                      </div>
                      <p className="text-gray-600">{interview.company_name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {isFuture(new Date(interview.scheduled_at)) ? (
                          <>
                            Programada para{' '}
                            {format(new Date(interview.scheduled_at), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}
                          </>
                        ) : (
                          <>
                            {formatDistanceToNow(new Date(interview.scheduled_at), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {interview.status === 'completed' ? (
                        <Link href={`/candidate/interviews/${interview.id}/results`}>
                          <Button variant="outline">Ver resultados</Button>
                        </Link>
                      ) : interview.status === 'scheduled' || interview.status === 'in_progress' ? (
                        <Link href={`/candidate/interviews/${interview.id}`}>
                          <Button>
                            <Video className="w-4 h-4 mr-2" />
                            {interview.status === 'in_progress' ? 'Continuar' : 'Unirse'}
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## ✅ Checklist Final Prompt 28

### Componentes Creados
- [ ] `lib/livekit.ts` - Utilidades y configuración
- [ ] `PreJoinCheck.tsx` - Test de dispositivos pre-entrevista
- [ ] `VideoRoom.tsx` - Sala de video principal
- [ ] `TranscriptPanel.tsx` - Transcripción en tiempo real
- [ ] `InterviewTimer.tsx` - Timer de duración
- [ ] Página de entrevista candidato `[id]/page.tsx`
- [ ] Página de lista de entrevistas `interviews/page.tsx`

### Verificación
- [ ] Pre-join check muestra preview de video
- [ ] Botones de mic/cam funcionan en pre-join
- [ ] VideoRoom conecta a LiveKit sin errores
- [ ] Timer cuenta correctamente
- [ ] Animaciones funcionan (Framer Motion)
- [ ] Responsive en móvil

### Estilos
- [ ] Tema oscuro consistente
- [ ] Componentes shadcn/ui integrados
- [ ] Estados de loading y error manejados

---

## 📝 Actualizar Documentación

### tasks/todo.md
```markdown
## Video Interviews - UI
- [x] T28.1: Configuración LiveKit React SDK
- [x] T28.2: Pre-Join Check Component
- [x] T28.3: Video Room Component
- [x] T28.4: Transcript Panel
- [x] T28.5: Interview Timer
- [x] T28.6: Candidate Interview Page
- [x] T28.7: Candidate Interview List
```

---

## 🚀 Siguiente Prompt
Una vez completado, continuar con **Prompt 29: Análisis Post-Entrevista con IA**
