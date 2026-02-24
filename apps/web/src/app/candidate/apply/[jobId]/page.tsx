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
import { logger } from '@/lib/logger'
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
  Video,
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
  match_threshold?: number
  interview_type?: 'chat' | 'video'
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

type ApplyStep = 'pre-upload' | 'upload' | 'analyzing' | 'results'

// System default threshold - will be overridden by job.match_threshold if available
const SYSTEM_DEFAULT_THRESHOLD = 70

export default function ApplyPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.jobId as string

  const { isAuthenticated, isHydrated, accessToken } = useAuthStore()
  const [job, setJob] = useState<Job | null>(null)
  const [application, setApplication] = useState<Application | null>(null)
  const [step, setStep] = useState<ApplyStep>('pre-upload')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(true)
  const [startingInterview, setStartingInterview] = useState(false)
  const [showExampleCV, setShowExampleCV] = useState(false)
  const [videoFallback, setVideoFallback] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push(`/login?redirect=/candidate/apply/${jobId}`)
    }
  }, [isAuthenticated, isHydrated, router, jobId])

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
        if (appData.status === 'CREATED') {
          // New application, show pre-upload step
          setStep('pre-upload')
        } else if (appData.status === 'CV_UPLOADED') {
          // CV already uploaded, go to upload step to allow re-upload or analyze
          setStep('upload')
        } else if (['MATCH_PASSED', 'MATCH_BELOW_THRESHOLD'].includes(appData.status)) {
          // Already analyzed, show results
          const fullApp = await applicationsApi.get(accessToken, appData.id)
          setApplication(fullApp as any)
          setStep('results')
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al cargar la aplicacion'
        logger.error({ err, jobId }, 'Apply page initialization failed')
        setError(message)
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al procesar el CV. Intenta de nuevo.'
      logger.error({ err, jobId }, 'CV upload/analysis failed')
      setError(message)
      setStep('upload')
    } finally {
      setUploading(false)
      setAnalyzing(false)
    }
  }

  const handleStartInterview = async () => {
    if (!accessToken || !application) return

    setError(null)
    setVideoFallback(false)
    setStartingInterview(true)

    try {
      if (job?.interview_type === 'video') {
        // Video interview flow
        try {
          const result = await candidateApi.startVideoInterview(accessToken, jobId)

          if (!result?.interview_id) {
            throw new Error('No se pudo crear la video entrevista')
          }

          router.push(`/candidate/interviews/${result.interview_id}`)
          return
        } catch (videoErr: unknown) {
          logger.error({ err: videoErr, jobId }, 'Video interview failed, showing fallback')
          setVideoFallback(true)
          setStartingInterview(false)
          return
        }
      }

      // Chat interview flow (default)
      const session = await candidateApi.startInterview(accessToken, jobId)

      if (!session?.id) {
        throw new Error('No se pudo crear la sesion de entrevista')
      }

      router.push(`/candidate/interview/${session.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar la entrevista'
      logger.error({ err, jobId }, 'Failed to start interview')
      setError(message)
      setStartingInterview(false)
    }
  }

  const handleFallbackToChat = async () => {
    if (!accessToken || !application) return

    setError(null)
    setVideoFallback(false)
    setStartingInterview(true)

    try {
      const session = await candidateApi.startInterview(accessToken, jobId)

      if (!session?.id) {
        throw new Error('No se pudo crear la sesion de entrevista')
      }

      router.push(`/candidate/interview/${session.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar la entrevista'
      logger.error({ err, jobId }, 'Fallback chat interview failed')
      setError(message)
      setStartingInterview(false)
    }
  }

  const handleApplyToRecommended = async (recommendedJobId: string) => {
    router.push(`/candidate/apply/${recommendedJobId}`)
  }

  // Get effective threshold from job or use system default
  const matchThreshold = job?.match_threshold ?? SYSTEM_DEFAULT_THRESHOLD

  const getScoreColor = (score: number) => {
    if (score >= matchThreshold) return 'text-green-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number) => {
    if (score >= matchThreshold) return 'bg-green-100'
    if (score >= 50) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const canProceedToInterview = application?.status === 'MATCH_PASSED' ||
    (application?.match_score !== null && application?.match_score !== undefined && application.match_score >= matchThreshold)

  if (!isHydrated || !isAuthenticated) return null

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
            {/* Step 1: Preparacion */}
            <div className={`flex items-center gap-2 ${step === 'pre-upload' ? 'text-bloque-navy900' : 'text-muted-foreground'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'pre-upload' ? 'bg-bloque-navy900 text-white' :
                ['upload', 'analyzing', 'results'].includes(step) ? 'bg-green-500 text-white' : 'bg-gray-200'
              }`}>
                {['upload', 'analyzing', 'results'].includes(step) ? <CheckCircle2 className="h-4 w-4" /> : '1'}
              </div>
              <span className="text-sm font-medium hidden sm:inline">Preparacion</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-2 sm:mx-4" />
            {/* Step 2: Subir CV */}
            <div className={`flex items-center gap-2 ${step === 'upload' ? 'text-bloque-navy900' : 'text-muted-foreground'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'upload' ? 'bg-bloque-navy900 text-white' :
                ['analyzing', 'results'].includes(step) ? 'bg-green-500 text-white' : 'bg-gray-200'
              }`}>
                {['analyzing', 'results'].includes(step) ? <CheckCircle2 className="h-4 w-4" /> : '2'}
              </div>
              <span className="text-sm font-medium hidden sm:inline">Subir CV</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-2 sm:mx-4" />
            {/* Step 3: Analisis */}
            <div className={`flex items-center gap-2 ${step === 'analyzing' ? 'text-bloque-navy900' : step === 'results' ? 'text-green-600' : 'text-muted-foreground'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'analyzing' ? 'bg-bloque-navy900 text-white' :
                step === 'results' ? 'bg-green-500 text-white' : 'bg-gray-200'
              }`}>
                {step === 'results' ? <CheckCircle2 className="h-4 w-4" /> : '3'}
              </div>
              <span className="text-sm font-medium hidden sm:inline">Analisis IA</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-2 sm:mx-4" />
            {/* Step 4: Entrevista */}
            <div className={`flex items-center gap-2 ${canProceedToInterview ? 'text-bloque-navy900' : 'text-muted-foreground'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                canProceedToInterview ? 'bg-bloque-gold500 text-white' : 'bg-gray-200'
              }`}>
                4
              </div>
              <span className="text-sm font-medium hidden sm:inline">Entrevista</span>
            </div>
          </div>
        </div>

        {/* Content based on step */}

        {/* Pre-upload step: CV preparation message */}
        {step === 'pre-upload' && (
          <BrandCard className="p-8">
            <div className="text-center mb-6">
              <FileText className="h-12 w-12 text-bloque-gold500 mx-auto mb-3" />
              <h2 className="text-xl font-semibold mb-2">Preparate para aplicar</h2>
              <p className="text-muted-foreground mb-6">
                Antes de subir tu CV, asegurate de que este actualizado y optimizado para este puesto
              </p>
            </div>

            {/* Tips card */}
            <div className="bg-bloque-gray50 rounded-lg p-6 mb-6">
              <h3 className="font-medium text-bloque-navy900 mb-4">Consejos para tu CV:</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Incluye las habilidades clave mencionadas en la descripcion del puesto</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Destaca logros cuantificables en tus experiencias previas</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Asegurate de que tu informacion de contacto este correcta</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Usa formato PDF o DOCX para mejor compatibilidad</span>
                </li>
              </ul>
            </div>

            {/* Requirements preview */}
            {job && (job.must_haves?.length > 0 || job.nice_to_haves?.length > 0) && (
              <div className="border border-bloque-slate200 rounded-lg p-6 mb-6">
                <h3 className="font-medium text-bloque-navy900 mb-4">Requisitos del puesto:</h3>
                {job.must_haves?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-bloque-navy900 mb-2">Requeridos:</p>
                    <div className="flex flex-wrap gap-2">
                      {job.must_haves.map((skill, idx) => (
                        <Badge key={idx} variant="outline">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {job.nice_to_haves?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Deseables:</p>
                    <div className="flex flex-wrap gap-2">
                      {job.nice_to_haves.map((skill, idx) => (
                        <Badge key={idx} variant="secondary" className="bg-gray-100 text-gray-700">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowExampleCV(true)}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Ver ejemplo de CV
              </Button>
              <Button
                className="flex-1"
                onClick={() => setStep('upload')}
              >
                Continuar
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </BrandCard>
        )}

        {/* Example CV Modal */}
        {showExampleCV && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Ejemplo de CV para {job?.title || 'este puesto'}</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowExampleCV(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                  <div className="space-y-4 text-sm">
                    <div>
                      <h4 className="font-semibold text-bloque-navy900">JUAN PEREZ GARCIA</h4>
                      <p className="text-muted-foreground">Ciudad de Mexico | juan.perez@email.com | +52 55 1234 5678</p>
                    </div>

                    <div>
                      <h5 className="font-medium text-bloque-navy900 border-b pb-1 mb-2">PERFIL PROFESIONAL</h5>
                      <p className="text-muted-foreground">
                        Profesional con X anos de experiencia en [area relevante al puesto].
                        Especializado en {job?.must_haves?.slice(0, 2).join(', ') || 'habilidades clave'}.
                        Orientado a resultados con capacidad demostrada para [logro relevante].
                      </p>
                    </div>

                    <div>
                      <h5 className="font-medium text-bloque-navy900 border-b pb-1 mb-2">EXPERIENCIA LABORAL</h5>
                      <div className="space-y-3">
                        <div>
                          <p className="font-medium">Cargo Anterior | Empresa ABC</p>
                          <p className="text-xs text-muted-foreground">Ene 2020 - Presente</p>
                          <ul className="list-disc list-inside text-muted-foreground mt-1">
                            <li>Logro cuantificable #1 (ej: "Aumente las ventas en 30%")</li>
                            <li>Responsabilidad relacionada con {job?.must_haves?.[0] || 'habilidad clave'}</li>
                            <li>Implementacion de mejoras en procesos</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium text-bloque-navy900 border-b pb-1 mb-2">HABILIDADES</h5>
                      <div className="flex flex-wrap gap-2">
                        {(job?.must_haves || ['Habilidad 1', 'Habilidad 2', 'Habilidad 3']).map((skill, idx) => (
                          <Badge key={idx} variant="outline">{skill}</Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium text-bloque-navy900 border-b pb-1 mb-2">EDUCACION</h5>
                      <p className="text-muted-foreground">
                        Licenciatura/Ingenieria en [Campo Relevante]<br />
                        Universidad XYZ | 2015 - 2019
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Tip:</strong> Adapta tu CV para destacar las habilidades que coinciden
                    con los requisitos del puesto. Los CVs personalizados tienen mejor match.
                  </p>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button onClick={() => setShowExampleCV(false)}>
                    Entendido
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

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
                      : `Tu perfil tiene un ${application.match_score}% de compatibilidad. Se requiere minimo ${matchThreshold}% para la entrevista.`
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

            {/* Video interview info banner */}
            {canProceedToInterview && job?.interview_type === 'video' && !videoFallback && (
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                <Video className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Esta entrevista sera por video con un agente de IA</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Asegurate de tener camara y microfono habilitados antes de iniciar.
                  </p>
                </div>
              </div>
            )}

            {/* Video fallback card */}
            {videoFallback && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900">Video entrevista no disponible</p>
                    <p className="text-sm text-amber-700 mt-1">
                      No pudimos iniciar la video entrevista en este momento. Puedes reintentar o continuar con una entrevista por chat.
                    </p>
                    <div className="flex gap-3 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleStartInterview}
                        disabled={startingInterview}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Reintentar video
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleFallbackToChat}
                        disabled={startingInterview}
                      >
                        Continuar con chat
                        <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
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
                  disabled={startingInterview || videoFallback}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  {startingInterview ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Iniciando entrevista...
                    </>
                  ) : (
                    <>
                      {job?.interview_type === 'video' ? (
                        <>
                          <Video className="h-4 w-4 mr-2" />
                          Iniciar video entrevista
                        </>
                      ) : (
                        <>
                          Iniciar entrevista
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </>
                  )}
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
                  <strong>Nota:</strong> Tu perfil no alcanza el umbral minimo de {matchThreshold}% para este puesto.
                  Te recomendamos aplicar a los puestos sugeridos arriba o mejorar tu CV con las habilidades indicadas.
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {canProceedToInterview && !error && (
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
