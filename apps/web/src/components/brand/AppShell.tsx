'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Users,
  Briefcase,
  FolderKanban,
  Settings,
  LogOut,
  User,
  LayoutDashboard,
  FileText,
  MessageSquare,
  BarChart3,
  Search,
  ClipboardList,
  Building2,
  Globe,
  CreditCard,
  Sparkles,
  Video,
  DollarSign,
  Bot,
  Download,
  UserCircle,
} from 'lucide-react'
import { Logo } from './Logo'
import { PageTransition } from '@/components/layout/page-transition'
import { CommandPalette } from '@/components/ui/command-palette'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore, isCandidate, isEmployer, isRecruiter, isAdmin } from '@/lib/auth'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const isPayrollSection = pathname.startsWith('/admin/payroll')
  const isPlatformSection = pathname.startsWith('/admin/platform')
  const isEmployeePortal = pathname.startsWith('/portal')

  // Main navigation tabs
  const mainTabs = [
    { id: 'talento', label: 'Talento', href: '/dashboard', icon: Users },
    { id: 'nomina', label: 'Personal y Nómina', href: '/admin/payroll/dashboard', icon: Briefcase },
    ...(isAdmin() ? [{ id: 'plataforma', label: 'Plataforma', href: '/admin/platform', icon: Settings }] : []),
    { id: 'proyectos', label: 'Proyectos', href: '#', icon: FolderKanban, disabled: true },
  ]

  // Employee portal subnav
  const employeeNav = [
    { label: 'Inicio', href: '/portal', icon: LayoutDashboard },
    { label: 'Mis Colillas', href: '/portal/payslips', icon: FileText },
    { label: 'Salario', href: '/portal/salary', icon: DollarSign },
    { label: 'Perfil', href: '/portal/profile', icon: UserCircle },
    { label: 'Documentos', href: '/portal/documents', icon: Download },
    { label: 'Asistente', href: '/portal/assistant', icon: Bot },
  ]

  // Payroll subnav
  const payrollNav = [
    { label: 'Resumen', href: '/admin/payroll/dashboard', icon: LayoutDashboard },
    { label: 'Empleados', href: '/admin/payroll/employees', icon: Users },
    { label: 'Asistencia', href: '/admin/payroll/attendance', icon: ClipboardList },
    { label: 'Nóminas', href: '/admin/payroll/runs', icon: FileText },
    { label: 'Deducciones', href: '/admin/payroll/deductions', icon: Settings },
    { label: 'Reportes', href: '/admin/payroll/reports', icon: BarChart3 },
    { label: 'Clientes', href: '/admin/clients', icon: Building2 },
  ]

  // Platform subnav (admin only)
  const platformNav = [
    { label: 'Resumen', href: '/admin/platform', icon: LayoutDashboard },
    { label: 'Empresas', href: '/admin/platform/tenants', icon: Building2 },
    { label: 'Auditoría', href: '/admin/platform/audit-logs', icon: FileText },
    { label: 'Configuración', href: '/admin/settings', icon: Settings },
  ]

  // Role-specific navigation (order matters: most specific role first)
  const getRoleNav = () => {
    if (isAdmin()) {
      return [
        { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
        { label: 'Trabajos', href: '/employer/jobs', icon: Briefcase },
        { label: 'Clientes', href: '/admin/clients', icon: Building2 },
        { label: 'Rúbricas', href: '/admin/rubrics', icon: Settings },
        { label: 'Entrevistas', href: '/admin/interviews', icon: MessageSquare },
        { label: 'KPIs', href: '/admin/kpis', icon: BarChart3 },
        { label: 'Placements', href: '/admin/placements', icon: FileText },
      ]
    }

    if (isRecruiter()) {
      return [
        { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
        { label: 'Trabajos', href: '/employer/jobs', icon: Briefcase },
        { label: 'Clientes', href: '/admin/clients', icon: Building2 },
        { label: 'Rúbricas', href: '/admin/rubrics', icon: Settings },
        { label: 'Entrevistas', href: '/admin/interviews', icon: MessageSquare },
        { label: 'KPIs', href: '/admin/kpis', icon: BarChart3 },
        { label: 'Placements', href: '/admin/placements', icon: FileText },
      ]
    }

    if (isEmployer()) {
      return [
        { label: 'Dashboard', href: '/employer/dashboard', icon: LayoutDashboard },
        { label: 'Trabajos', href: '/employer/jobs', icon: Briefcase },
        { label: 'Shortlists', href: '/employer/shortlists', icon: Users },
        { label: 'EOR', href: '/employer/eor', icon: Globe },
        { label: 'Facturación', href: '/employer/settings/billing', icon: CreditCard },
      ]
    }

    if (isCandidate()) {
      return [
        { label: 'Explorar Puestos', href: '/candidate/jobs', icon: Search },
        { label: 'Mis Aplicaciones', href: '/candidate/applications', icon: ClipboardList },
        { label: 'Recomendados', href: '/candidate/recommended', icon: Sparkles },
        { label: 'Entrevistas', href: '/candidate/interviews', icon: Video },
        { label: 'Mi Perfil', href: '/candidate/profile', icon: User },
      ]
    }

    return []
  }

  return (
    <div className="min-h-screen bg-bloque-gray50">
      <CommandPalette />
      {/* Top Navigation */}
      <header className="bg-bloque-navy900 text-white">
        {/* Main Header */}
        <div className="border-b border-bloque-blue600">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <Link href="/dashboard">
                <Logo variant="full" size="md" />
              </Link>

              {/* Main Tabs */}
              <nav className="hidden md:flex items-center space-x-1">
                {mainTabs.map((tab) => (
                  <Link
                    key={tab.id}
                    href={tab.href}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      tab.disabled
                        ? 'text-bloque-slate200 cursor-not-allowed'
                        : (tab.id === 'nomina' && isPayrollSection)
                        ? 'bg-bloque-navy700 text-white'
                        : (tab.id === 'talento' && (pathname === '/dashboard' || (pathname.startsWith('/admin/') && !isPayrollSection) || pathname.startsWith('/employer/') || pathname.startsWith('/candidate/')))
                        ? 'bg-bloque-navy700 text-white'
                        : 'text-bloque-slate200 hover:bg-bloque-navy700 hover:text-white'
                    }`}
                    onClick={(e) => tab.disabled && e.preventDefault()}
                  >
                    <span className="flex items-center gap-2">
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                      {tab.disabled && (
                        <span className="text-xs bg-bloque-blue600 px-1.5 py-0.5 rounded">
                          Pronto
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
              </nav>

              {/* User Menu */}
              <div className="flex items-center gap-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar>
                        <AvatarFallback>
                          {user ? getInitials(user.full_name) : 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {user?.full_name || 'Usuario'}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user?.email}
                        </p>
                        <p className="text-xs leading-none text-bloque-gold500 font-medium mt-1">
                          {user?.role}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Cerrar sesión</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Nav */}
        <div className="bg-bloque-navy700">
          <div className="container mx-auto px-4">
            <nav className="flex items-center space-x-1 h-12 overflow-x-auto">
              {(isEmployeePortal ? employeeNav : isPlatformSection ? platformNav : isPayrollSection ? payrollNav : getRoleNav()).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-md ${
                    pathname === item.href || pathname.startsWith(item.href + '/')
                      ? 'bg-bloque-gold500 text-bloque-navy900'
                      : 'text-white hover:bg-bloque-blue600'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <PageTransition>
          {children}
        </PageTransition>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-bloque-slate200 py-4 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 TalentOS by Bloque Internacional. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
