'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  Briefcase,
  MessageSquare,
  Search,
  AlertTriangle,
  FileText,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { smooth } from '@/lib/animations'
import { Button } from '@/components/ui/button'

// ── Types ─────────────────────────────────────────────────

type EmptyStateVariant =
  | 'candidates'
  | 'jobs'
  | 'interviews'
  | 'search'
  | 'error'
  | 'applications'
  | 'generic'

interface EmptyStateAction {
  label: string
  onClick: () => void
}

interface EmptyStateProps {
  variant?: EmptyStateVariant
  title?: string
  description?: string
  action?: EmptyStateAction
  icon?: React.ReactNode
  className?: string
}

// ── Variant config ────────────────────────────────────────

interface VariantConfig {
  icon: React.ReactNode
  title: string
  description: string
  bgColor: string
  iconColor: string
}

const variantDefaults: Record<EmptyStateVariant, VariantConfig> = {
  candidates: {
    icon: <Users className="h-8 w-8" />,
    title: 'No hay candidatos',
    description: 'Comienza publicando tu primera vacante para atraer talento.',
    bgColor: 'bg-brand-50',
    iconColor: 'text-brand-500',
  },
  jobs: {
    icon: <Briefcase className="h-8 w-8" />,
    title: 'No hay vacantes',
    description: 'Crea tu primera vacante para empezar a recibir aplicaciones.',
    bgColor: 'bg-warning-50',
    iconColor: 'text-warning-600',
  },
  interviews: {
    icon: <MessageSquare className="h-8 w-8" />,
    title: 'No hay entrevistas',
    description: 'Las entrevistas aparecerán cuando los candidatos completen el proceso.',
    bgColor: 'bg-info-50',
    iconColor: 'text-info-500',
  },
  search: {
    icon: <Search className="h-8 w-8" />,
    title: 'Sin resultados',
    description: 'No se encontraron resultados. Intenta con otros términos de búsqueda.',
    bgColor: 'bg-neutral-100',
    iconColor: 'text-neutral-400',
  },
  error: {
    icon: <AlertTriangle className="h-8 w-8" />,
    title: 'Algo salió mal',
    description: 'No pudimos cargar los datos. Por favor intenta de nuevo.',
    bgColor: 'bg-error-50',
    iconColor: 'text-error-500',
  },
  applications: {
    icon: <FileText className="h-8 w-8" />,
    title: 'No hay aplicaciones',
    description: 'Aún no has aplicado a ninguna vacante. Explora oportunidades disponibles.',
    bgColor: 'bg-success-50',
    iconColor: 'text-success-600',
  },
  generic: {
    icon: <Inbox className="h-8 w-8" />,
    title: 'No hay datos',
    description: 'No hay información para mostrar en este momento.',
    bgColor: 'bg-neutral-100',
    iconColor: 'text-neutral-400',
  },
}

// ── Main component ────────────────────────────────────────

function EmptyState({
  variant = 'generic',
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps) {
  const config = variantDefaults[variant]

  const displayIcon = icon ?? config.icon
  const displayTitle = title ?? config.title
  const displayDescription = description ?? config.description

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={smooth}
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className
      )}
    >
      {/* Icon circle */}
      <div
        className={cn(
          'flex h-16 w-16 items-center justify-center rounded-2xl mb-5',
          config.bgColor,
          config.iconColor
        )}
      >
        {displayIcon}
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-bloque-navy900 mb-1.5">
        {displayTitle}
      </h3>

      {/* Description */}
      <p className="text-sm text-neutral-500 max-w-sm leading-relaxed">
        {displayDescription}
      </p>

      {/* CTA */}
      {action && (
        <Button
          variant="primary"
          className="mt-5"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </motion.div>
  )
}

export { EmptyState }
export type { EmptyStateProps, EmptyStateVariant, EmptyStateAction }
