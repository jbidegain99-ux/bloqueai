'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  label: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}

export function FormField({ label, error, hint, required, className, children }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="ml-0.5 text-error-500">*</span>}
      </label>
      {children}
      <AnimatePresence mode="wait">
        {error ? (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="text-sm text-error-500"
          >
            {error}
          </motion.p>
        ) : hint ? (
          <p key="hint" className="text-sm text-neutral-400">
            {hint}
          </p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
