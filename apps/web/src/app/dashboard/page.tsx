'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore, isCandidate, isEmployer, isRecruiter, isAdmin } from '@/lib/auth'
import { AppShell } from '@/components/brand/AppShell'
import { BrandHero } from '@/components/brand/BrandHero'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { Button } from '@/components/ui/button'
import { FileText, MessageSquare, Briefcase, Users, BarChart3, Settings } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated || !user) {
    return null
  }

  const renderCandidateDashboard = () => (
    <>
      <BrandHero
        title={`¡Hola, ${user.full_name.split(' ')[0]}!`}
        subtitle="Bienvenido a TalentOS. Completa tu perfil para encontrar las mejores oportunidades."
        size="md"
      />
      <div className="grid md:grid-cols-3 gap-6 mt-6">
        <BrandCard hover>
          <BrandCardHeader
            title="Subir CV"
            description="Sube tu CV para que nuestra IA extraiga tu perfil"
          />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-bloque-gray50 rounded-lg">
              <FileText className="h-6 w-6 text-bloque-navy900" />
            </div>
            <Link href="/candidate/resume">
              <Button variant="outline">Subir ahora</Button>
            </Link>
          </div>
        </BrandCard>

        <BrandCard hover>
          <BrandCardHeader
            title="Entrevista IA"
            description="Completa una entrevista con nuestra IA para evaluar tus competencias"
          />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-bloque-gray50 rounded-lg">
              <MessageSquare className="h-6 w-6 text-bloque-navy900" />
            </div>
            <Link href="/candidate/interview">
              <Button>Iniciar entrevista</Button>
            </Link>
          </div>
        </BrandCard>

        <BrandCard hover>
          <BrandCardHeader
            title="Mi Perfil"
            description="Revisa tu perfil generado por IA y tus puntuaciones"
          />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-bloque-gray50 rounded-lg">
              <Users className="h-6 w-6 text-bloque-navy900" />
            </div>
            <Link href="/candidate/profile">
              <Button variant="outline">Ver perfil</Button>
            </Link>
          </div>
        </BrandCard>
      </div>
    </>
  )

  const renderEmployerDashboard = () => (
    <>
      <BrandHero
        title="Panel de Reclutamiento"
        subtitle="Gestiona tus vacantes y encuentra el mejor talento con IA"
        size="md"
      />
      <div className="grid md:grid-cols-3 gap-6 mt-6">
        <BrandCard hover>
          <BrandCardHeader
            title="Mis Trabajos"
            description="Gestiona tus vacantes activas y crea nuevas"
          />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-bloque-gray50 rounded-lg">
              <Briefcase className="h-6 w-6 text-bloque-navy900" />
            </div>
            <Link href="/employer/jobs">
              <Button>Ver trabajos</Button>
            </Link>
          </div>
        </BrandCard>

        <BrandCard hover>
          <BrandCardHeader
            title="Shortlists"
            description="Revisa los candidatos rankeados por IA"
          />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-bloque-gray50 rounded-lg">
              <Users className="h-6 w-6 text-bloque-navy900" />
            </div>
            <Link href="/employer/jobs">
              <Button variant="outline">Ver shortlists</Button>
            </Link>
          </div>
        </BrandCard>

        <BrandCard hover>
          <BrandCardHeader
            title="Crear Vacante"
            description="Publica una nueva posición para recibir candidatos"
          />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-bloque-gray50 rounded-lg">
              <FileText className="h-6 w-6 text-bloque-navy900" />
            </div>
            <Link href="/employer/jobs/new">
              <Button>Crear trabajo</Button>
            </Link>
          </div>
        </BrandCard>
      </div>
    </>
  )

  const renderAdminDashboard = () => (
    <>
      <BrandHero
        title="Panel de Administración"
        subtitle="Gestiona rúbricas, revisa entrevistas y monitorea KPIs"
        size="md"
      />
      <div className="grid md:grid-cols-4 gap-6 mt-6">
        <BrandCard hover>
          <BrandCardHeader
            title="KPIs"
            description="Métricas del sistema"
          />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-bloque-gray50 rounded-lg">
              <BarChart3 className="h-6 w-6 text-bloque-navy900" />
            </div>
            <Link href="/admin/kpis">
              <Button variant="outline" size="sm">Ver KPIs</Button>
            </Link>
          </div>
        </BrandCard>

        <BrandCard hover>
          <BrandCardHeader
            title="Rúbricas"
            description="Calibrar evaluaciones"
          />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-bloque-gray50 rounded-lg">
              <Settings className="h-6 w-6 text-bloque-navy900" />
            </div>
            <Link href="/admin/rubrics">
              <Button variant="outline" size="sm">Gestionar</Button>
            </Link>
          </div>
        </BrandCard>

        <BrandCard hover>
          <BrandCardHeader
            title="Entrevistas"
            description="Revisar flaggeadas"
          />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-bloque-gray50 rounded-lg">
              <MessageSquare className="h-6 w-6 text-bloque-navy900" />
            </div>
            <Link href="/admin/interviews">
              <Button variant="outline" size="sm">Revisar</Button>
            </Link>
          </div>
        </BrandCard>

        <BrandCard hover>
          <BrandCardHeader
            title="Trabajos"
            description="Ver todas las vacantes"
          />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-bloque-gray50 rounded-lg">
              <Briefcase className="h-6 w-6 text-bloque-navy900" />
            </div>
            <Link href="/employer/jobs">
              <Button variant="outline" size="sm">Ver trabajos</Button>
            </Link>
          </div>
        </BrandCard>
      </div>
    </>
  )

  return (
    <AppShell>
      {isCandidate() && renderCandidateDashboard()}
      {isEmployer() && !isRecruiter() && !isAdmin() && renderEmployerDashboard()}
      {(isRecruiter() || isAdmin()) && renderAdminDashboard()}
    </AppShell>
  )
}
