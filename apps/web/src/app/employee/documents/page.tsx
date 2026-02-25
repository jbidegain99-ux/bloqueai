'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/auth'
import { FileText, Download, Loader2 } from 'lucide-react'

export default function EmployeeDocumentsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated, user } = useAuthStore()
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) router.push('/login')
  }, [isHydrated, isAuthenticated, router])

  const handleDownload = async () => {
    if (!accessToken || !user) return
    setDownloading(true)
    setError('')
    try {
      const res = await fetch(`/api/eor/employees/${user.id}/contract`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error('Error al descargar')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contrato-${user.full_name?.replace(/\s+/g, '-') ?? 'empleado'}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
    } catch {
      setError('Error al descargar el contrato')
    } finally {
      setDownloading(false)
    }
  }

  if (!isHydrated || !isAuthenticated) return null

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-bloque-navy900 mb-6">
          Mis Documentos
        </h1>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">
            {error}
          </div>
        )}

        <BrandCard>
          <BrandCardHeader
            title="Documentos Disponibles"
            description="Descarga tus contratos y certificados"
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                  <FileText className="h-5 w-5 text-brand-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-bloque-navy900">
                    Contrato de Trabajo
                  </p>
                  <p className="text-xs text-neutral-500">
                    Contrato individual de trabajo con Bloque S.A. de C.V.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={downloading}
                onClick={handleDownload}
              >
                {downloading ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Descargando...</>
                ) : (
                  <><Download className="h-4 w-4 mr-1.5" />Descargar</>
                )}
              </Button>
            </div>
          </div>
        </BrandCard>
      </div>
    </AppShell>
  )
}
