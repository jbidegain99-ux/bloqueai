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
import { Plus, Users, MapPin, DollarSign, Clock, ChevronRight } from 'lucide-react'

export default function JobsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isEmployer()) {
      router.push('/dashboard')
      return
    }

    loadJobs()
  }, [isHydrated, isAuthenticated, accessToken, router])

  const loadJobs = async () => {
    if (!accessToken) return
    try {
      const data = await employerApi.getJobs(accessToken)
      setJobs((data as any).items || [])
    } catch (err) {
      console.error('Error loading jobs:', err)
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

  if (!isHydrated || !isAuthenticated) return null

  return (
    <AppShell>
      <BrandHero
        title="Mis Vacantes"
        subtitle="Gestiona tus posiciones abiertas y encuentra el mejor talento"
        size="sm"
      >
        <Link href="/employer/jobs/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nueva vacante
          </Button>
        </Link>
      </BrandHero>

      <div className="mt-6 space-y-4">
        {loading ? (
          <BrandCard>
            <div className="text-center py-8 text-muted-foreground">
              Cargando vacantes...
            </div>
          </BrandCard>
        ) : jobs.length === 0 ? (
          <BrandCard>
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No tienes vacantes creadas aún
              </p>
              <Link href="/employer/jobs/new">
                <Button>Crear tu primera vacante</Button>
              </Link>
            </div>
          </BrandCard>
        ) : (
          jobs.map((job) => (
            <Link key={job.id} href={`/employer/jobs/${job.id}`}>
              <BrandCard hover className="cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-bloque-navy900">
                        {job.title}
                      </h3>
                      {getStatusBadge(job.status)}
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
                      {job.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {job.location}
                        </span>
                      )}
                      {job.modality && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {job.modality}
                        </span>
                      )}
                      {(job.salary_min || job.salary_max) && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          {job.salary_min && job.salary_max
                            ? `${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()} ${job.salary_currency}`
                            : job.salary_min
                            ? `Desde ${job.salary_min.toLocaleString()} ${job.salary_currency}`
                            : `Hasta ${job.salary_max.toLocaleString()} ${job.salary_currency}`}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-bloque-navy900">
                        <Users className="h-4 w-4" />
                        {job.shortlist_count || 0} en shortlist
                      </span>
                      {job.seniority && (
                        <Badge variant="outline">{job.seniority}</Badge>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </BrandCard>
            </Link>
          ))
        )}
      </div>
    </AppShell>
  )
}
