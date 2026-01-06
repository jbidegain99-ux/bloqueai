'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface BrandHeroProps {
  title: string
  subtitle?: string
  children?: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function BrandHero({
  title,
  subtitle,
  children,
  className,
  size = 'md',
}: BrandHeroProps) {
  const sizeClasses = {
    sm: 'py-8',
    md: 'py-12',
    lg: 'py-20',
  }

  return (
    <div
      className={cn(
        'brand-gradient relative overflow-hidden',
        sizeClasses[size],
        className
      )}
    >
      {/* Background pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            {title}
          </h1>
          {subtitle && (
            <p className="text-lg md:text-xl text-bloque-slate200 mb-6">
              {subtitle}
            </p>
          )}
          {children && (
            <div className="flex flex-wrap gap-4">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
