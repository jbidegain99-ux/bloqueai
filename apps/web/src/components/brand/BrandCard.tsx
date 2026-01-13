'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface BrandCardProps {
  children: React.ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
  hover?: boolean
  onClick?: () => void
}

export function BrandCard({
  children,
  className,
  padding = 'md',
  hover = false,
  onClick,
}: BrandCardProps) {
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }

  return (
    <div
      className={cn(
        'bg-white border border-bloque-slate200 rounded-lg shadow-sm',
        paddingClasses[padding],
        hover && 'transition-shadow hover:shadow-md',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

interface BrandCardHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function BrandCardHeader({
  title,
  description,
  action,
  className,
}: BrandCardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between mb-4', className)}>
      <div>
        <h3 className="text-lg font-semibold text-bloque-navy900">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
