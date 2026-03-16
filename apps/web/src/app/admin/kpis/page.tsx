'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { BrandHero } from '@/components/brand/BrandHero'
import { useAuthStore, isRecruiter } from '@/lib/auth'
import { adminApi } from '@/lib/api'
import type { DashboardKpis } from '@/types'
import { Users, Briefcase, MessageSquare, CheckCircle, TrendingUp, Clock, Star, AlertCircle } from 'lucide-react'

export default function KpisPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const [kpis, setKpis] = useState<DashboardKpis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isRecruiter()) {
      router.push('/dashboard')
      return
    }

    loadKpis()
  }, [isHydrated, isAuthenticated, accessToken, router])

  const loadKpis = async () => {
    if (!accessToken) return
    try {
      const data = await adminApi.getDashboardKpis(accessToken)
      setKpis(data)
    } catch (err) {
      console.error('Error loading KPIs:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isHydrated || !isAuthenticated) return null

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Cargando KPIs...</div>
        </div>
      </AppShell>
    )
  }

  const formatPercent = (value: number | null) => {
    if (value === null) return '-'
    return `${(value * 100).toFixed(1)}%`
  }

  return (
    <AppShell>
      <BrandHero
        title="Dashboard de KPIs"
        subtitle="Métricas clave del sistema de reclutamiento"
        size="sm"
      />

      <div className="mt-6 space-y-6">
        {/* Main metrics */}
        <div className="grid md:grid-cols-4 gap-4">
          <BrandCard>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-bloque-gray50 rounded-lg">
                <Users className="h-6 w-6 text-bloque-navy900" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Candidatos</p>
                <p className="text-2xl font-bold text-bloque-navy900">
                  {kpis?.total_candidates || 0}
                </p>
              </div>
            </div>
          </BrandCard>

          <BrandCard>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-bloque-gray50 rounded-lg">
                <MessageSquare className="h-6 w-6 text-bloque-navy900" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Entrevistas Completadas</p>
                <p className="text-2xl font-bold text-bloque-navy900">
                  {kpis?.interviews_completed || 0}
                </p>
              </div>
            </div>
          </BrandCard>

          <BrandCard>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-bloque-gray50 rounded-lg">
                <Briefcase className="h-6 w-6 text-bloque-navy900" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Trabajos Activos</p>
                <p className="text-2xl font-bold text-bloque-navy900">
                  {kpis?.active_jobs || 0}
                </p>
              </div>
            </div>
          </BrandCard>

          <BrandCard>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-bloque-gray50 rounded-lg">
                <CheckCircle className="h-6 w-6 text-bloque-navy900" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contratados</p>
                <p className="text-2xl font-bold text-bloque-navy900">
                  {kpis?.candidates_hired || 0}
                </p>
              </div>
            </div>
          </BrandCard>
        </div>

        {/* Conversion rates */}
        <div className="grid md:grid-cols-3 gap-6">
          <BrandCard>
            <BrandCardHeader
              title="Tasa de Completado"
              description="Entrevistas completadas vs iniciadas"
            />
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-bloque-navy900">
                {formatPercent(kpis?.interview_completion_rate ?? null)}
              </p>
            </div>
          </BrandCard>

          <BrandCard>
            <BrandCardHeader
              title="Shortlist a Contacto"
              description="Candidatos contactados del shortlist"
            />
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-bloque-navy900">
                {formatPercent(kpis?.shortlist_to_contact_rate ?? null)}
              </p>
            </div>
          </BrandCard>

          <BrandCard>
            <BrandCardHeader
              title="Contacto a Contratación"
              description="Tasa de conversión a contratación"
            />
            <div className="flex items-center gap-4">
              <div className="p-3 bg-bloque-gold500/20 rounded-full">
                <CheckCircle className="h-6 w-6 text-bloque-gold500" />
              </div>
              <p className="text-3xl font-bold text-bloque-navy900">
                {formatPercent(kpis?.contact_to_hire_rate ?? null)}
              </p>
            </div>
          </BrandCard>
        </div>

        {/* Quality metrics */}
        <div className="grid md:grid-cols-2 gap-6">
          <BrandCard>
            <BrandCardHeader
              title="Métricas de Calidad"
              description="Indicadores de calidad del proceso"
            />
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Puntuación promedio
                </span>
                <span className="font-semibold text-bloque-navy900">
                  {kpis?.avg_interview_score?.toFixed(1) || '-'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Entrevistas flaggeadas
                </span>
                <span className="font-semibold text-bloque-navy900">
                  {kpis?.flagged_interviews_count || 0}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Overrides de score
                </span>
                <span className="font-semibold text-bloque-navy900">
                  {kpis?.score_overrides_count || 0}
                </span>
              </div>
            </div>
          </BrandCard>

          <BrandCard>
            <BrandCardHeader
              title="Funnel de Reclutamiento"
              description="Candidatos en cada etapa"
            />
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Con entrevista</span>
                <span className="font-semibold text-bloque-navy900">
                  {kpis?.candidates_with_interviews || 0}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">En shortlist</span>
                <span className="font-semibold text-bloque-navy900">
                  {kpis?.candidates_shortlisted || 0}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Contactados</span>
                <span className="font-semibold text-bloque-navy900">
                  {kpis?.candidates_contacted || 0}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">Contratados</span>
                <span className="font-semibold text-green-600">
                  {kpis?.candidates_hired || 0}
                </span>
              </div>
            </div>
          </BrandCard>
        </div>
      </div>
    </AppShell>
  )
}
