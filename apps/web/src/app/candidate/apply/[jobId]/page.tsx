'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { publicApi, candidateApi } from '@/lib/api'
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
} from 'lucide-react'

interface Job {
  id: string
  title: string
  company: {
    name: string
  }
  must_haves: string[]
  nice_to_haves: string[]
}

interface MatchResult {
  score: number
  matching_skills: string[]
  missing_skills: string[]
  recommendations: string[]
}

type ApplyStep = 'upload' | 'analyzing' | 'results' | 'ready'

export default function ApplyPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.jobId as string

  const { isAuthenticated, accessToken, user } = useAuthStore()
  const [job, setJob] = useState<Job | null>(null)
  const [step, setStep] = useState<ApplyStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/candidate/apply/${jobId}`)
    }
  }, [isAuthenticated, router, jobId])

  // Load job info
  useEffect(() => {
    const loadJob = async () => {
      try {
        const jobData = await publicApi.getJob(jobId)
        setJob(jobData)
      } catch (err) {
        console.error('Error loading job:', err)
      }
    }
    loadJob()
  }, [jobId])

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
    return validTypes.includes(f.type)
  }

  const handleUpload = async () => {
    if (!file || !accessToken) return

    setUploading(true)
    setError(null)
    setStep('analyzing')

    try {
      // Upload CV
      const uploadResult = await candidateApi.uploadResume(accessToken, file) as any
      console.log('Upload result:', uploadResult)

      // Simulate matching analysis (in real implementation, backend would do this)
      // For now, we generate a mock match based on parsed skills
      const parsedSkills = uploadResult.parsed_data?.skills || []
      const jobMustHaves = job?.must_haves || []
      const jobNiceToHaves = job?.nice_to_haves || []

      const matchingMustHaves = jobMustHaves.filter((skill: string) =>
        parsedSkills.some((ps: string) =>
          ps.toLowerCase().includes(skill.toLowerCase()) ||
          skill.toLowerCase().includes(ps.toLowerCase())
        )
      )

      const matchingNiceToHaves = jobNiceToHaves.filter((skill: string) =>
        parsedSkills.some((ps: string) =>
          ps.toLowerCase().includes(skill.toLowerCase()) ||
          skill.toLowerCase().includes(ps.toLowerCase())
        )
      )

      const missingMustHaves = jobMustHaves.filter((skill: string) => !matchingMustHaves.includes(skill))
      const missingNiceToHaves = jobNiceToHaves.filter((skill: string) => !matchingNiceToHaves.includes(skill))

      // Calculate score (weighted: must haves = 70%, nice to haves = 30%)
      const mustHaveScore = jobMustHaves.length > 0
        ? (matchingMustHaves.length / jobMustHaves.length) * 70
        : 70
      const niceToHaveScore = jobNiceToHaves.length > 0
        ? (matchingNiceToHaves.length / jobNiceToHaves.length) * 30
        : 30
      const totalScore = Math.round(mustHaveScore + niceToHaveScore)

      const recommendations: string[] = []
      if (missingMustHaves.length > 0) {
        recommendations.push(`Considera destacar experiencia con: ${missingMustHaves.slice(0, 3).join(', ')}`)
      }
      if (totalScore < 70) {
        recommendations.push('Tu perfil podria beneficiarse de mas experiencia en las tecnologias requeridas')
      }
      if (totalScore >= 70) {
        recommendations.push('Tu perfil cumple con los requisitos principales del puesto')
      }

      setMatchResult({
        score: totalScore,
        matching_skills: [...matchingMustHaves, ...matchingNiceToHaves],
        missing_skills: [...missingMustHaves, ...missingNiceToHaves.slice(0, 3)],
        recommendations,
      })

      setStep('results')
    } catch (err: any) {
      console.error('Error uploading CV:', err)
      setError(err?.message || 'Error al subir el CV. Intenta de nuevo.')
      setStep('upload')
    } finally {
      setUploading(false)
    }
  }

  const handleProceedToInterview = async () => {
    setStep('ready')

    try {
      // Start interview with job context
      await candidateApi.startInterview(accessToken!, jobId)
      router.push(`/candidate/interview?job_id=${jobId}`)
    } catch (err: any) {
      console.error('Error starting interview:', err)
      setError(err?.message || 'Error al iniciar la entrevista')
      setStep('results')
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-100'
    if (score >= 60) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  if (!isAuthenticated) return null

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <Button variant="ghost" onClick={() => router.back()} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
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
                ['analyzing', 'results', 'ready'].includes(step) ? 'bg-green-500 text-white' : 'bg-gray-200'
              }`}>
                {['analyzing', 'results', 'ready'].includes(step) ? <CheckCircle2 className="h-4 w-4" /> : '1'}
              </div>
              <span className="text-sm font-medium">Subir CV</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-4" />
            <div className={`flex items-center gap-2 ${step === 'analyzing' ? 'text-bloque-navy900' : step === 'results' || step === 'ready' ? 'text-green-600' : 'text-muted-foreground'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'analyzing' ? 'bg-bloque-navy900 text-white' :
                step === 'results' || step === 'ready' ? 'bg-green-500 text-white' : 'bg-gray-200'
              }`}>
                {step === 'results' || step === 'ready' ? <CheckCircle2 className="h-4 w-4" /> : '2'}
              </div>
              <span className="text-sm font-medium">Analisis</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-4" />
            <div className={`flex items-center gap-2 ${step === 'ready' ? 'text-green-600' : 'text-muted-foreground'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === 'ready' ? 'bg-green-500 text-white' : 'bg-gray-200'
              }`}>
                {step === 'ready' ? <CheckCircle2 className="h-4 w-4" /> : '3'}
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
                Analizaremos tu CV para compararlo con los requisitos del puesto
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
            <h2 className="text-xl font-semibold mb-2">Analizando tu perfil</h2>
            <p className="text-muted-foreground mb-6">
              Estamos comparando tu CV con los requisitos del puesto...
            </p>
            <Progress value={65} className="max-w-xs mx-auto" />
          </BrandCard>
        )}

        {step === 'results' && matchResult && (
          <div className="space-y-6">
            {/* Score card */}
            <BrandCard className="p-6">
              <div className="flex items-center gap-4">
                <div className={`h-20 w-20 rounded-full flex items-center justify-center ${getScoreBg(matchResult.score)}`}>
                  <span className={`text-3xl font-bold ${getScoreColor(matchResult.score)}`}>
                    {matchResult.score}%
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold">
                    {matchResult.score >= 80 ? 'Excelente match!' :
                     matchResult.score >= 60 ? 'Buen match' :
                     'Match parcial'}
                  </h2>
                  <p className="text-muted-foreground">
                    Tu perfil tiene un {matchResult.score}% de compatibilidad con el puesto
                  </p>
                </div>
              </div>
            </BrandCard>

            {/* Skills match */}
            <BrandCard>
              <BrandCardHeader title="Analisis de habilidades" />
              <div className="p-6 pt-0 space-y-4">
                {matchResult.matching_skills.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Habilidades que coinciden
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {matchResult.matching_skills.map((skill, idx) => (
                        <Badge key={idx} className="bg-green-100 text-green-700">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {matchResult.missing_skills.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Habilidades a desarrollar
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {matchResult.missing_skills.map((skill, idx) => (
                        <Badge key={idx} variant="outline" className="text-amber-700 border-amber-300">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </BrandCard>

            {/* Recommendations */}
            {matchResult.recommendations.length > 0 && (
              <BrandCard>
                <BrandCardHeader title="Recomendaciones" />
                <div className="p-6 pt-0">
                  <ul className="space-y-2">
                    {matchResult.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Sparkles className="h-4 w-4 text-bloque-gold500 mt-0.5 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </BrandCard>
            )}

            {/* Action */}
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => { setStep('upload'); setFile(null) }}
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Subir otro CV
              </Button>
              <Button
                onClick={handleProceedToInterview}
                className="flex-1"
                size="lg"
              >
                Continuar a entrevista
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>

            {matchResult.score < 70 && (
              <p className="text-sm text-muted-foreground text-center">
                Aunque el match no es perfecto, la entrevista te permite demostrar tus habilidades
              </p>
            )}
          </div>
        )}

        {step === 'ready' && (
          <BrandCard className="p-8 text-center">
            <Loader2 className="h-16 w-16 text-bloque-gold500 mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-semibold mb-2">Preparando tu entrevista</h2>
            <p className="text-muted-foreground">
              En un momento comenzaras tu entrevista con IA...
            </p>
          </BrandCard>
        )}
      </div>
    </AppShell>
  )
}
