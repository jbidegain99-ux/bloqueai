'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth'
import {
  employeeApi,
  type EmployeeDocumentItem,
} from '@/lib/api'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft,
  AlertCircle,
  FileText,
  Download,
  Printer,
  FilePlus,
  Clock,
  CheckCircle2,
  Loader2,
} from 'lucide-react'

// ── Page ────────────────────────────────────────────────────────
export default function EmployeeDocumentsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()

  const [documents, setDocuments] = useState<EmployeeDocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatingType, setGeneratingType] = useState<string | null>(null)
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated || !accessToken) {
      router.push('/login')
      return
    }

    const load = async () => {
      try {
        const res = await employeeApi.getDocuments(accessToken)
        setDocuments(res)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al cargar los documentos'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isHydrated, isAuthenticated, accessToken, router])

  const handleGenerate = async (type: string) => {
    if (!accessToken) return
    setGeneratingType(type)
    setError(null)

    try {
      const res =
        type === 'proof_of_income'
          ? await employeeApi.generateProofOfIncome(accessToken)
          : await employeeApi.generateDocument(accessToken, type)
      setGeneratedHtml(res.html)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al generar el documento'
      setError(msg)
    } finally {
      setGeneratingType(null)
    }
  }

  const handlePrintGenerated = () => {
    if (!generatedHtml) return
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(generatedHtml)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    }
  }

  if (!isHydrated || loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error && !documents.length) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/portal')}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Portal
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-bloque-navy900">Mis Documentos</h1>
          <p className="text-sm text-muted-foreground">
            Genera y descarga tus documentos laborales
          </p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Generated Document Preview */}
      {generatedHtml && (
        <BrandCard>
          <BrandCardHeader
            title="Documento Generado"
            action={
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrintGenerated}>
                  <Printer className="h-4 w-4 mr-1" />
                  Imprimir
                </Button>
                <Button size="sm" onClick={handlePrintGenerated}>
                  <Download className="h-4 w-4 mr-1" />
                  Descargar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGeneratedHtml(null)}
                >
                  Cerrar
                </Button>
              </div>
            }
          />
          <div
            className="border border-bloque-slate200 rounded-lg p-6 bg-white max-h-[500px] overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: generatedHtml }}
          />
        </BrandCard>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BrandCard hover onClick={() => handleGenerate('proof_of_income')}>
          <div className="flex flex-col items-center text-center gap-3 py-4">
            {generatingType === 'proof_of_income' ? (
              <Loader2 className="h-10 w-10 text-bloque-navy900 animate-spin" />
            ) : (
              <FilePlus className="h-10 w-10 text-bloque-navy900" />
            )}
            <div>
              <p className="font-semibold text-bloque-navy900">Constancia de Ingresos</p>
              <p className="text-xs text-muted-foreground mt-1">
                Genera una constancia actualizada
              </p>
            </div>
          </div>
        </BrandCard>

        <BrandCard hover onClick={() => handleGenerate('employment_letter')}>
          <div className="flex flex-col items-center text-center gap-3 py-4">
            {generatingType === 'employment_letter' ? (
              <Loader2 className="h-10 w-10 text-bloque-navy900 animate-spin" />
            ) : (
              <FileText className="h-10 w-10 text-bloque-navy900" />
            )}
            <div>
              <p className="font-semibold text-bloque-navy900">Carta de Empleo</p>
              <p className="text-xs text-muted-foreground mt-1">
                Carta oficial de tu relacion laboral
              </p>
            </div>
          </div>
        </BrandCard>

        <BrandCard hover onClick={() => router.push('/portal/payslips')}>
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <Download className="h-10 w-10 text-bloque-navy900" />
            <div>
              <p className="font-semibold text-bloque-navy900">Colillas de Pago</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ver y descargar tus colillas
              </p>
            </div>
          </div>
        </BrandCard>
      </div>

      {/* Documents List */}
      {documents.length > 0 && (
        <BrandCard>
          <BrandCardHeader
            title="Documentos Disponibles"
            description="Historial de documentos generados"
          />
          <div className="divide-y divide-bloque-slate200">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-bloque-gray50 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-bloque-navy900" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-bloque-navy900">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.description}</p>
                    {doc.generated_at && (
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {new Date(doc.generated_at).toLocaleDateString('es-SV')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      doc.available
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }
                  >
                    {doc.available ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Disponible
                      </span>
                    ) : (
                      'No disponible'
                    )}
                  </Badge>
                  {doc.available && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerate(doc.type)}
                      disabled={generatingType === doc.type}
                    >
                      {generatingType === doc.type ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </BrandCard>
      )}

      {/* Empty state */}
      {documents.length === 0 && !loading && (
        <BrandCard className="py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sin documentos previos</h3>
          <p className="text-muted-foreground">
            Usa las opciones de arriba para generar tus documentos laborales.
          </p>
        </BrandCard>
      )}
    </div>
  )
}
