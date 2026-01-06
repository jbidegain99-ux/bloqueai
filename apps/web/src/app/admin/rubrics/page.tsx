'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/brand/AppShell'
import { BrandCard, BrandCardHeader } from '@/components/brand/BrandCard'
import { BrandHero } from '@/components/brand/BrandHero'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore, isAdmin } from '@/lib/auth'
import { adminApi } from '@/lib/api'
import { Plus, Edit, ChevronRight, Settings, Trash, Save } from 'lucide-react'

interface RubricCriteria {
  id?: string
  name: string
  key: string
  description: string
  weight: number
  min_score: number
  max_score: number
  scoring_guidelines?: Record<number, string>
}

interface Rubric {
  id: string
  name: string
  description: string
  min_score_threshold: number
  max_candidates_shortlist: number
  is_active: boolean
  version: number
  criteria: RubricCriteria[]
}

export default function RubricsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated } = useAuthStore()
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRubric, setSelectedRubric] = useState<Rubric | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    min_score_threshold: 3,
    max_candidates_shortlist: 10,
    criteria: [] as RubricCriteria[],
  })

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isAdmin()) {
      router.push('/dashboard')
      return
    }

    loadRubrics()
  }, [isAuthenticated, accessToken, router])

  const loadRubrics = async () => {
    if (!accessToken) return
    try {
      const data = await adminApi.getRubrics(accessToken) as Rubric[]
      setRubrics(data)
    } catch (err) {
      console.error('Error loading rubrics:', err)
    } finally {
      setLoading(false)
    }
  }

  const selectRubric = (rubric: Rubric) => {
    setSelectedRubric(rubric)
    setFormData({
      name: rubric.name,
      description: rubric.description || '',
      min_score_threshold: rubric.min_score_threshold,
      max_candidates_shortlist: rubric.max_candidates_shortlist,
      criteria: rubric.criteria.map(c => ({ ...c })),
    })
    setEditMode(false)
    setShowCreateForm(false)
  }

  const startCreate = () => {
    setSelectedRubric(null)
    setFormData({
      name: '',
      description: '',
      min_score_threshold: 3,
      max_candidates_shortlist: 10,
      criteria: [
        { name: 'Habilidades Técnicas', key: 'technical_skills', description: 'Dominio de tecnologías requeridas', weight: 0.3, min_score: 1, max_score: 5 },
        { name: 'Experiencia', key: 'experience', description: 'Años y relevancia de experiencia', weight: 0.25, min_score: 1, max_score: 5 },
        { name: 'Comunicación', key: 'communication', description: 'Claridad y efectividad comunicativa', weight: 0.2, min_score: 1, max_score: 5 },
        { name: 'Resolución de Problemas', key: 'problem_solving', description: 'Capacidad analítica y resolución', weight: 0.15, min_score: 1, max_score: 5 },
        { name: 'Ajuste Cultural', key: 'cultural_fit', description: 'Alineación con valores de la empresa', weight: 0.1, min_score: 1, max_score: 5 },
      ],
    })
    setShowCreateForm(true)
    setEditMode(true)
  }

  const handleSave = async () => {
    if (!accessToken) return

    // Validate weights sum to 1
    const weightSum = formData.criteria.reduce((sum, c) => sum + c.weight, 0)
    if (Math.abs(weightSum - 1) > 0.01) {
      alert(`Los pesos deben sumar 1 (actualmente: ${weightSum.toFixed(2)})`)
      return
    }

    setSaving(true)
    try {
      if (selectedRubric) {
        await adminApi.updateRubric(accessToken, selectedRubric.id, formData)
      } else {
        await adminApi.createRubric(accessToken, formData)
      }
      await loadRubrics()
      setEditMode(false)
      setShowCreateForm(false)
    } catch (err) {
      console.error('Error saving rubric:', err)
      alert('Error al guardar la rúbrica')
    } finally {
      setSaving(false)
    }
  }

  const updateCriteria = (index: number, field: keyof RubricCriteria, value: string | number) => {
    const newCriteria = [...formData.criteria]
    newCriteria[index] = { ...newCriteria[index], [field]: value }
    setFormData({ ...formData, criteria: newCriteria })
  }

  const addCriteria = () => {
    setFormData({
      ...formData,
      criteria: [
        ...formData.criteria,
        { name: '', key: '', description: '', weight: 0, min_score: 1, max_score: 5 },
      ],
    })
  }

  const removeCriteria = (index: number) => {
    const newCriteria = formData.criteria.filter((_, i) => i !== index)
    setFormData({ ...formData, criteria: newCriteria })
  }

  if (!isAuthenticated) return null

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Cargando rúbricas...</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <BrandHero
        title="Gestión de Rúbricas"
        subtitle="Configure los criterios de evaluación para candidatos"
        size="sm"
      />

      <div className="mt-6 grid lg:grid-cols-3 gap-6">
        {/* Rubrics list */}
        <div className="lg:col-span-1">
          <BrandCard>
            <BrandCardHeader
              title="Rúbricas"
              description="Selecciona una rúbrica para editar"
            />
            <div className="space-y-2">
              {rubrics.map((rubric) => (
                <button
                  key={rubric.id}
                  onClick={() => selectRubric(rubric)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center justify-between ${
                    selectedRubric?.id === rubric.id
                      ? 'border-bloque-navy900 bg-bloque-gray50'
                      : 'border-gray-200 hover:border-bloque-navy900/50'
                  }`}
                >
                  <div>
                    <p className="font-medium text-bloque-navy900">{rubric.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {rubric.criteria.length} criterios - v{rubric.version}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}

              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={startCreate}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nueva Rúbrica
              </Button>
            </div>
          </BrandCard>
        </div>

        {/* Rubric editor */}
        <div className="lg:col-span-2">
          {(selectedRubric || showCreateForm) ? (
            <BrandCard>
              <div className="flex items-center justify-between mb-6">
                <BrandCardHeader
                  title={showCreateForm ? 'Nueva Rúbrica' : formData.name}
                  description={editMode ? 'Editando criterios' : `Versión ${selectedRubric?.version || 1}`}
                />
                <div className="flex gap-2">
                  {!editMode && selectedRubric && (
                    <Button variant="outline" onClick={() => setEditMode(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                  )}
                  {editMode && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (selectedRubric) {
                            selectRubric(selectedRubric)
                          } else {
                            setShowCreateForm(false)
                          }
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button onClick={handleSave} disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Guardando...' : 'Guardar'}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {editMode && (
                <div className="space-y-4 mb-6 pb-6 border-b">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nombre</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ej: Rúbrica para Desarrolladores"
                      />
                    </div>
                    <div>
                      <Label>Descripción</Label>
                      <Input
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Descripción de la rúbrica"
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Puntuación mínima para shortlist</Label>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        step={0.1}
                        value={formData.min_score_threshold}
                        onChange={(e) => setFormData({ ...formData, min_score_threshold: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Máximo candidatos en shortlist</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={formData.max_candidates_shortlist}
                        onChange={(e) => setFormData({ ...formData, max_candidates_shortlist: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Criteria */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-bloque-navy900">Criterios de Evaluación</h3>
                  {editMode && (
                    <span className="text-sm text-muted-foreground">
                      Suma de pesos: {formData.criteria.reduce((s, c) => s + c.weight, 0).toFixed(2)}
                    </span>
                  )}
                </div>

                {formData.criteria.map((criteria, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-lg space-y-3"
                  >
                    {editMode ? (
                      <>
                        <div className="flex items-start justify-between">
                          <div className="grid md:grid-cols-2 gap-3 flex-1 mr-4">
                            <div>
                              <Label className="text-xs">Nombre</Label>
                              <Input
                                value={criteria.name}
                                onChange={(e) => updateCriteria(index, 'name', e.target.value)}
                                placeholder="Nombre del criterio"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Clave</Label>
                              <Input
                                value={criteria.key}
                                onChange={(e) => updateCriteria(index, 'key', e.target.value)}
                                placeholder="technical_skills"
                              />
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCriteria(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                        <div>
                          <Label className="text-xs">Descripción</Label>
                          <Input
                            value={criteria.description}
                            onChange={(e) => updateCriteria(index, 'description', e.target.value)}
                            placeholder="Descripción del criterio"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Peso (0-1)</Label>
                            <Input
                              type="number"
                              min={0}
                              max={1}
                              step={0.05}
                              value={criteria.weight}
                              onChange={(e) => updateCriteria(index, 'weight', parseFloat(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Puntuación mín</Label>
                            <Input
                              type="number"
                              min={0}
                              max={10}
                              value={criteria.min_score}
                              onChange={(e) => updateCriteria(index, 'min_score', parseInt(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Puntuación máx</Label>
                            <Input
                              type="number"
                              min={1}
                              max={10}
                              value={criteria.max_score}
                              onChange={(e) => updateCriteria(index, 'max_score', parseInt(e.target.value))}
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-bloque-navy900">{criteria.name}</p>
                          <p className="text-sm text-muted-foreground">{criteria.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-bloque-navy900">
                            {(criteria.weight * 100).toFixed(0)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {criteria.min_score}-{criteria.max_score} puntos
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {editMode && (
                  <Button variant="outline" onClick={addCriteria} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Criterio
                  </Button>
                )}
              </div>
            </BrandCard>
          ) : (
            <BrandCard className="flex items-center justify-center h-64">
              <div className="text-center text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecciona una rúbrica para ver sus detalles</p>
                <p className="text-sm">o crea una nueva</p>
              </div>
            </BrandCard>
          )}
        </div>
      </div>
    </AppShell>
  )
}
