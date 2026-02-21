'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/auth'
import { FileText, Download } from 'lucide-react'

export default function EmployeeDocumentsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, user } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) router.push('/login')
  }, [isAuthenticated, router])

  if (!isAuthenticated) return null

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-bloque-navy900 mb-6">
          Mis Documentos
        </h1>

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
                onClick={() => {
                  if (accessToken && user) {
                    window.open(
                      `/api/eor/employees/${user.id}/contract?token=${accessToken}`,
                      '_blank'
                    )
                  }
                }}
              >
                <Download className="h-4 w-4 mr-1.5" />
                Descargar
              </Button>
            </div>
          </div>
        </BrandCard>
      </div>
    </AppShell>
  )
}
