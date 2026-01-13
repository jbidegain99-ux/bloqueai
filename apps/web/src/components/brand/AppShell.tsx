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
} from 'lucide-react'
import { Logo } from './Logo'
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

  // Main navigation tabs
  const mainTabs = [
    { id: 'talento', label: 'Talento', href: '/dashboard', icon: Users },
    { id: 'nomina', label: 'Personal y Nómina', href: '#', icon: Briefcase, disabled: true },
    { id: 'proyectos', label: 'Proyectos', href: '#', icon: FolderKanban, disabled: true },
  ]

  // Role-specific navigation
  const getRoleNav = () => {
    if (isCandidate()) {
      return [
        { label: 'Explorar Puestos', href: '/candidate/jobs', icon: Search },
        { label: 'Mis Aplicaciones', href: '/candidate/applications', icon: ClipboardList },
        { label: 'Mi Perfil', href: '/candidate/profile', icon: User },
      ]
    }

    if (isEmployer()) {
      return [
        { label: 'Dashboard', href: '/employer/dashboard', icon: LayoutDashboard },
        { label: 'Trabajos', href: '/employer/jobs', icon: Briefcase },
        { label: 'Shortlists', href: '/employer/shortlists', icon: Users },
      ]
    }

    if (isRecruiter() || isAdmin()) {
      return [
        { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
        { label: 'Trabajos', href: '/employer/jobs', icon: Briefcase },
        { label: 'Rúbricas', href: '/admin/rubrics', icon: Settings },
        { label: 'Entrevistas', href: '/admin/interviews', icon: MessageSquare },
        { label: 'KPIs', href: '/admin/kpis', icon: BarChart3 },
      ]
    }

    return []
  }

  return (
    <div className="min-h-screen bg-bloque-gray50">
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
                        : pathname.startsWith(tab.href) || (tab.id === 'talento' && pathname === '/dashboard')
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
              {getRoleNav().map((item) => (
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
        {children}
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
