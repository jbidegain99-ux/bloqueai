'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth'

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard')
    } else {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  return (
    <div className="min-h-screen flex items-center justify-center brand-gradient">
      <div className="text-center text-white">
        <div className="animate-pulse">
          <h1 className="text-4xl font-bold mb-4">TalentOS</h1>
          <p className="text-bloque-slate200">Cargando...</p>
        </div>
      </div>
    </div>
  )
}
