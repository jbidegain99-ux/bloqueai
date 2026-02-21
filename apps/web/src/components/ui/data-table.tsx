'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Search,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem, smooth } from '@/lib/animations'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

// ── Types ─────────────────────────────────────────────────

type SortDirection = 'asc' | 'desc' | null

interface DataTableColumn<T> {
  key: keyof T & string
  header: string
  sortable?: boolean
  filterable?: boolean
  render?: (value: T[keyof T], row: T) => React.ReactNode
  className?: string
}

interface DataTableAction<T> {
  label: string
  onClick: (row: T) => void
  variant?: 'default' | 'destructive'
  icon?: React.ReactNode
}

interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  keyField: keyof T & string
  selectable?: boolean
  actions?: DataTableAction<T>[]
  loading?: boolean
  error?: string
  onRetry?: () => void
  emptyState?: React.ReactNode
  pageSize?: number
  onSelectionChange?: (selected: T[]) => void
  className?: string
}

// ── Helpers ───────────────────────────────────────────────

function sortData<T>(data: T[], key: keyof T, direction: SortDirection): T[] {
  if (!direction) return data
  return [...data].sort((a, b) => {
    const aVal = a[key]
    const bVal = b[key]
    if (aVal == null && bVal == null) return 0
    if (aVal == null) return direction === 'asc' ? -1 : 1
    if (bVal == null) return direction === 'asc' ? 1 : -1
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return direction === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    }
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal
    }
    const aStr = String(aVal)
    const bStr = String(bVal)
    return direction === 'asc'
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr)
  })
}

function filterData<T>(
  data: T[],
  filters: Record<string, string>,
  columns: DataTableColumn<T>[]
): T[] {
  const activeFilters = Object.entries(filters).filter(([, v]) => v.trim() !== '')
  if (activeFilters.length === 0) return data

  return data.filter((row) =>
    activeFilters.every(([key, filterValue]) => {
      const col = columns.find((c) => c.key === key)
      if (!col) return true
      const cellValue = row[col.key]
      if (cellValue == null) return false
      return String(cellValue)
        .toLowerCase()
        .includes(filterValue.toLowerCase())
    })
  )
}

// ── Loading skeleton ──────────────────────────────────────

function DataTableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <div className="space-y-0">
      {/* Header skeleton */}
      <div className="flex gap-4 px-4 py-3 border-b border-neutral-200 bg-bloque-gray50">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1 max-w-[120px]" />
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3 border-b border-neutral-100"
        >
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1 max-w-[140px]" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Error state ───────────────────────────────────────────

function DataTableError({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-50 mb-4">
        <AlertCircle className="h-6 w-6 text-error-500" />
      </div>
      <p className="text-sm font-medium text-bloque-navy900 mb-1">
        Error al cargar datos
      </p>
      <p className="text-sm text-neutral-500 mb-4 max-w-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg border border-bloque-slate200 bg-white px-4 py-2 text-sm font-medium text-bloque-navy900 shadow-soft transition-all duration-150 hover:bg-bloque-gray50 hover:shadow-medium active:scale-[0.98]"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
      )}
    </div>
  )
}

// ── Default empty state ───────────────────────────────────

function DataTableEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 mb-4">
        <Search className="h-6 w-6 text-neutral-400" />
      </div>
      <p className="text-sm font-medium text-bloque-navy900 mb-1">
        Sin resultados
      </p>
      <p className="text-sm text-neutral-500">
        No se encontraron datos para mostrar.
      </p>
    </div>
  )
}

// ── Sort indicator ────────────────────────────────────────

function SortIcon({ direction }: { direction: SortDirection }) {
  if (direction === 'asc') {
    return <ChevronUp className="h-3.5 w-3.5 text-brand-500" />
  }
  if (direction === 'desc') {
    return <ChevronDown className="h-3.5 w-3.5 text-brand-500" />
  }
  return <ChevronsUpDown className="h-3.5 w-3.5 text-neutral-400" />
}

// ── Checkbox ──────────────────────────────────────────────

function Checkbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
}) {
  const ref = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate ?? false
    }
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 cursor-pointer transition-colors"
    />
  )
}

// ── Main component ────────────────────────────────────────

function DataTable<T extends object>({
  data,
  columns,
  keyField,
  selectable = false,
  actions,
  loading = false,
  error,
  onRetry,
  emptyState,
  pageSize = 10,
  onSelectionChange,
  className,
}: DataTableProps<T>) {
  // ── State ─────────────────────────────────────────────
  const [sortKey, setSortKey] = React.useState<keyof T | null>(null)
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null)
  const [filters, setFilters] = React.useState<Record<string, string>>({})
  const [currentPage, setCurrentPage] = React.useState(1)
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set())

  // ── Derived data ──────────────────────────────────────
  const hasFilters = columns.some((c) => c.filterable)
  const filteredData = React.useMemo(
    () => filterData(data, filters, columns),
    [data, filters, columns]
  )
  const sortedData = React.useMemo(
    () => (sortKey ? sortData(filteredData, sortKey, sortDirection) : filteredData),
    [filteredData, sortKey, sortDirection]
  )

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedData = sortedData.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  )

  // ── Selection helpers ─────────────────────────────────
  const allPageSelected =
    paginatedData.length > 0 &&
    paginatedData.every((row) => selectedKeys.has(String(row[keyField])))
  const somePageSelected =
    paginatedData.some((row) => selectedKeys.has(String(row[keyField]))) &&
    !allPageSelected

  const toggleRow = React.useCallback(
    (key: string) => {
      setSelectedKeys((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    },
    []
  )

  const toggleAll = React.useCallback(
    (checked: boolean) => {
      setSelectedKeys((prev) => {
        const next = new Set(prev)
        paginatedData.forEach((row) => {
          const key = String(row[keyField])
          if (checked) next.add(key)
          else next.delete(key)
        })
        return next
      })
    },
    [paginatedData, keyField]
  )

  // Notify parent when selection changes
  React.useEffect(() => {
    if (onSelectionChange) {
      const selected = data.filter((row) =>
        selectedKeys.has(String(row[keyField]))
      )
      onSelectionChange(selected)
    }
  }, [selectedKeys, data, keyField, onSelectionChange])

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [filters])

  // ── Handlers ──────────────────────────────────────────
  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc')
      else if (sortDirection === 'desc') {
        setSortKey(null)
        setSortDirection(null)
      }
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  const handleFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  // ── Render ────────────────────────────────────────────
  const colCount = columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)

  if (loading) {
    return (
      <div
        className={cn(
          'rounded-xl border border-neutral-200 bg-white shadow-soft overflow-hidden',
          className
        )}
      >
        <DataTableSkeleton columns={colCount} rows={pageSize} />
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={cn(
          'rounded-xl border border-neutral-200 bg-white shadow-soft overflow-hidden',
          className
        )}
      >
        <DataTableError message={error} onRetry={onRetry} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-neutral-200 bg-white shadow-soft overflow-hidden',
        className
      )}
    >
      {/* Responsive wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* ── Header ─────────────────────────────────── */}
          <thead>
            <tr className="border-b border-neutral-200 bg-bloque-gray50">
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <Checkbox
                    checked={allPageSelected}
                    indeterminate={somePageSelected}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500',
                    col.sortable && 'cursor-pointer select-none hover:text-bloque-navy900 transition-colors',
                    col.className
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable && (
                      <SortIcon
                        direction={sortKey === col.key ? sortDirection : null}
                      />
                    )}
                  </div>
                </th>
              ))}
              {actions && actions.length > 0 && (
                <th className="w-12 px-4 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              )}
            </tr>

            {/* ── Filter row ─────────────────────────────── */}
            {hasFilters && (
              <tr className="border-b border-neutral-100 bg-white">
                {selectable && <th className="px-4 py-2" />}
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-2">
                    {col.filterable ? (
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="text"
                          placeholder={`Filtrar...`}
                          value={filters[col.key] ?? ''}
                          onChange={(e) => handleFilter(col.key, e.target.value)}
                          className="w-full rounded-md border border-neutral-200 bg-bloque-gray50 py-1.5 pl-7 pr-2 text-xs font-normal text-bloque-navy900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors"
                        />
                      </div>
                    ) : null}
                  </th>
                ))}
                {actions && actions.length > 0 && <th className="px-4 py-2" />}
              </tr>
            )}
          </thead>

          {/* ── Body ───────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {paginatedData.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={colCount}>
                    {emptyState ?? <DataTableEmpty />}
                  </td>
                </tr>
              </tbody>
            ) : (
              <motion.tbody
                key={`page-${safePage}-${JSON.stringify(filters)}`}
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {paginatedData.map((row) => {
                  const rowKey = String(row[keyField])
                  const isSelected = selectedKeys.has(rowKey)

                  return (
                    <motion.tr
                      key={rowKey}
                      variants={staggerItem}
                      className={cn(
                        'border-b border-neutral-100 transition-colors duration-150',
                        isSelected
                          ? 'bg-brand-50'
                          : 'hover:bg-bloque-gray50'
                      )}
                    >
                      {selectable && (
                        <td className="w-12 px-4 py-3">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggleRow(rowKey)}
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            'px-4 py-3 text-bloque-navy900',
                            col.className
                          )}
                        >
                          {col.render
                            ? col.render(row[col.key], row)
                            : row[col.key] != null
                              ? String(row[col.key])
                              : '—'}
                        </td>
                      ))}
                      {actions && actions.length > 0 && (
                        <td className="w-12 px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-neutral-100">
                                <MoreHorizontal className="h-4 w-4 text-neutral-500" />
                                <span className="sr-only">Abrir menú</span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {actions.map((action, i) => (
                                <React.Fragment key={action.label}>
                                  {i > 0 && action.variant === 'destructive' && (
                                    <DropdownMenuSeparator />
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => action.onClick(row)}
                                    className={cn(
                                      'cursor-pointer',
                                      action.variant === 'destructive' &&
                                        'text-error-500 focus:text-error-600 focus:bg-error-50'
                                    )}
                                  >
                                    {action.icon && (
                                      <span className="mr-2">{action.icon}</span>
                                    )}
                                    {action.label}
                                  </DropdownMenuItem>
                                </React.Fragment>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      )}
                    </motion.tr>
                  )
                })}
              </motion.tbody>
            )}
          </AnimatePresence>
        </table>
      </div>

      {/* ── Pagination ───────────────────────────────── */}
      {sortedData.length > 0 && (
        <div className="flex items-center justify-between border-t border-neutral-200 bg-bloque-gray50 px-4 py-3">
          <p className="text-xs text-neutral-500">
            {selectable && selectedKeys.size > 0 ? (
              <span className="font-medium text-brand-600">
                {selectedKeys.size} seleccionado{selectedKeys.size !== 1 ? 's' : ''}
                {' · '}
              </span>
            ) : null}
            Mostrando {(safePage - 1) * pageSize + 1}–
            {Math.min(safePage * pageSize, sortedData.length)} de{' '}
            {sortedData.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 transition-all duration-150 hover:bg-bloque-gray50 hover:text-bloque-navy900 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {/* Page numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                if (totalPages <= 5) return true
                if (page === 1 || page === totalPages) return true
                return Math.abs(page - safePage) <= 1
              })
              .map((page, i, arr) => {
                const showEllipsis = i > 0 && page - arr[i - 1] > 1
                return (
                  <React.Fragment key={page}>
                    {showEllipsis && (
                      <span className="flex h-8 w-8 items-center justify-center text-xs text-neutral-400">
                        ...
                      </span>
                    )}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-all duration-150',
                        page === safePage
                          ? 'bg-brand-500 text-white shadow-soft'
                          : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-bloque-gray50 hover:text-bloque-navy900'
                      )}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                )
              })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-500 transition-all duration-150 hover:bg-bloque-gray50 hover:text-bloque-navy900 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export { DataTable }
export type { DataTableColumn, DataTableAction, DataTableProps }
