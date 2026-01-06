'use client'

import React from 'react'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'full' | 'icon'
}

export function Logo({ className = '', size = 'md', variant = 'full' }: LogoProps) {
  const sizes = {
    sm: { icon: 24, text: 'text-lg' },
    md: { icon: 32, text: 'text-xl' },
    lg: { icon: 48, text: 'text-2xl' },
  }

  const { icon, text } = sizes[size]

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Cube + Arrow Icon */}
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 3D Cube */}
        <path
          d="M24 4L8 14V34L24 44L40 34V14L24 4Z"
          fill="#1B2A5C"
          stroke="#C9CAD7"
          strokeWidth="1.5"
        />
        <path
          d="M24 4V24M24 24L8 14M24 24L40 14"
          stroke="#C9CAD7"
          strokeWidth="1.5"
        />
        <path
          d="M24 24V44"
          stroke="#C9CAD7"
          strokeWidth="1.5"
        />
        {/* Arrow pointing up-right */}
        <path
          d="M30 12L38 6M38 6L38 12M38 6L32 6"
          stroke="#E6BE28"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {variant === 'full' && (
        <div className="flex flex-col">
          <span className={`font-bold ${text} text-white leading-tight`}>
            TalentOS
          </span>
          <span className="text-xs text-bloque-slate200 font-medium">
            by Bloque
          </span>
        </div>
      )}
    </div>
  )
}
