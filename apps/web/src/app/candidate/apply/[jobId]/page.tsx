'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { publicApi, applicationsApi, candidateApi } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  X,
  Building2,
  RefreshCw,
  XCircle,
  MapPin,
  Briefcase,
} from 'lucide-react'

interface Job {
  id: string
  title: string
  company: {
    name: string
    industry?: string
  }
  must_haves: string[]
  nice_to_haves: string[]
  location?: string
  modality?: string
}

interface Application {
  id: string
  status: string
  match_score: number | null
  candidate_profile: Record<string, unknown> | null
  match_reasons: string[] | null
  match_gaps: string[] | null
  recommended_job_ids: Array<{
    id: string
    title: string
    company_name: string
    match_score: number
    location: string | null
    modality: string | null
  }> | null
  resume_filename: string | null
}

type ApplyStep = 'upload' | 'analyzing' | 'results'

const MATCH_THRESHOLD = 70

export default function ApplyPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.jobId as string

  const { isAuthenticated, accessToken } = useAuthStore()
  const [job, setJob] = useState<Job | null>(null)
  const [application, setApplication] = useState<Application | null>(null)
  const [step, setStep] = useState<ApplyStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(true)

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/candidate/apply/${jobId}`)
    }
  }, [isAuthenticated, router, jobId])

  // Load job info and create/get application
  useEffect(() => {
    const initialize = async () => {
      if (!accessToken) return

      try {
        // Load job details
        const jobData = await publicApi.getJob(jobId)
        setJob(jobData)

        // Create or get existing application
        const appData = await applicationsApi.create(accessToken, jobId)
        setApplication(appData as any)

        // Set step based on application status
        if (appData.status === 'CV_UPLOADED') {
          setStep('upload') // Allow re-upload or proceed to analyze
        } else if (['MATCH_PASSED', 'MATCH_BELOW_THRESHOLD'].includes(appData.status)) {
          // Already analyzed, show results
          const fullApp = await applicationsApi.get(accessToken, appData.id)
          setApplication(fullApp as any)
          setStep('results')
        }
      } catch (err: any) {
        console.error('Error initializing:', err)
        setError(err?.message || 'Error al cargar la aplicacion')
      } finally {
        setLoading(false)
      }
    }

    initialize()
  }, [jobId, accessToken])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && isValidFileType(droppedFile)) {
      setFile(droppedFile)
      setError(null)
    } else {
      setError('Tipo de archivo no valido. Usa PDF o DOCX.')
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && isValidFileType(selectedFile)) {
      setFile(selectedFile)
      setError(null)
    } else if (selectedFile) {
      setError('Tipo de archivo no valido. Usa PDF o DOCX.')
    }
  }

  const isValidFileType = (f: File) => {
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    const ext = f.name.toLowerCase().split('.').pop()
    return validTypes.includes(f.type) || ['pdf', 'docx'].includes(ext || '')
  }

  const handleUpload = async () => {
    if (!file || !accessToken || !application) return

    setUploading(true)
    setError(null)

    try {
      // Upload CV to this application
      await applicationsApi.uploadResume(accessToken, application.id, file)

      // Now analyze the CV
      setStep('analyzing')
      setAnalyzing(true)

      const analysisResult = await applicationsApi.analyze(accessToken, application.id)

      // Update application with results
      setApplication({
        ...application,
        status: analysisResult.status,
        match_score: analysisResult.match_score,
        candidate_profile: analysisResult.candidate_profile,
        match_reasons: analysisResult.match_reasons,
        match_gaps: analysisResult.match_gaps,
        recommended_job_ids: analysisResult.recommended_jobs || null,
      })

      setStep('results')
    } catch (err: any) {
      console.error('Error uploading/analyzing CV:', err)
      setError(err?.message || 'Error al procesar el CV. Intenta de nuevo.')
      setStep('upload')
    } finally {
      setUploading(false)
      setAnalyzing(false)
    }
  }

  const handleStartInterview = async () => {
    if (!accessToken || !application) return

    try {
      // Start interview with job context
      await candidateApi.startInterview(accessToken, jobId)
      router.push(`/candidate/interview?job_id=${jobId}`)
    } catch (err: any) {
      console.error('Error starting interview:', err)
      setError(err?.message || 'Error al iniciar la entrevista')
    }
  }

  const handleApplyToRecommended = async (recommendedJobId: string) => {
    router.push(`/candidate/apply/${recommendedJobId}`)
  }

  const getScoreColor = (score: number) => {
    if (score >= MATCH_THRESHOLD) return 'text-green-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number) => {
    if (score >= MATCH_THRESHOLD) return 'bg-green-100'
    if (score >= 50) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const canProceedToInterview = application?.status === 'MATCH_PASSED' ||
    (application?.match_score !== null && application.match_score >= MATCH_THRESHOLD)

  if (!isAuthenticated) return null

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-bloque-gold500" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <Button variant="ghost" onClick={() => router.push('/candidate/jobs')} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a puestos
        </Button>

        {/* Header */}
        {job && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-bloque-navy900">
              Aplicar a {job.title}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground mt-1">
              <Building2 className="h-4 w-4" />
              <span>{job.company.name}</span>
            </div>
          </div>
        )}

        {/* Progress steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 ${step === 'upload' ? 'text-bloque-navy900' : 'text-muted-foreground'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'upload' ? 'bg-bloque-navy900 text-white' :
                ['analyzing', 'results'].includes(step) ? 'bg-green-500 text-white' : 'bg-gray-200'
              }`}>
                {['analyzing', 'results'].includes(step) ? <CheckCircle2 className="h-4 w-4" /> : '1'}
              </div>
              <span className="text-sm font-medium">Subir CV</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-4" />
            <div className={`flex items-center gap-2 ${step === 'analyzing' ? 'text-bloque-navy900' : step === 'results' ? 'text-green-600' : 'text-muted-foreground'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'analyzing' ? 'bg-bloque-navy900 text-white' :
                step === 'results' ? 'bg-green-500 text-white' : 'bg-gray-200'
              }`}>
                {step === 'results' ? <CheckCircle2 className="h-4 w-4" /> : '2'}
              </div>
              <span className="text-sm font-medium">Analisis IA</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-4" />
            <div className={`flex items-center gap-2 ${canProceedToInterview ? 'text-bloque-navy900' : 'text-muted-foreground'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                canProceedToInterview ? 'bg-bloque-gold500 text-white' : 'bg-gray-200'
              }`}>
                3
              </div>
              <span className="text-sm font-medium">Entrevista</span>
            </div>
          </div>
        </div>

        {/* Content based on step */}
        {step === 'upload' && (
          <BrandCard className="p-8">
            <div className="text-center mb-6">
              <FileText className="h-12 w-12 text-bloque-navy900 mx-auto mb-3" />
              <h2 className="text-xl font-semibold mb-2">Sube tu CV</h2>
              <p className="text-muted-foreground">
                Analizaremos tu CV con IA para compararlo con los requisitos del puesto
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver ? 'border-bloque-gold500 bg-bloque-gold50' :
                file ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-green-600" />
                  <div className="text-left">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                    className="ml-4"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-2">
                    Arrastra tu CV aqui o
                  </p>
                  <label className="cursor-pointer">
                    <span className="text-bloque-gold600 hover:underline font-medium">
                      selecciona un archivo
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-muted-foreground mt-2">
                    PDF o DOCX, maximo 10MB
                  </p>
                </>
              )}
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full mt-6"
              size="lg"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  Analizar CV
                  <Sparkles className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </BrandCard>
        )}

        {step === 'analyzing' && (
          <BrandCard className="p-8 text-center">
            <Loader2 className="h-16 w-16 text-bloque-gold500 mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-semibold mb-2">Analizando tu perfil con IA</h2>
            <p className="text-muted-foreground mb-6">
              Estamos comparando tu CV con los requisitos del puesto usando OpenAI...
            </p>
            <Progress value={65} className="max-w-xs mx-auto" />
            <p className="text-xs text-muted-foreground mt-4">
              Esto puede tomar unos segundos
            </p>
          </BrandCard>
        )}

        {step === 'results' && application && (
          <div className="space-y-6">
            {/* Score card */}
            <BrandCard className="p-6">
              <div className="flex items-center gap-4">
                <div className={`h-20 w-20 rounded-full flex items-center justify-center ${getScoreBg(application.match_score || 0)}`}>
                  <span className={`text-3xl font-bold ${getScoreColor(application.match_score || 0)}`}>
                    {application.match_score || 0}%
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    {canProceedToInterview ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        Excelente match!
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-amber-500" />
                        Match por debajo del umbral
                      </>
                    )}
                  </h2>
                  <p className="text-muted-foreground">
                    {canProceedToInterview
                      ? `Tu perfil tiene un ${application.match_score}% de compatibilidad. Puedes continuar a la entrevista.`
                      : `Tu perfil tiene un ${application.match_score}% de compatibilidad. Se requiere minimo ${MATCH_THRESHOLD}% para la entrevista.`
                    }
                  </p>
                </div>
              </div>
            </BrandCard>

            {/* Match reasons */}
            {application.match_reasons && application.match_reasons.length > 0 && (
              <BrandCard>
                <BrandCardHeader title="Por que haces match" />
                <div className="p-6 pt-0">
                  <ul className="space-y-2">
                    {application.match_reasons.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </BrandCard>
            )}

            {/* Gaps */}
            {application.match_gaps && application.match_gaps.length > 0 && (
              <BrandCard>
                <BrandCardHeader title="Areas de mejora" />
                <div className="p-6 pt-0">
                  <ul className="space-y-2">
                    {application.match_gaps.map((gap, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-amber-700">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              </BrandCard>
            )}

            {/* Recommended jobs if match < 70 */}
            {!canProceedToInterview && application.recommended_job_ids && application.recommended_job_ids.length > 0 && (
              <BrandCard>
                <BrandCardHeader
                  title="Puestos recomendados para ti"
                  description="Basado en tu perfil, estos puestos podrian ser un mejor match"
                />
                <div className="p-6 pt-0 space-y-3">
                  {application.recommended_job_ids.map((recJob) => (
                    <div
                      key={recJob.id}
                      className="flex items-center justify-between p-4 bg-bloque-gray50 rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium text-bloque-navy900">{recJob.title}</h4>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {recJob.company_name}
                          </span>
                          {recJob.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {recJob.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={`${getScoreBg(recJob.match_score)} ${getScoreColor(recJob.match_score)}`}>
                          {recJob.match_score}% match
                        </Badge>
                        <Button
                          size="sm"
                          onClick={() => handleApplyToRecommended(recJob.id)}
                        >
                          Aplicar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </BrandCard>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => { setStep('upload'); setFile(null) }}
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Subir otro CV
              </Button>

              {canProceedToInterview ? (
                <Button
                  onClick={handleStartInterview}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  Iniciar entrevista
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  disabled
                  variant="secondary"
                  className="flex-1"
                  size="lg"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Entrevista no disponible
                </Button>
              )}
            </div>

            {!canProceedToInterview && (
              <div className="p-4 bg-amber-50 rounded-lg">
                <p className="text-sm text-amber-800 text-center">
                  <strong>Nota:</strong> Tu perfil no alcanza el umbral minimo de {MATCH_THRESHOLD}% para este puesto.
                  Te recomendamos aplicar a los puestos sugeridos arriba o mejorar tu CV con las habilidades indicadas.
                </p>
              </div>
            )}

            {canProceedToInterview && (
              <p className="text-sm text-muted-foreground text-center">
                La entrevista con IA tomara aproximadamente 15-20 minutos
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
