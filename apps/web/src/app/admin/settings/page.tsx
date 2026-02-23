'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { BrandHero } from '@/components/brand/BrandHero'
import { useAuthStore, isRecruiter } from '@/lib/auth'
import { adminApi } from '@/lib/api'
import { Settings, Save, AlertCircle, CheckCircle, Hash, ToggleLeft, Type, Braces } from 'lucide-react'

interface SystemSetting {
  id: string
  key: string
  value: string | null
  value_int: number | null
  value_bool: boolean | null
  value_json: Record<string, unknown> | null
  description: string | null
  category: string
  is_editable: boolean
  created_at: string
  updated_at: string
}

export default function SettingsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated, isHydrated } = useAuthStore()
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isRecruiter()) {
      router.push('/dashboard')
      return
    }

    loadSettings()
  }, [isHydrated, isAuthenticated, accessToken, router])

  const loadSettings = async () => {
    if (!accessToken) return
    try {
      const data = await adminApi.getSettings(accessToken)
      setSettings(data)
      // Initialize edit values with current values
      const values: Record<string, string> = {}
      data.forEach(s => {
        if (s.value_int !== null) values[s.key] = String(s.value_int)
        else if (s.value_bool !== null) values[s.key] = String(s.value_bool)
        else if (s.value !== null) values[s.key] = s.value
        else if (s.value_json !== null) values[s.key] = JSON.stringify(s.value_json, null, 2)
      })
      setEditValues(values)
    } catch (err) {
      console.error('Error loading settings:', err)
      setMessage({ type: 'error', text: 'Error al cargar configuraciones' })
    } finally {
      setLoading(false)
    }
  }

  const getValueType = (setting: SystemSetting): 'int' | 'bool' | 'string' | 'json' => {
    if (setting.value_int !== null) return 'int'
    if (setting.value_bool !== null) return 'bool'
    if (setting.value_json !== null) return 'json'
    return 'string'
  }

  const getValueIcon = (type: 'int' | 'bool' | 'string' | 'json') => {
    switch (type) {
      case 'int': return <Hash className="h-4 w-4" />
      case 'bool': return <ToggleLeft className="h-4 w-4" />
      case 'json': return <Braces className="h-4 w-4" />
      default: return <Type className="h-4 w-4" />
    }
  }

  const handleSave = async (setting: SystemSetting) => {
    if (!accessToken || !setting.is_editable) return

    setSaving(setting.key)
    setMessage(null)

    try {
      const valueType = getValueType(setting)
      const rawValue = editValues[setting.key]

      let updateData: {
        value?: string | null
        value_int?: number | null
        value_bool?: boolean | null
        value_json?: Record<string, unknown> | null
      } = {}

      switch (valueType) {
        case 'int':
          updateData.value_int = parseInt(rawValue, 10)
          if (isNaN(updateData.value_int)) {
            throw new Error('Valor debe ser un numero entero')
          }
          break
        case 'bool':
          updateData.value_bool = rawValue === 'true'
          break
        case 'json':
          try {
            updateData.value_json = JSON.parse(rawValue)
          } catch {
            throw new Error('JSON invalido')
          }
          break
        default:
          updateData.value = rawValue
      }

      await adminApi.updateSetting(accessToken, setting.key, updateData)
      setMessage({ type: 'success', text: `Configuracion "${setting.key}" actualizada` })
      await loadSettings()
    } catch (err: any) {
      console.error('Error saving setting:', err)
      setMessage({ type: 'error', text: err.message || 'Error al guardar' })
    } finally {
      setSaving(null)
    }
  }

  const groupedSettings = settings.reduce((acc, setting) => {
    const category = setting.category || 'general'
    if (!acc[category]) acc[category] = []
    acc[category].push(setting)
    return acc
  }, {} as Record<string, SystemSetting[]>)

  const categoryLabels: Record<string, string> = {
    general: 'General',
    matching: 'Match de CV',
    interview: 'Entrevistas',
    upload: 'Carga de Archivos',
  }

  if (!isHydrated || !isAuthenticated) return null

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Cargando configuraciones...</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <BrandHero
        title="Configuracion del Sistema"
        subtitle="Administra los parametros globales de la plataforma"
        size="sm"
      />

      {message && (
        <div className={`mt-4 p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          {message.text}
        </div>
      )}

      <div className="mt-6 space-y-6">
        {Object.entries(groupedSettings).map(([category, categorySettings]) => (
          <BrandCard key={category}>
            <BrandCardHeader
              title={categoryLabels[category] || category}
              description={`Configuraciones de ${categoryLabels[category]?.toLowerCase() || category}`}
            />
            <div className="space-y-4 mt-4">
              {categorySettings.map(setting => {
                const valueType = getValueType(setting)
                const currentValue = editValues[setting.key] || ''

                return (
                  <div
                    key={setting.key}
                    className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-bloque-gray50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-white rounded">
                          {getValueIcon(valueType)}
                        </span>
                        <code className="text-sm font-mono text-bloque-navy900 font-semibold">
                          {setting.key}
                        </code>
                        {!setting.is_editable && (
                          <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                            Solo lectura
                          </span>
                        )}
                      </div>
                      {setting.description && (
                        <p className="text-sm text-muted-foreground mt-1 ml-8">
                          {setting.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 md:w-64">
                      {valueType === 'bool' ? (
                        <select
                          value={currentValue}
                          onChange={(e) => setEditValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                          disabled={!setting.is_editable}
                          className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="true">Activado</option>
                          <option value="false">Desactivado</option>
                        </select>
                      ) : valueType === 'json' ? (
                        <textarea
                          value={currentValue}
                          onChange={(e) => setEditValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                          disabled={!setting.is_editable}
                          rows={3}
                          className="flex-1 px-3 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      ) : (
                        <input
                          type={valueType === 'int' ? 'number' : 'text'}
                          value={currentValue}
                          onChange={(e) => setEditValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                          disabled={!setting.is_editable}
                          className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-bloque-gold500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      )}

                      {setting.is_editable && (
                        <button
                          onClick={() => handleSave(setting)}
                          disabled={saving === setting.key}
                          className="p-2 bg-bloque-navy900 text-white rounded-lg hover:bg-bloque-navy800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Guardar"
                        >
                          {saving === setting.key ? (
                            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Save className="h-5 w-5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {categorySettings.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No hay configuraciones en esta categoria
                </p>
              )}
            </div>
          </BrandCard>
        ))}

        {settings.length === 0 && (
          <BrandCard>
            <div className="text-center py-8">
              <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay configuraciones del sistema</p>
              <p className="text-sm text-muted-foreground mt-1">
                Las configuraciones se crean automaticamente al ejecutar las migraciones
              </p>
            </div>
          </BrandCard>
        )}
      </div>
    </AppShell>
  )
}
