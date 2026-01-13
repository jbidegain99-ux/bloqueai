'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { publicApi, candidateApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import {
  ArrowLeft,
  MapPin,
  Building2,
  Briefcase,
  DollarSign,
  Clock,
  Star,
  Laptop,
  Users,
  Home,
  Globe,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileText,
  MessageSquare,
  Upload,
  AlertCircle,
} from 'lucide-react'

interface Job {
  id: string
  title: string
  slug: string
  description: string
  department: string | null
  category: string | null
  seniority: string | null
  modality: string | null
  location: string | null
  country: string | null
  timezone: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  must_haves: string[]
  nice_to_haves: string[]
  responsibilities: string[]
  benefits: string[]
  is_featured: boolean
  company: {
    id: string
    name: string
    slug: string
    description: string | null
    industry: string | null
    size: string | null
    website: string | null
    logo_url: string | null
  }
  created_at: string
}

const MODALITY_INFO: Record<string, { label: string; icon: React.ReactNode }> = {
  REMOTE: { label: 'Remoto', icon: <Laptop className="h-4 w-4" /> },
  HYBRID: { label: 'Hibrido', icon: <Users className="h-4 w-4" /> },
  ONSITE: { label: 'Presencial', icon: <Home className="h-4 w-4" /> },
}

const SENIORITY_LABELS: Record<string, string> = {
  INTERN: 'Practicante',
  JUNIOR: 'Junior',
  MID: 'Mid-Level',
  SENIOR: 'Senior',
  LEAD: 'Lead / Principal',
  MANAGER: 'Manager',
  DIRECTOR: 'Director',
  VP: 'VP',
  C_LEVEL: 'C-Level',
}

function formatSalary(min: number | null, max: number | null, currency: string | null): string {
  if (!min && !max) return ''
  const curr = currency || 'USD'
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: curr, maximumFractionDigits: 0 })

  if (min && max) {
    return `${formatter.format(min)} - ${formatter.format(max)} ${curr}/ano`
  }
  if (min) return `Desde ${formatter.format(min)} ${curr}/ano`
  if (max) return `Hasta ${formatter.format(max)} ${curr}/ano`
  return ''
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function JobDetailPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.jobId as string

  const { isAuthenticated, user, accessToken } = useAuthStore()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [hasResume, setHasResume] = useState(false)
  const [checkingResume, setCheckingResume] = useState(false)

  // Load job details
  useEffect(() => {
    const loadJob = async () => {
      if (!jobId) return

      setLoading(true)
      setError(null)

      try {
        const jobData = await publicApi.getJob(jobId)
        setJob(jobData)
      } catch (err: any) {
        console.error('Error loading job:', err)
        setError(err?.message || 'Error al cargar el puesto')
      } finally {
        setLoading(false)
      }
    }

    loadJob()
  }, [jobId])

  // Check if candidate has resume
  useEffect(() => {
    const checkResume = async () => {
      if (!isAuthenticated || !accessToken || user?.role !== 'CANDIDATE') return

      setCheckingResume(true)
      try {
        const resumes = await candidateApi.getResumes(accessToken) as any[]
        setHasResume(resumes.length > 0)
      } catch (err) {
        console.error('Error checking resumes:', err)
      } finally {
        setCheckingResume(false)
      }
    }

    checkResume()
  }, [isAuthenticated, accessToken, user])

  const handleApply = async () => {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      router.push(`/login?redirect=/candidate/jobs/${jobId}`)
      return
    }

    if (user?.role !== 'CANDIDATE') {
      setError('Solo los candidatos pueden aplicar a puestos')
      return
    }

    // If no resume, redirect to apply flow with CV upload
    if (!hasResume) {
      router.push(`/candidate/apply/${jobId}`)
      return
    }

    // If has resume, go directly to interview
    setApplying(true)
    try {
      await candidateApi.startInterview(accessToken!, jobId)
      router.push(`/candidate/interview?job_id=${jobId}`)
    } catch (err: any) {
      console.error('Error starting application:', err)
      setError(err?.message || 'Error al iniciar la aplicacion')
      setApplying(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-8 w-32 mb-6" />
          <BrandCard className="p-8">
            <div className="space-y-4">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </BrandCard>
        </div>
      </AppShell>
    )
  }

  if (error || !job) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" onClick={() => router.back()} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <BrandCard className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error al cargar el puesto</h2>
            <p className="text-muted-foreground mb-4">{error || 'Puesto no encontrado'}</p>
            <Button onClick={() => router.push('/candidate/jobs')}>
              Ver todos los puestos
            </Button>
          </BrandCard>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <Button variant="ghost" onClick={() => router.back()} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a puestos
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job header */}
            <BrandCard className="p-6">
              <div className="flex gap-4">
                {/* Company logo */}
                <div className="h-16 w-16 rounded-xl bg-bloque-navy900 flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                  {job.company.name.charAt(0)}
                </div>

                <div className="flex-1">
                  <div className="flex items-start gap-2">
                    {job.is_featured && (
                      <Star className="h-5 w-5 text-bloque-gold500 fill-bloque-gold500 flex-shrink-0" />
                    )}
                    <h1 className="text-2xl font-bold text-bloque-navy900">{job.title}</h1>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground mt-1">
                    <Building2 className="h-4 w-4" />
                    <span className="font-medium">{job.company.name}</span>
                    {job.company.industry && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span>{job.company.industry}</span>
                      </>
                    )}
                  </div>

                  {/* Quick info */}
                  <div className="flex flex-wrap gap-3 mt-4">
                    {job.modality && (
                      <div className="flex items-center gap-1.5 text-sm">
                        {MODALITY_INFO[job.modality]?.icon}
                        <span>{MODALITY_INFO[job.modality]?.label}</span>
                      </div>
                    )}

                    {job.location && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <MapPin className="h-4 w-4" />
                        <span>{job.location}</span>
                      </div>
                    )}

                    {job.seniority && (
                      <Badge variant="secondary">
                        {SENIORITY_LABELS[job.seniority] || job.seniority}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Salary */}
              {(job.salary_min || job.salary_max) && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700">
                    <DollarSign className="h-5 w-5" />
                    <span className="text-lg font-semibold">
                      {formatSalary(job.salary_min, job.salary_max, job.salary_currency)}
                    </span>
                  </div>
                </div>
              )}
            </BrandCard>

            {/* Description */}
            <BrandCard>
              <BrandCardHeader>
                <h2 className="text-lg font-semibold">Descripcion del puesto</h2>
              </BrandCardHeader>
              <div className="p-6 pt-0">
                <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                  {job.description}
                </div>
              </div>
            </BrandCard>

            {/* Responsibilities */}
            {job.responsibilities.length > 0 && (
              <BrandCard>
                <BrandCardHeader>
                  <h2 className="text-lg font-semibold">Responsabilidades</h2>
                </BrandCardHeader>
                <div className="p-6 pt-0">
                  <ul className="space-y-2">
                    {job.responsibilities.map((resp, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </BrandCard>
            )}

            {/* Requirements */}
            <BrandCard>
              <BrandCardHeader>
                <h2 className="text-lg font-semibold">Requisitos</h2>
              </BrandCardHeader>
              <div className="p-6 pt-0 space-y-4">
                {job.must_haves.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-red-500" />
                      Obligatorios
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {job.must_haves.map((skill, idx) => (
                        <Badge key={idx} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {job.nice_to_haves.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Circle className="h-4 w-4 text-blue-500" />
                      Deseables
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {job.nice_to_haves.map((skill, idx) => (
                        <Badge key={idx} variant="outline">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </BrandCard>

            {/* Benefits */}
            {job.benefits.length > 0 && (
              <BrandCard>
                <BrandCardHeader>
                  <h2 className="text-lg font-semibold">Beneficios</h2>
                </BrandCardHeader>
                <div className="p-6 pt-0">
                  <div className="grid grid-cols-2 gap-2">
                    {job.benefits.map((benefit, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-bloque-gold500 flex-shrink-0" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </BrandCard>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Apply card */}
            <BrandCard className="p-6 sticky top-6">
              <Button
                onClick={handleApply}
                disabled={applying || checkingResume}
                className="w-full"
                size="lg"
              >
                {applying ? 'Iniciando...' : 'Aplicar ahora'}
              </Button>

              {!isAuthenticated && (
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Deberas iniciar sesion para aplicar
                </p>
              )}

              {isAuthenticated && !hasResume && !checkingResume && (
                <div className="mt-4 p-3 bg-amber-50 rounded-lg text-sm">
                  <div className="flex items-start gap-2">
                    <Upload className="h-4 w-4 text-amber-600 mt-0.5" />
                    <p className="text-amber-800">
                      Subiras tu CV antes de la entrevista para que podamos analizar tu perfil
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              <Separator className="my-4" />

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>Subir CV para analisis</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MessageSquare className="h-4 w-4" />
                  <span>Entrevista con IA (15-20 min)</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Evaluacion automatica</span>
                </div>
              </div>
            </BrandCard>

            {/* Company card */}
            <BrandCard>
              <BrandCardHeader>
                <h2 className="text-lg font-semibold">Sobre la empresa</h2>
              </BrandCardHeader>
              <div className="p-6 pt-0 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-bloque-navy900 flex items-center justify-center text-white font-bold text-lg">
                    {job.company.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold">{job.company.name}</h3>
                    {job.company.industry && (
                      <p className="text-sm text-muted-foreground">{job.company.industry}</p>
                    )}
                  </div>
                </div>

                {job.company.description && (
                  <p className="text-sm text-muted-foreground line-clamp-4">
                    {job.company.description}
                  </p>
                )}

                {job.company.size && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{job.company.size} empleados</span>
                  </div>
                )}

                {job.company.website && (
                  <a
                    href={job.company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-bloque-gold600 hover:underline"
                  >
                    <Globe className="h-4 w-4" />
                    <span>Visitar sitio web</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </BrandCard>

            {/* Meta info */}
            <div className="text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Publicado el {formatDate(job.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
