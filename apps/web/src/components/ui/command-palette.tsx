'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search,
  LayoutDashboard,
  Briefcase,
  Users,
  MessageSquare,
  Settings,
  FileText,
  BarChart3,
  Building2,
  User,
  ClipboardList,
  LogOut,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore, isCandidate, isEmployer, isRecruiter, isAdmin } from '@/lib/auth'

// ── Types ─────────────────────────────────────────────────

interface CommandItem {
  id: string
  label: string
  icon: React.ReactNode
  href?: string
  action?: () => void
  group: string
  keywords?: string[]
}

// ── Main component ────────────────────────────────────────

function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()
  const { logout } = useAuthStore()

  // Keyboard shortcut
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        e.stopPropagation()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [])

  const handleSelect = (item: CommandItem) => {
    setOpen(false)
    if (item.href) {
      router.push(item.href)
    } else if (item.action) {
      item.action()
    }
  }

  // Build navigation items based on role
  const items = React.useMemo((): CommandItem[] => {
    const common: CommandItem[] = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: <LayoutDashboard className="h-4 w-4" />,
        href: '/dashboard',
        group: 'Navegación',
        keywords: ['inicio', 'home', 'panel'],
      },
    ]

    if (isCandidate()) {
      return [
        ...common,
        {
          id: 'jobs',
          label: 'Explorar Puestos',
          icon: <Search className="h-4 w-4" />,
          href: '/candidate/jobs',
          group: 'Navegación',
          keywords: ['vacantes', 'buscar', 'empleo'],
        },
        {
          id: 'applications',
          label: 'Mis Aplicaciones',
          icon: <ClipboardList className="h-4 w-4" />,
          href: '/candidate/applications',
          group: 'Navegación',
          keywords: ['aplicaciones', 'postulaciones'],
        },
        {
          id: 'profile',
          label: 'Mi Perfil',
          icon: <User className="h-4 w-4" />,
          href: '/candidate/profile',
          group: 'Navegación',
        },
        {
          id: 'resume',
          label: 'Subir CV',
          icon: <FileText className="h-4 w-4" />,
          href: '/candidate/resume',
          group: 'Acciones',
          keywords: ['curriculum', 'cv', 'upload'],
        },
        {
          id: 'interview',
          label: 'Entrevista IA',
          icon: <MessageSquare className="h-4 w-4" />,
          href: '/candidate/interview',
          group: 'Acciones',
        },
        {
          id: 'cv-builder',
          label: 'CV Builder IA',
          icon: <FileText className="h-4 w-4" />,
          href: '/candidate/cv-builder',
          group: 'Acciones',
          keywords: ['crear cv', 'generar'],
        },
      ]
    }

    if (isRecruiter() || isAdmin()) {
      return [
        ...common,
        {
          id: 'admin-dashboard',
          label: 'Dashboard Admin',
          icon: <BarChart3 className="h-4 w-4" />,
          href: '/admin/dashboard',
          group: 'Navegación',
          keywords: ['metricas', 'kpis'],
        },
        {
          id: 'jobs',
          label: 'Vacantes',
          icon: <Briefcase className="h-4 w-4" />,
          href: '/employer/jobs',
          group: 'Navegación',
        },
        {
          id: 'clients',
          label: 'Clientes',
          icon: <Building2 className="h-4 w-4" />,
          href: '/admin/clients',
          group: 'Navegación',
        },
        {
          id: 'interviews',
          label: 'Entrevistas',
          icon: <MessageSquare className="h-4 w-4" />,
          href: '/admin/interviews',
          group: 'Navegación',
        },
        {
          id: 'rubrics',
          label: 'Rúbricas',
          icon: <Settings className="h-4 w-4" />,
          href: '/admin/rubrics',
          group: 'Navegación',
        },
        {
          id: 'kpis',
          label: 'KPIs',
          icon: <BarChart3 className="h-4 w-4" />,
          href: '/admin/kpis',
          group: 'Navegación',
        },
        {
          id: 'placements',
          label: 'Placements',
          icon: <FileText className="h-4 w-4" />,
          href: '/admin/placements',
          group: 'Navegación',
        },
        {
          id: 'new-job',
          label: 'Nueva Vacante',
          icon: <Plus className="h-4 w-4" />,
          href: '/employer/jobs/new',
          group: 'Acciones',
          keywords: ['crear', 'publicar'],
        },
        {
          id: 'payroll',
          label: 'Nómina',
          icon: <Users className="h-4 w-4" />,
          href: '/admin/payroll/dashboard',
          group: 'Navegación',
          keywords: ['nomina', 'payroll', 'salarios'],
        },
        {
          id: 'settings',
          label: 'Configuración',
          icon: <Settings className="h-4 w-4" />,
          href: '/admin/settings',
          group: 'Navegación',
        },
      ]
    }

    if (isEmployer()) {
      return [
        ...common,
        {
          id: 'employer-dashboard',
          label: 'Dashboard Employer',
          icon: <LayoutDashboard className="h-4 w-4" />,
          href: '/employer/dashboard',
          group: 'Navegación',
        },
        {
          id: 'jobs',
          label: 'Mis Vacantes',
          icon: <Briefcase className="h-4 w-4" />,
          href: '/employer/jobs',
          group: 'Navegación',
        },
        {
          id: 'shortlists',
          label: 'Shortlists',
          icon: <Users className="h-4 w-4" />,
          href: '/employer/shortlists',
          group: 'Navegación',
        },
        {
          id: 'new-job',
          label: 'Nueva Vacante',
          icon: <Plus className="h-4 w-4" />,
          href: '/employer/jobs/new',
          group: 'Acciones',
          keywords: ['crear', 'publicar'],
        },
      ]
    }

    return common
  }, [])

  const logoutItem: CommandItem = {
    id: 'logout',
    label: 'Cerrar Sesión',
    icon: <LogOut className="h-4 w-4" />,
    action: () => {
      logout()
      router.push('/login')
    },
    group: 'Cuenta',
    keywords: ['salir', 'logout'],
  }

  const allItems = [...items, logoutItem]
  const groups = Array.from(new Set(allItems.map((i) => i.group)))

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-x-0 top-[20%] z-50 mx-auto max-w-lg px-4"
          >
            <Command
              className="rounded-xl border border-neutral-200 bg-white shadow-overlay overflow-hidden"
              loop
            >
              {/* Input */}
              <div className="flex items-center border-b border-neutral-200 px-3">
                <Search className="h-4 w-4 text-neutral-400 mr-2 flex-shrink-0" />
                <Command.Input
                  placeholder="Buscar páginas, acciones..."
                  className="flex-1 h-12 bg-transparent text-sm text-bloque-navy900 placeholder:text-neutral-400 outline-none"
                />
                <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-neutral-200 bg-neutral-50 px-1.5 text-[10px] font-medium text-neutral-500">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <Command.List className="max-h-[300px] overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center text-sm text-neutral-500">
                  No se encontraron resultados.
                </Command.Empty>

                {groups.map((group) => {
                  const groupItems = allItems.filter((i) => i.group === group)
                  return (
                    <Command.Group
                      key={group}
                      heading={group}
                      className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-neutral-400"
                    >
                      {groupItems.map((item) => (
                        <Command.Item
                          key={item.id}
                          value={`${item.label} ${item.keywords?.join(' ') ?? ''}`}
                          onSelect={() => handleSelect(item)}
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-bloque-navy900 cursor-pointer transition-colors data-[selected=true]:bg-brand-50 data-[selected=true]:text-brand-600"
                        >
                          <span className="flex-shrink-0 text-neutral-500 data-[selected=true]:text-brand-500">
                            {item.icon}
                          </span>
                          <span className="flex-1">{item.label}</span>
                          {item.href && (
                            <span className="text-[10px] text-neutral-400 hidden sm:block">
                              {item.href}
                            </span>
                          )}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )
                })}
              </Command.List>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-neutral-200 px-3 py-2">
                <span className="text-[10px] text-neutral-400">
                  TalentOS Command Palette
                </span>
                <div className="flex items-center gap-2">
                  <kbd className="inline-flex h-5 items-center rounded border border-neutral-200 bg-neutral-50 px-1.5 text-[10px] font-medium text-neutral-500">
                    ↑↓
                  </kbd>
                  <span className="text-[10px] text-neutral-400">navegar</span>
                  <kbd className="inline-flex h-5 items-center rounded border border-neutral-200 bg-neutral-50 px-1.5 text-[10px] font-medium text-neutral-500">
                    ↵
                  </kbd>
                  <span className="text-[10px] text-neutral-400">seleccionar</span>
                </div>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export { CommandPalette }
