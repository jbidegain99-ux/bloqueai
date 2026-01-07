'use client'

import React, { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Bot, Video, VideoOff } from 'lucide-react'

interface VideoAvatarProps {
  enabled?: boolean
  isSpeaking?: boolean
  className?: string
}

/**
 * Video Avatar component for AI interviewer.
 *
 * This is a placeholder component for future AI video avatar integration
 * (e.g., HeyGen, D-ID, or similar services).
 *
 * To enable:
 * 1. Set NEXT_PUBLIC_AVATAR_ENABLED=true
 * 2. Implement WebRTC/WebSocket connection to avatar provider
 * 3. Replace placeholder with actual video stream
 */
export function VideoAvatar({
  enabled = false,
  isSpeaking = false,
  className
}: VideoAvatarProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (!enabled) return

    // TODO: Implement WebRTC/WebSocket connection to avatar provider
    // This would connect to HeyGen/D-ID streaming API
    // and display the avatar video stream

    const initializeAvatar = async () => {
      try {
        // Placeholder: In real implementation, this would:
        // 1. Call API to initialize avatar session
        // 2. Receive WebRTC offer/answer
        // 3. Set up video stream
        console.log('[VideoAvatar] Avatar enabled but not yet implemented')
        setIsConnected(false)
      } catch (error) {
        console.error('[VideoAvatar] Failed to initialize:', error)
        setHasError(true)
      }
    }

    initializeAvatar()

    return () => {
      // Cleanup: Close WebRTC connection
    }
  }, [enabled])

  // If avatar is not enabled, show static avatar placeholder
  if (!enabled) {
    return (
      <div
        className={cn(
          'relative flex items-center justify-center',
          'w-32 h-32 rounded-full',
          'bg-gradient-to-br from-bloque-navy700 to-bloque-navy900',
          'border-4 border-bloque-gold500/30',
          isSpeaking && 'animate-pulse',
          className
        )}
      >
        <Bot className="h-16 w-16 text-white/80" />
        {isSpeaking && (
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-bloque-gold500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-bloque-gold500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-bloque-gold500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>
    )
  }

  // Error state
  if (hasError) {
    return (
      <div
        className={cn(
          'relative flex flex-col items-center justify-center',
          'w-32 h-32 rounded-full',
          'bg-red-50 border-4 border-red-200',
          className
        )}
      >
        <VideoOff className="h-12 w-12 text-red-400" />
        <span className="text-xs text-red-500 mt-1">Error</span>
      </div>
    )
  }

  // Connecting/loading state
  if (!isConnected) {
    return (
      <div
        className={cn(
          'relative flex flex-col items-center justify-center',
          'w-32 h-32 rounded-full',
          'bg-bloque-gray50 border-4 border-bloque-slate200',
          className
        )}
      >
        <Video className="h-12 w-12 text-bloque-navy700 animate-pulse" />
        <span className="text-xs text-muted-foreground mt-1">Conectando...</span>
      </div>
    )
  }

  // Connected: Video stream
  return (
    <div
      className={cn(
        'relative overflow-hidden',
        'w-32 h-32 rounded-full',
        'border-4 border-bloque-gold500',
        isSpeaking && 'ring-4 ring-bloque-gold500/30 ring-offset-2',
        className
      )}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className="w-full h-full object-cover"
      />
      {isSpeaking && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-bloque-gold500 animate-pulse" />
      )}
    </div>
  )
}

/**
 * Larger video avatar for interview header/hero
 */
export function VideoAvatarLarge({
  enabled = false,
  isSpeaking = false,
  className
}: VideoAvatarProps) {
  return (
    <VideoAvatar
      enabled={enabled}
      isSpeaking={isSpeaking}
      className={cn('w-48 h-48', className)}
    />
  )
}

/**
 * Small inline avatar for chat messages
 */
export function VideoAvatarSmall({
  enabled = false,
  isSpeaking = false,
  className
}: VideoAvatarProps) {
  return (
    <VideoAvatar
      enabled={enabled}
      isSpeaking={isSpeaking}
      className={cn('w-10 h-10', className)}
    />
  )
}
