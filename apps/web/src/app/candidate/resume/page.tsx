'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { ArrowRight, Info } from 'lucide-react'

/**
 * Legacy route - CV upload is now part of the job application flow.
 * This page redirects users to the jobs listing.
 */
export default function LegacyResumePage() {
  const router = useRouter()

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <BrandCard>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-bloque-gold500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Info className="h-8 w-8 text-bloque-gold500" />
            </div>
            <h1 className="text-xl font-semibold text-bloque-navy900 mb-2">
              Flujo actualizado
            </h1>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Ahora la carga de CV se realiza al aplicar a un puesto especifico.
              Esto nos permite analizar tu perfil contra los requisitos del puesto
              y darte recomendaciones personalizadas.
            </p>
            <div className="space-y-3">
              <Button
                onClick={() => router.push('/candidate/jobs')}
                className="w-full sm:w-auto"
              >
                Explorar puestos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-xs text-muted-foreground">
                Selecciona un puesto y haz clic en &quot;Aplicar&quot; para subir tu CV
              </p>
            </div>
          </div>
        </BrandCard>
      </div>
    </AppShell>
  )
}
