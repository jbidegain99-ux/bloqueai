'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { ArrowRight, Info } from 'lucide-react'

/**
 * Legacy route - Interviews are now accessed through job applications.
 * If job_id is provided, redirect to the apply flow.
 * Otherwise, show info message.
 */
export default function LegacyInterviewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const jobId = searchParams.get('job_id')

  useEffect(() => {
    // If job_id is provided, redirect to the apply flow
    if (jobId) {
      router.replace(`/candidate/apply/${jobId}`)
    }
  }, [jobId, router])

  // If job_id provided, show loading while redirecting
  if (jobId) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Redirigiendo a la aplicacion...</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <BrandCard>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-bloque-gold500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Info className="h-8 w-8 text-bloque-gold500" />
            </div>
            <h1 className="text-xl font-semibold text-bloque-navy900 mb-2">
              Entrevistas por puesto
            </h1>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Las entrevistas ahora se realizan como parte del proceso de aplicacion
              a un puesto especifico. Esto permite que la entrevista sea personalizada
              segun los requisitos del puesto.
            </p>
            <div className="space-y-4">
              <div className="bg-bloque-gray50 p-4 rounded-lg text-left max-w-md mx-auto">
                <h3 className="font-medium text-bloque-navy900 mb-2">Nuevo flujo:</h3>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Explora los puestos disponibles</li>
                  <li>Selecciona uno y haz clic en &quot;Aplicar&quot;</li>
                  <li>Sube tu CV para analisis</li>
                  <li>Si tu perfil hace match (≥70%), podras iniciar la entrevista</li>
                </ol>
              </div>
              <Button
                onClick={() => router.push('/candidate/jobs')}
                className="w-full sm:w-auto"
              >
                Explorar puestos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </BrandCard>
      </div>
    </AppShell>
  )
}
