'use client'

import * as React from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Briefcase,
  GripVertical,
  Search,
  Filter,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { smooth } from '@/lib/animations'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

// ── Types ─────────────────────────────────────────────────

interface KanbanCandidate {
  id: string
  name: string
  email?: string
  jobTitle?: string
  matchScore?: number | null
  avatarUrl?: string | null
  appliedAt?: string
}

interface KanbanColumn {
  key: string
  label: string
  color: string
}

interface KanbanBoardProps {
  candidates: Record<string, KanbanCandidate[]>
  columns?: KanbanColumn[]
  onStatusChange?: (candidateId: string, fromColumn: string, toColumn: string) => void
  loading?: boolean
  className?: string
}

// ── Default columns ───────────────────────────────────────

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { key: 'applied', label: 'Aplicados', color: 'bg-brand-500' },
  { key: 'screening', label: 'Screening', color: 'bg-info-500' },
  { key: 'interview', label: 'Entrevista', color: 'bg-warning-500' },
  { key: 'offer', label: 'Oferta', color: 'bg-success-500' },
  { key: 'hired', label: 'Contratado', color: 'bg-success-700' },
  { key: 'rejected', label: 'Rechazado', color: 'bg-error-500' },
]

// ── Candidate Card ────────────────────────────────────────

interface CandidateCardProps {
  candidate: KanbanCandidate
  isDragging?: boolean
}

function CandidateCard({ candidate, isDragging = false }: CandidateCardProps) {
  const initials = candidate.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const scoreColor =
    candidate.matchScore != null
      ? candidate.matchScore >= 80
        ? 'text-success-600 bg-success-50'
        : candidate.matchScore >= 60
          ? 'text-warning-600 bg-warning-50'
          : 'text-error-500 bg-error-50'
      : ''

  return (
    <div
      className={cn(
        'rounded-lg border border-neutral-200 bg-white p-3 shadow-soft transition-shadow',
        isDragging ? 'shadow-elevated rotate-2 opacity-90' : 'hover:shadow-medium'
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-shrink-0 mt-0.5 cursor-grab active:cursor-grabbing text-neutral-300 hover:text-neutral-500 transition-colors">
          <GripVertical className="h-4 w-4" />
        </div>
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-bloque-navy900 truncate">
            {candidate.name}
          </p>
          {candidate.jobTitle && (
            <p className="text-xs text-neutral-500 truncate flex items-center gap-1 mt-0.5">
              <Briefcase className="h-3 w-3 flex-shrink-0" />
              {candidate.jobTitle}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            {candidate.matchScore != null && (
              <span
                className={cn(
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded tabular-nums',
                  scoreColor
                )}
              >
                {candidate.matchScore}%
              </span>
            )}
            {candidate.appliedAt && (
              <span className="text-[10px] text-neutral-400">
                {new Date(candidate.appliedAt).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sortable Card Wrapper ─────────────────────────────────

function SortableCandidateCard({ candidate }: { candidate: KanbanCandidate }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: candidate.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CandidateCard candidate={candidate} />
    </div>
  )
}

// ── Column ────────────────────────────────────────────────

interface ColumnProps {
  column: KanbanColumn
  candidates: KanbanCandidate[]
  isOver?: boolean
}

function Column({ column, candidates, isOver }: ColumnProps) {
  const { setNodeRef } = useSortable({
    id: `column-${column.key}`,
    data: { type: 'column', columnKey: column.key },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-xl border border-neutral-200 bg-bloque-gray50 min-w-[260px] w-[280px] flex-shrink-0 transition-colors duration-200',
        isOver && 'border-brand-300 bg-brand-50/30'
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <div className={cn('h-2.5 w-2.5 rounded-full', column.color)} />
          <span className="text-xs font-semibold text-bloque-navy900">
            {column.label}
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] h-5 min-w-[24px] justify-center">
          {candidates.length}
        </Badge>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)] min-h-[120px]">
        <SortableContext
          items={candidates.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <AnimatePresence>
            {candidates.map((candidate) => (
              <motion.div
                key={candidate.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={smooth}
                layout
              >
                <SortableCandidateCard candidate={candidate} />
              </motion.div>
            ))}
          </AnimatePresence>
        </SortableContext>

        {candidates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <User className="h-6 w-6 text-neutral-300 mb-1.5" />
            <p className="text-[10px] text-neutral-400">Sin candidatos</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────

function KanbanSkeleton({ columns = 6 }: { columns?: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          className="min-w-[260px] w-[280px] flex-shrink-0 rounded-xl border border-neutral-200 bg-bloque-gray50"
        >
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-neutral-200">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-3 w-20" />
            <div className="flex-1" />
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>
          <div className="p-2 space-y-2">
            {Array.from({ length: Math.max(1, 3 - i) }).map((_, j) => (
              <div
                key={j}
                className="rounded-lg border border-neutral-200 bg-white p-3"
              >
                <div className="flex items-start gap-2.5">
                  <Skeleton className="h-4 w-4 mt-0.5" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────

function KanbanBoard({
  candidates,
  columns: columnsProp,
  onStatusChange,
  loading = false,
  className,
}: KanbanBoardProps) {
  const columns = columnsProp ?? DEFAULT_COLUMNS

  // Internal state for optimistic updates
  const [boardState, setBoardState] = React.useState<Record<string, KanbanCandidate[]>>(candidates)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [overColumnKey, setOverColumnKey] = React.useState<string | null>(null)
  const [filterText, setFilterText] = React.useState('')
  const [filterJob, setFilterJob] = React.useState('')

  // Sync external data
  React.useEffect(() => {
    setBoardState(candidates)
  }, [candidates])

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  // Find which column a candidate is in
  const findColumnForCandidate = React.useCallback(
    (candidateId: string): string | null => {
      for (const [columnKey, items] of Object.entries(boardState)) {
        if (items.some((c) => c.id === candidateId)) {
          return columnKey
        }
      }
      return null
    },
    [boardState]
  )

  // Find active candidate
  const activeCandidate = React.useMemo(() => {
    if (!activeId) return null
    for (const items of Object.values(boardState)) {
      const found = items.find((c) => c.id === activeId)
      if (found) return found
    }
    return null
  }, [activeId, boardState])

  // Collect unique job titles for filter
  const jobTitles = React.useMemo(() => {
    const titles = new Set<string>()
    for (const items of Object.values(boardState)) {
      for (const c of items) {
        if (c.jobTitle) titles.add(c.jobTitle)
      }
    }
    return Array.from(titles).sort()
  }, [boardState])

  // Filter candidates
  const filteredBoard = React.useMemo(() => {
    const result: Record<string, KanbanCandidate[]> = {}
    for (const [columnKey, items] of Object.entries(boardState)) {
      result[columnKey] = items.filter((c) => {
        const matchesText =
          !filterText ||
          c.name.toLowerCase().includes(filterText.toLowerCase()) ||
          c.email?.toLowerCase().includes(filterText.toLowerCase())
        const matchesJob = !filterJob || c.jobTitle === filterJob
        return matchesText && matchesJob
      })
    }
    return result
  }, [boardState, filterText, filterJob])

  // ── DnD handlers ──────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (!over) {
      setOverColumnKey(null)
      return
    }

    const overId = String(over.id)

    // Check if hovering over a column
    if (overId.startsWith('column-')) {
      setOverColumnKey(overId.replace('column-', ''))
      return
    }

    // Hovering over a candidate card — find its column
    const targetColumn = findColumnForCandidate(overId)
    setOverColumnKey(targetColumn)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setOverColumnKey(null)

    if (!over) return

    const activeIdStr = String(active.id)
    const overId = String(over.id)
    const sourceColumn = findColumnForCandidate(activeIdStr)
    if (!sourceColumn) return

    // Determine target column
    let targetColumn: string | null = null
    if (overId.startsWith('column-')) {
      targetColumn = overId.replace('column-', '')
    } else {
      targetColumn = findColumnForCandidate(overId)
    }

    if (!targetColumn || sourceColumn === targetColumn) return

    // Optimistic update
    setBoardState((prev) => {
      const next = { ...prev }
      const candidate = next[sourceColumn]?.find((c) => c.id === activeIdStr)
      if (!candidate) return prev

      next[sourceColumn] = next[sourceColumn].filter((c) => c.id !== activeIdStr)
      next[targetColumn] = [...(next[targetColumn] || []), candidate]
      return next
    })

    // Notify parent
    onStatusChange?.(activeIdStr, sourceColumn, targetColumn)
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setOverColumnKey(null)
  }

  // ── Render ────────────────────────────────────────────

  if (loading) {
    return (
      <div className={className}>
        <KanbanSkeleton columns={columns.length} />
      </div>
    )
  }

  const hasFilters = filterText !== '' || filterJob !== ''

  return (
    <div className={className}>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar candidato..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-8 pr-3 text-sm text-bloque-navy900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
          />
        </div>
        {jobTitles.length > 0 && (
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
            <select
              value={filterJob}
              onChange={(e) => setFilterJob(e.target.value)}
              className="appearance-none rounded-lg border border-neutral-200 bg-white py-2 pl-8 pr-8 text-sm text-bloque-navy900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
            >
              <option value="">Todas las vacantes</option>
              {jobTitles.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
          </div>
        )}
        {hasFilters && (
          <button
            onClick={() => {
              setFilterText('')
              setFilterJob('')
            }}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-bloque-navy900 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <Column
              key={column.key}
              column={column}
              candidates={filteredBoard[column.key] ?? []}
              isOver={overColumnKey === column.key}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCandidate ? (
            <div className="w-[256px]">
              <CandidateCard candidate={activeCandidate} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

export { KanbanBoard, DEFAULT_COLUMNS }
export type { KanbanBoardProps, KanbanCandidate, KanbanColumn }
