'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { BrandHero } from '@/components/brand/BrandHero'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore, isEmployer } from '@/lib/auth'
import { employerApi } from '@/lib/api'
import {
  Briefcase,
  Users,
  UserCheck,
  ClipboardList,
  Plus,
  ChevronRight,
  TrendingUp,
  Clock,
  AlertTriangle
} from 'lucide-react'

interface DashboardStats {
  totalJobs: number
  activeJobs: number
  totalShortlisted: number
  pendingReviews: number
}

export default function EmployerDashboardPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, user } = useAuthStore()
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    activeJobs: 0,
    totalShortlisted: 0,
    pendingReviews: 0,
  })
  const [recentJobs, setRecentJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isEmployer()) {
      router.push('/dashboard')
      return
    }

    loadDashboardData()
  }, [isAuthenticated, accessToken, router])

  const loadDashboardData = async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)

    try {
      // Load jobs to calculate stats
      const jobsData = await employerApi.getJobs(accessToken) as any
      const jobs = jobsData.items || []

      // Calculate stats
      const activeJobs = jobs.filter((j: any) => j.status === 'ACTIVE').length
      let totalShortlisted = 0
      let pendingReviews = 0

      jobs.forEach((job: any) => {
        totalShortlisted += job.shortlist_count || 0
      })

      setStats({
        totalJobs: jobs.length,
        activeJobs,
        totalShortlisted,
        pendingReviews,
      })

      // Get recent jobs (last 5)
      setRecentJobs(jobs.slice(0, 5))
    } catch (err: any) {
      console.error('Error loading dashboard:', err)
      setError(err?.message || 'Error al cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Activo</Badge>
      case 'DRAFT':
        return <Badge variant="outline">Borrador</Badge>
      case 'PAUSED':
        return <Badge variant="warning">Pausado</Badge>
      case 'CLOSED':
        return <Badge variant="secondary">Cerrado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (!isAuthenticated) return null

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Cargando dashboard...</div>
        </div>
      </AppShell>
    )
  }

  if (error) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-64">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadDashboardData} variant="outline">
            Reintentar
          </Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <BrandHero
        title={`Hola, ${user?.full_name?.split(' ')[0] || 'Empleador'}`}
        subtitle="Bienvenido a tu panel de reclutamiento"
        size="sm"
      >
        <Link href="/employer/jobs/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nueva vacante
          </Button>
        </Link>
      </BrandHero>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <BrandCard>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Briefcase className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-bloque-navy900">{stats.totalJobs}</p>
              <p className="text-xs text-muted-foreground">Total Vacantes</p>
            </div>
          </div>
        </BrandCard>

        <BrandCard>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-bloque-navy900">{stats.activeJobs}</p>
              <p className="text-xs text-muted-foreground">Vacantes Activas</p>
            </div>
          </div>
        </BrandCard>

        <BrandCard>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <UserCheck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-bloque-navy900">{stats.totalShortlisted}</p>
              <p className="text-xs text-muted-foreground">En Shortlists</p>
            </div>
          </div>
        </BrandCard>

        <BrandCard>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-bloque-navy900">{stats.pendingReviews}</p>
              <p className="text-xs text-muted-foreground">Por Revisar</p>
            </div>
          </div>
        </BrandCard>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <Link href="/employer/jobs">
          <BrandCard hover className="cursor-pointer h-full">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-bloque-gray50 rounded-lg">
                <Briefcase className="h-6 w-6 text-bloque-navy900" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-bloque-navy900">Mis Vacantes</h3>
                <p className="text-sm text-muted-foreground">Gestiona tus posiciones abiertas</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </BrandCard>
        </Link>

        <Link href="/employer/shortlists">
          <BrandCard hover className="cursor-pointer h-full">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-bloque-gray50 rounded-lg">
                <ClipboardList className="h-6 w-6 text-bloque-navy900" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-bloque-navy900">Shortlists</h3>
                <p className="text-sm text-muted-foreground">Revisa candidatos preseleccionados</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </BrandCard>
        </Link>

        <Link href="/employer/jobs/new">
          <BrandCard hover className="cursor-pointer h-full">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-bloque-gold500/20 rounded-lg">
                <Plus className="h-6 w-6 text-bloque-gold600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-bloque-navy900">Nueva Vacante</h3>
                <p className="text-sm text-muted-foreground">Publica una nueva posicion</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </BrandCard>
        </Link>
      </div>

      {/* Recent Jobs */}
      <div className="mt-6">
        <BrandCard>
          <BrandCardHeader
            title="Vacantes Recientes"
            description="Tus ultimas posiciones publicadas"
          />

          {recentJobs.length === 0 ? (
            <div className="text-center py-8">
              <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">
                No tienes vacantes creadas aun
              </p>
              <Link href="/employer/jobs/new">
                <Button>Crear tu primera vacante</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <Link key={job.id} href={`/employer/jobs/${job.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg border hover:border-bloque-navy900/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div>
                        <h4 className="font-medium text-bloque-navy900">{job.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {job.location || 'Sin ubicacion'} • {job.shortlist_count || 0} candidatos
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(job.status)}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}

              {recentJobs.length > 0 && (
                <Link href="/employer/jobs">
                  <Button variant="outline" className="w-full mt-2">
                    Ver todas las vacantes
                  </Button>
                </Link>
              )}
            </div>
          )}
        </BrandCard>
      </div>
    </AppShell>
  )
}
