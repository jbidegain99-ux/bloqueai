'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/auth'
import { candidateApi } from '@/lib/api'
import { Upload, FileText, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'

export default function ResumePage() {
  const router = useRouter()
  const { accessToken, isAuthenticated } = useAuthStore()
  const [resumes, setResumes] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    loadResumes()
  }, [isAuthenticated, accessToken, router])

  const loadResumes = async () => {
    if (!accessToken) return
    try {
      const data = await candidateApi.getResumes(accessToken)
      setResumes(data as any[])
    } catch (err) {
      console.error('Error loading resumes:', err)
    }
  }

  const handleUpload = async (file: File) => {
    if (!accessToken) return
    setError('')
    setUploading(true)

    try {
      await candidateApi.uploadResume(accessToken, file)
      await loadResumes()
    } catch (err: any) {
      setError(err.message || 'Error al subir el archivo')
    } finally {
      setUploading(false)
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0])
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" /> Procesado</Badge>
      case 'PROCESSING':
        return <Badge variant="warning"><Clock className="h-3 w-3 mr-1" /> Procesando</Badge>
      case 'PENDING':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Pendiente</Badge>
      case 'FAILED':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Error</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (!isAuthenticated) return null

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-bloque-navy900 mb-6">
          Subir CV
        </h1>

        {/* Upload area */}
        <BrandCard className="mb-6">
          <BrandCardHeader
            title="Sube tu CV"
            description="Arrastra tu archivo aquí o haz clic para seleccionar. Formatos: PDF, DOCX"
          />

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-bloque-gold500 bg-bloque-gold500/5'
                : 'border-bloque-slate200 hover:border-bloque-navy700'
            }`}
          >
            <input
              type="file"
              id="file-upload"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileInput}
              className="hidden"
              disabled={uploading}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="flex flex-col items-center gap-4">
                <div className={`p-4 rounded-full ${dragActive ? 'bg-bloque-gold500/20' : 'bg-bloque-gray50'}`}>
                  <Upload className={`h-8 w-8 ${dragActive ? 'text-bloque-gold500' : 'text-bloque-navy900'}`} />
                </div>
                {uploading ? (
                  <p className="text-muted-foreground">Subiendo archivo...</p>
                ) : (
                  <>
                    <p className="text-bloque-navy900 font-medium">
                      Arrastra tu CV aquí
                    </p>
                    <p className="text-sm text-muted-foreground">
                      o haz clic para seleccionar un archivo
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF o DOCX, máximo 10MB
                    </p>
                  </>
                )}
              </div>
            </label>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-md text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </BrandCard>

        {/* Uploaded resumes */}
        {resumes.length > 0 && (
          <BrandCard>
            <BrandCardHeader
              title="CVs subidos"
              description="Historial de archivos procesados"
            />
            <div className="space-y-3">
              {resumes.map((resume) => (
                <div
                  key={resume.id}
                  className="flex items-center justify-between p-3 bg-bloque-gray50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded">
                      <FileText className="h-5 w-5 text-bloque-navy900" />
                    </div>
                    <div>
                      <p className="font-medium text-bloque-navy900 text-sm">
                        {resume.filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {resume.file_size} • {resume.file_type.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(resume.status)}
                </div>
              ))}
            </div>
          </BrandCard>
        )}

        {/* Help text */}
        <div className="mt-6 p-4 bg-bloque-gray50 rounded-lg">
          <h3 className="font-medium text-bloque-navy900 mb-2">
            ¿Qué pasa después de subir mi CV?
          </h3>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Nuestra IA extrae automáticamente tus datos</li>
            <li>Se analiza tu experiencia, habilidades y educación</li>
            <li>Tu perfil se actualiza con la información extraída</li>
            <li>Puedes completar una entrevista IA para mejorar tu perfil</li>
          </ol>
        </div>
      </div>
    </AppShell>
  )
}
