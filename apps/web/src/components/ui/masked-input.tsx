'use client'

import { forwardRef, useCallback } from 'react'
import { Input } from './input'

type MaskType = 'dui' | 'nit' | 'phone' | 'currency' | 'bank-account'

interface MaskConfig {
  apply: (value: string) => string
  placeholder: string
}

const masks: Record<MaskType, MaskConfig> = {
  /** DUI: 00000000-0 */
  dui: {
    apply: (value: string) => {
      const digits = value.replace(/\D/g, '').slice(0, 9)
      if (digits.length <= 8) return digits
      return `${digits.slice(0, 8)}-${digits.slice(8)}`
    },
    placeholder: '00000000-0',
  },

  /** NIT: 0000-000000-000-0 */
  nit: {
    apply: (value: string) => {
      const digits = value.replace(/\D/g, '').slice(0, 14)
      if (digits.length <= 4) return digits
      if (digits.length <= 10) return `${digits.slice(0, 4)}-${digits.slice(4)}`
      if (digits.length <= 13)
        return `${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10)}`
      return `${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10, 13)}-${digits.slice(13)}`
    },
    placeholder: '0000-000000-000-0',
  },

  /** Phone: 0000-0000 */
  phone: {
    apply: (value: string) => {
      const digits = value.replace(/\D/g, '').slice(0, 8)
      if (digits.length <= 4) return digits
      return `${digits.slice(0, 4)}-${digits.slice(4)}`
    },
    placeholder: '0000-0000',
  },

  /** Currency: strips non-numeric except dot */
  currency: {
    apply: (value: string) => {
      const num = value.replace(/[^\d.]/g, '')
      const parts = num.split('.')
      const whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      const decimal = parts[1] !== undefined ? `.${parts[1].slice(0, 2)}` : ''
      return whole + decimal
    },
    placeholder: '0.00',
  },

  /** Bank account: digits only, up to 20 */
  'bank-account': {
    apply: (value: string) => value.replace(/\D/g, '').slice(0, 20),
    placeholder: '0000000000',
  },
}

interface MaskedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  mask: MaskType
  value: string
  onValueChange: (value: string) => void
  error?: boolean
}

export const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, value, onValueChange, error, ...props }, ref) => {
    const maskConfig = masks[mask]

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const masked = maskConfig.apply(e.target.value)
        onValueChange(masked)
      },
      [maskConfig, onValueChange]
    )

    return (
      <Input
        ref={ref}
        placeholder={props.placeholder ?? maskConfig.placeholder}
        value={value}
        onChange={handleChange}
        error={error}
        {...props}
      />
    )
  }
)

MaskedInput.displayName = 'MaskedInput'
