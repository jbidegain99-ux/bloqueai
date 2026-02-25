'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Camera,
  Mic,
  MicOff,
  Video,
  VideoOff,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'

interface PreJoinCheckProps {
  onReady: () => void
  onCancel: () => void
}

type DeviceStatus = 'checking' | 'ready' | 'error' | 'denied'

export function PreJoinCheck({ onReady, onCancel }: PreJoinCheckProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraStatus, setCameraStatus] = useState<DeviceStatus>('checking')
  const [micStatus, setMicStatus] = useState<DeviceStatus>('checking')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [isMicOn, setIsMicOn] = useState(true)

  const checkDevices = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })

      setStream(mediaStream)
      setCameraStatus('ready')
      setMicStatus('ready')

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (err: unknown) {
      const errorName = err instanceof DOMException ? err.name : ''

      if (errorName === 'NotAllowedError') {
        setCameraStatus('denied')
        setMicStatus('denied')
      } else {
        setCameraStatus('error')
        setMicStatus('error')
      }
    }
  }, [])

  useEffect(() => {
    checkDevices()
    return () => {
      // Cleanup stream on unmount
      stream?.getTracks().forEach((track) => track.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleCamera = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsCameraOn(videoTrack.enabled)
      }
    }
  }

  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMicOn(audioTrack.enabled)
      }
    }
  }

  const handleJoin = () => {
    // Stop the preview stream before joining LiveKit room
    stream?.getTracks().forEach((track) => track.stop())
    onReady()
  }

  const isReady = cameraStatus === 'ready' && micStatus === 'ready'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto p-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Preparar Entrevista</CardTitle>
          <CardDescription>
            Verifica que tu camara y microfono funcionen correctamente antes de
            comenzar.
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
                aria-label={isMicOn ? 'Silenciar microfono' : 'Activar microfono'}
              >
                {isMicOn ? (
                  <Mic className="w-5 h-5" />
                ) : (
                  <MicOff className="w-5 h-5" />
                )}
              </Button>
              <Button
                variant={isCameraOn ? 'default' : 'destructive'}
                size="icon"
                onClick={toggleCamera}
                disabled={cameraStatus !== 'ready'}
                aria-label={isCameraOn ? 'Apagar camara' : 'Encender camara'}
              >
                {isCameraOn ? (
                  <Video className="w-5 h-5" />
                ) : (
                  <VideoOff className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>

          {/* Device Status */}
          <div className="grid grid-cols-2 gap-4">
            <DeviceStatusCard
              icon={Camera}
              label="Camara"
              status={cameraStatus}
            />
            <DeviceStatusCard
              icon={Mic}
              label="Microfono"
              status={micStatus}
            />
          </div>

          {/* Permissions Error */}
          {(cameraStatus === 'denied' || micStatus === 'denied') && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">
                Debes permitir el acceso a la camara y microfono para continuar.
                Revisa los permisos en tu navegador e intenta de nuevo.
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="text-sm text-gray-500 space-y-1">
            <p className="font-medium text-gray-700">
              Tips para una buena entrevista:
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Busca un lugar tranquilo y bien iluminado</li>
              <li>Usa audifonos para mejor calidad de audio</li>
              <li>Cierra otras aplicaciones que usen la camara</li>
              <li>Asegurate de tener conexion a internet estable</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button onClick={handleJoin} disabled={!isReady}>
              {isReady ? 'Unirse a la Entrevista' : 'Verificando...'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function DeviceStatusCard({
  icon: Icon,
  label,
  status,
}: {
  icon: typeof Camera
  label: string
  status: DeviceStatus
}) {
  const statusConfig: Record<
    DeviceStatus,
    { color: string; text: string }
  > = {
    checking: { color: 'text-yellow-500', text: 'Verificando...' },
    ready: { color: 'text-green-500', text: 'Listo' },
    error: { color: 'text-red-500', text: 'Error' },
    denied: { color: 'text-red-500', text: 'Permiso denegado' },
  }

  const config = statusConfig[status]

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <Icon className="w-5 h-5 text-gray-600" />
      <div className="flex-1">
        <p className="font-medium text-sm">{label}</p>
        <p className={`text-xs ${config.color}`}>{config.text}</p>
      </div>
      {status === 'ready' && (
        <CheckCircle className="w-5 h-5 text-green-500" />
      )}
      {(status === 'error' || status === 'denied') && (
        <AlertCircle className="w-5 h-5 text-red-500" />
      )}
    </div>
  )
}
