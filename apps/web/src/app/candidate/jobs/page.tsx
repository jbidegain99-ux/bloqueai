'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { publicApi } from '@/lib/api'
import {
  Search,
  MapPin,
  Building2,
  Briefcase,
  DollarSign,
  Clock,
  Star,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Laptop,
  Users,
  Home,
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
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  must_haves: string[]
  nice_to_haves: string[]
  benefits: string[]
  is_featured: boolean
  company: {
    id: string
    name: string
    slug: string
    industry: string | null
    logo_url: string | null
  }
  created_at: string
}

interface FilterOption {
  value: string
  label: string
}

const MODALITY_ICONS: Record<string, React.ReactNode> = {
  REMOTE: <Laptop className="h-3 w-3" />,
  HYBRID: <Users className="h-3 w-3" />,
  ONSITE: <Home className="h-3 w-3" />,
}

const SENIORITY_COLORS: Record<string, string> = {
  INTERN: 'bg-gray-100 text-gray-700',
  JUNIOR: 'bg-green-100 text-green-700',
  MID: 'bg-blue-100 text-blue-700',
  SENIOR: 'bg-purple-100 text-purple-700',
  LEAD: 'bg-orange-100 text-orange-700',
  MANAGER: 'bg-red-100 text-red-700',
  DIRECTOR: 'bg-pink-100 text-pink-700',
  VP: 'bg-indigo-100 text-indigo-700',
  C_LEVEL: 'bg-yellow-100 text-yellow-800',
}

function formatSalary(min: number | null, max: number | null, currency: string | null): string {
  if (!min && !max) return ''
  const curr = currency || 'USD'
  if (min && max) {
    return `$${(min / 1000).toFixed(0)}k - $${(max / 1000).toFixed(0)}k ${curr}`
  }
  if (min) return `Desde $${(min / 1000).toFixed(0)}k ${curr}`
  if (max) return `Hasta $${(max / 1000).toFixed(0)}k ${curr}`
  return ''
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7) return `Hace ${diffDays} dias`
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`
  return date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
}

export default function CandidateJobsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalJobs, setTotalJobs] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [category, setCategory] = useState(searchParams.get('category') || '')
  const [seniority, setSeniority] = useState(searchParams.get('seniority') || '')
  const [modality, setModality] = useState(searchParams.get('modality') || '')
  const [showFilters, setShowFilters] = useState(false)

  // Filter options
  const [categories, setCategories] = useState<FilterOption[]>([])
  const [seniorityLevels, setSeniorityLevels] = useState<FilterOption[]>([])
  const [modalities, setModalities] = useState<FilterOption[]>([])

  // Load filter options
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [catRes, senRes, modRes] = await Promise.all([
          publicApi.getJobCategories(),
          publicApi.getSeniorityLevels(),
          publicApi.getModalities(),
        ])
        setCategories(catRes.categories)
        setSeniorityLevels(senRes.seniority_levels)
        setModalities(modRes.modalities)
      } catch (err) {
        console.error('Error loading filters:', err)
      }
    }
    loadFilters()
  }, [])

  // Load jobs
  const loadJobs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await publicApi.getJobs({
        page: currentPage,
        page_size: 20,
        search: search || undefined,
        category: category || undefined,
        seniority: seniority || undefined,
        modality: modality || undefined,
      })

      setJobs(response.items)
      setTotalJobs(response.total)
      setTotalPages(response.total_pages)
    } catch (err: any) {
      console.error('Error loading jobs:', err)
      setError(err?.message || 'Error al cargar los puestos')
    } finally {
      setLoading(false)
    }
  }, [currentPage, search, category, seniority, modality])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  // Handle search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    loadJobs()
  }

  // Clear all filters
  const clearFilters = () => {
    setSearch('')
    setCategory('')
    setSeniority('')
    setModality('')
    setCurrentPage(1)
  }

  const hasActiveFilters = search || category || seniority || modality

  const activeFilterCount = [search, category, seniority, modality].filter(Boolean).length

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-bloque-navy900">
            Encuentra tu proximo trabajo
          </h1>
          <p className="text-muted-foreground mt-1">
            {totalJobs > 0 ? `${totalJobs} puestos disponibles` : 'Buscando oportunidades...'}
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por titulo, empresa o descripcion..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit">Buscar</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="relative"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
              {activeFilterCount > 0 && (
                <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </form>

          {/* Filter row */}
          {showFilters && (
            <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg">
              <Select value={category} onValueChange={(v) => { setCategory(v === 'all' ? '' : v); setCurrentPage(1) }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorias</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={seniority} onValueChange={(v) => { setSeniority(v === 'all' ? '' : v); setCurrentPage(1) }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los niveles</SelectItem>
                  {seniorityLevels.map((sen) => (
                    <SelectItem key={sen.value} value={sen.value}>
                      {sen.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={modality} onValueChange={(v) => { setModality(v === 'all' ? '' : v); setCurrentPage(1) }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Modalidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {modalities.map((mod) => (
                    <SelectItem key={mod.value} value={mod.value}>
                      {mod.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Limpiar filtros
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg">
            {error}
          </div>
        )}

        {/* Job list */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <BrandCard key={i} className="p-6">
                <div className="flex gap-4">
                  <Skeleton className="h-14 w-14 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              </BrandCard>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <BrandCard className="p-12 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No se encontraron puestos</h3>
            <p className="text-muted-foreground mb-4">
              Intenta ajustar tus filtros o busqueda
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            )}
          </BrandCard>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <BrandCard
                key={job.id}
                className="p-6 hover:border-bloque-gold500 transition-colors cursor-pointer"
                onClick={() => router.push(`/candidate/jobs/${job.id}`)}
              >
                <div className="flex gap-4">
                  {/* Company logo placeholder */}
                  <div className="h-14 w-14 rounded-lg bg-bloque-navy900 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {job.company.name.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          {job.is_featured && (
                            <Star className="h-4 w-4 text-bloque-gold500 fill-bloque-gold500" />
                          )}
                          <h3 className="text-lg font-semibold text-bloque-navy900 line-clamp-1">
                            {job.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Building2 className="h-3.5 w-3.5" />
                          <span>{job.company.name}</span>
                          {job.company.industry && (
                            <>
                              <span className="text-gray-300">|</span>
                              <span>{job.company.industry}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Salary */}
                      {(job.salary_min || job.salary_max) && (
                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center gap-1 text-sm font-medium text-green-600">
                            <DollarSign className="h-4 w-4" />
                            {formatSalary(job.salary_min, job.salary_max, job.salary_currency)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {job.description}
                    </p>

                    {/* Tags row */}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {job.seniority && (
                        <Badge
                          variant="secondary"
                          className={SENIORITY_COLORS[job.seniority] || ''}
                        >
                          {seniorityLevels.find((s) => s.value === job.seniority)?.label || job.seniority}
                        </Badge>
                      )}

                      {job.modality && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          {MODALITY_ICONS[job.modality]}
                          {modalities.find((m) => m.value === job.modality)?.label || job.modality}
                        </Badge>
                      )}

                      {job.location && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {job.location}
                        </Badge>
                      )}

                      {job.category && (
                        <Badge variant="outline">
                          {categories.find((c) => c.value === job.category)?.label || job.category}
                        </Badge>
                      )}

                      <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(job.created_at)}
                      </span>
                    </div>

                    {/* Skills preview */}
                    {job.must_haves.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {job.must_haves.slice(0, 5).map((skill, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-0.5 bg-bloque-navy900/5 text-bloque-navy900 rounded"
                          >
                            {skill}
                          </span>
                        ))}
                        {job.must_haves.length > 5 && (
                          <span className="text-xs text-muted-foreground">
                            +{job.must_haves.length - 5} mas
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </BrandCard>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="w-9"
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Results info */}
        {!loading && jobs.length > 0 && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            Mostrando {(currentPage - 1) * 20 + 1}-{Math.min(currentPage * 20, totalJobs)} de {totalJobs} puestos
          </p>
        )}
      </div>
    </AppShell>
  )
}
