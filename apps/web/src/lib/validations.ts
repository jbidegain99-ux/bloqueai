/**
 * Validation utilities for El Salvador forms.
 */

type ValidatorFn = (value: string) => string | null

export const validators = {
  required: (value: string): string | null => {
    if (!value || !value.trim()) return 'Este campo es requerido'
    return null
  },

  email: (value: string): string | null => {
    if (!value) return null
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Email invalido'
    return null
  },

  /** DUI: 8 digits + dash + 1 check digit (00000000-0) */
  dui: (value: string): string | null => {
    if (!value) return null
    if (!/^\d{8}-\d$/.test(value)) return 'DUI debe tener formato 00000000-0'
    return null
  },

  /** NIT: 0000-000000-000-0 */
  nit: (value: string): string | null => {
    if (!value) return null
    if (!/^\d{4}-\d{6}-\d{3}-\d$/.test(value))
      return 'NIT debe tener formato 0000-000000-000-0'
    return null
  },

  /** SV phone: 8 digits, optionally formatted as 0000-0000 */
  phone: (value: string): string | null => {
    if (!value) return null
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length !== 8) return 'Telefono debe tener 8 digitos'
    return null
  },

  /** Minimum salary for El Salvador (~$365) */
  salary: (value: string): string | null => {
    const num = parseFloat(value)
    if (isNaN(num) || num <= 0) return 'Ingresa un salario valido'
    if (num < 365) return 'Salario debe ser al menos $365 (salario minimo)'
    return null
  },

  /** Bank account number: 8-20 digits */
  bankAccount: (value: string): string | null => {
    if (!value) return null
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length < 8 || cleaned.length > 20) return 'Numero de cuenta invalido'
    return null
  },

  /** Password: min 8 chars, upper, lower, digit */
  password: (value: string): string | null => {
    if (!value) return 'Ingresa una contrasena'
    if (value.length < 8) return 'Minimo 8 caracteres'
    if (!/[A-Z]/.test(value)) return 'Debe contener al menos una mayuscula'
    if (!/[a-z]/.test(value)) return 'Debe contener al menos una minuscula'
    if (!/\d/.test(value)) return 'Debe contener al menos un numero'
    return null
  },

  /** Date must not be empty */
  date: (value: string): string | null => {
    if (!value) return 'Selecciona una fecha'
    return null
  },

  /** Positive integer */
  positiveInt: (value: string): string | null => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 1) return 'Debe ser al menos 1'
    return null
  },
}

/** Run multiple validators, return first error or null. */
export function validate(value: string, ...fns: ValidatorFn[]): string | null {
  for (const fn of fns) {
    const error = fn(value)
    if (error) return error
  }
  return null
}
