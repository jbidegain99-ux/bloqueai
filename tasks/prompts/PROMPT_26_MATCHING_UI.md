# 🎨 Prompt 26: UI de Matching + Testing

---

## 🔴 METODOLOGÍA DE TRABAJO (LEER PRIMERO)

### Antes de Empezar
```bash
cat tasks/todo.md
cat tasks/lessons.md

# Verificar que Prompts 24-25 están completos
# - pgvector funcionando
# - Embeddings generándose
# - Matching API respondiendo
```

### Core Principles
- **Simplicity First**: UI limpia y funcional
- **Verification**: E2E tests para el flujo completo
- **UX Premium**: Animaciones y feedback visual

---

## 🎯 Objetivo

Crear la **UI de matching** para:
1. Employer: Ver candidatos que matchean con sus vacantes
2. Candidate: Ver vacantes recomendadas para ellos
3. Visualizar scores y tomar acciones (shortlist, reject, apply)

---

## ✅ Tareas

### Fase 1: Componentes de Match Card

#### T26.1: Match Score Badge
```tsx
// apps/web/src/components/matching/match-score-badge.tsx

"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface MatchScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  animated?: boolean;
}

export function MatchScoreBadge({
  score,
  size = "md",
  showLabel = true,
  animated = true,
}: MatchScoreBadgeProps) {
  // Determinar color basado en score
  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-600 bg-green-50 border-green-200";
    if (score >= 70) return "text-blue-600 bg-blue-50 border-blue-200";
    if (score >= 50) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-gray-600 bg-gray-50 border-gray-200";
  };
  
  const getScoreLabel = (score: number) => {
    if (score >= 85) return "Excelente";
    if (score >= 70) return "Muy bueno";
    if (score >= 50) return "Bueno";
    return "Regular";
  };
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };
  
  const Component = animated ? motion.div : "div";
  
  return (
    <Component
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        getScoreColor(score),
        sizeClasses[size]
      )}
      initial={animated ? { scale: 0.8, opacity: 0 } : undefined}
      animate={animated ? { scale: 1, opacity: 1 } : undefined}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      <span className="font-bold">{Math.round(score)}%</span>
      {showLabel && (
        <span className="text-opacity-80">{getScoreLabel(score)}</span>
      )}
    </Component>
  );
}
```

#### T26.2: Candidate Match Card (para Employer)
```tsx
// apps/web/src/components/matching/candidate-match-card.tsx

"use client";

import { motion } from "framer-motion";
import { 
  User, 
  MapPin, 
  Briefcase, 
  Star, 
  Plus, 
  X, 
  ExternalLink,
  ChevronRight 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MatchScoreBadge } from "./match-score-badge";
import { cn } from "@/lib/utils";

interface CandidateMatch {
  id: string;
  score: number;
  semanticScore: number;
  skillsScore: number;
  metadata: {
    name: string;
    headline?: string;
    skills?: string[];
    avatar?: string;
    location?: string;
  };
  status?: "pending" | "shortlisted" | "rejected";
}

interface CandidateMatchCardProps {
  match: CandidateMatch;
  onShortlist?: (id: string) => void;
  onReject?: (id: string) => void;
  onViewProfile?: (id: string) => void;
  compact?: boolean;
}

export function CandidateMatchCard({
  match,
  onShortlist,
  onReject,
  onViewProfile,
  compact = false,
}: CandidateMatchCardProps) {
  const { metadata } = match;
  
  const getStatusBadge = () => {
    switch (match.status) {
      case "shortlisted":
        return <Badge className="bg-green-100 text-green-700">En shortlist</Badge>;
      case "rejected":
        return <Badge variant="secondary">Rechazado</Badge>;
      default:
        return null;
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      layout
    >
      <Card className={cn(
        "group hover:shadow-md transition-shadow",
        match.status === "rejected" && "opacity-60"
      )}>
        <CardContent className={cn("p-4", compact && "p-3")}>
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <Avatar className={cn(compact ? "h-10 w-10" : "h-12 w-12")}>
              <AvatarImage src={metadata.avatar} />
              <AvatarFallback>
                {metadata.name?.split(" ").map(n => n[0]).join("").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white truncate">
                    {metadata.name}
                  </h3>
                  {metadata.headline && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {metadata.headline}
                    </p>
                  )}
                </div>
                <MatchScoreBadge score={match.score} size={compact ? "sm" : "md"} />
              </div>
              
              {/* Skills */}
              {metadata.skills && metadata.skills.length > 0 && !compact && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {metadata.skills.slice(0, 4).map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {metadata.skills.length > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{metadata.skills.length - 4}
                    </Badge>
                  )}
                </div>
              )}
              
              {/* Score breakdown */}
              {!compact && (
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <span>Semántico: {match.semanticScore}%</span>
                  <span>Skills: {match.skillsScore}%</span>
                </div>
              )}
              
              {/* Status */}
              {match.status && match.status !== "pending" && (
                <div className="mt-2">
                  {getStatusBadge()}
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className={cn(
              "flex items-center gap-1",
              "opacity-0 group-hover:opacity-100 transition-opacity"
            )}>
              {match.status !== "shortlisted" && onShortlist && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => onShortlist(match.id)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              {match.status !== "rejected" && onReject && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => onReject(match.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              {onViewProfile && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onViewProfile(match.id)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
```

#### T26.3: Job Match Card (para Candidate)
```tsx
// apps/web/src/components/matching/job-match-card.tsx

"use client";

import { motion } from "framer-motion";
import { 
  Building2, 
  MapPin, 
  DollarSign, 
  Clock,
  Briefcase,
  ArrowRight,
  Bookmark,
  BookmarkCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MatchScoreBadge } from "./match-score-badge";
import { cn } from "@/lib/utils";

interface JobMatch {
  id: string;
  score: number;
  semanticScore: number;
  skillsScore: number;
  metadata: {
    title: string;
    company_id?: string;
    companyName?: string;
    companyLogo?: string;
    location?: string;
    remote_type?: string;
    salary_range?: string;
  };
  saved?: boolean;
  applied?: boolean;
}

interface JobMatchCardProps {
  match: JobMatch;
  onApply?: (id: string) => void;
  onSave?: (id: string) => void;
  onViewDetails?: (id: string) => void;
}

export function JobMatchCard({
  match,
  onApply,
  onSave,
  onViewDetails,
}: JobMatchCardProps) {
  const { metadata } = match;
  
  const getRemoteLabel = (type?: string) => {
    switch (type) {
      case "remote": return "Remoto";
      case "hybrid": return "Híbrido";
      case "onsite": return "Presencial";
      default: return null;
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <Card className="group hover:shadow-lg transition-all cursor-pointer" onClick={() => onViewDetails?.(match.id)}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            {/* Company logo placeholder */}
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center shrink-0">
              {metadata.companyLogo ? (
                <img src={metadata.companyLogo} alt="" className="w-8 h-8 object-contain" />
              ) : (
                <Building2 className="w-6 h-6 text-gray-400" />
              )}
            </div>
            
            {/* Job info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {metadata.title}
                  </h3>
                  {metadata.companyName && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {metadata.companyName}
                    </p>
                  )}
                </div>
                <MatchScoreBadge score={match.score} />
              </div>
              
              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-500">
                {metadata.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {metadata.location}
                  </span>
                )}
                {metadata.remote_type && (
                  <Badge variant="outline" className="text-xs">
                    {getRemoteLabel(metadata.remote_type)}
                  </Badge>
                )}
                {metadata.salary_range && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    {metadata.salary_range}
                  </span>
                )}
              </div>
              
              {/* Score breakdown */}
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                <span>Match semántico: {match.semanticScore}%</span>
                <span>Match skills: {match.skillsScore}%</span>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onSave?.(match.id);
              }}
            >
              {match.saved ? (
                <BookmarkCheck className="w-4 h-4 text-indigo-600" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
            </Button>
            
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onApply?.(match.id);
              }}
              disabled={match.applied}
            >
              {match.applied ? (
                "Aplicado"
              ) : (
                <>
                  Aplicar
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
```

---

### Fase 2: Páginas de Matching

#### T26.4: Página de Matches para Employer
```tsx
// apps/web/src/app/employer/jobs/[id]/matches/page.tsx

"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Filter, 
  SlidersHorizontal,
  Users,
  UserCheck,
  UserX,
  RefreshCw
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CandidateMatchCard } from "@/components/matching/candidate-match-card";
import { matchingApi } from "@/lib/api/matching";
import { toast } from "sonner";

export default function JobMatchesPage() {
  const { id: jobId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [minScore, setMinScore] = useState(0);
  
  // Fetch matches
  const { data: matches, isLoading, refetch } = useQuery({
    queryKey: ["job-matches", jobId, minScore],
    queryFn: () => matchingApi.getCandidatesForJob(jobId, { minScore, limit: 50 }),
  });
  
  // Mutations
  const shortlistMutation = useMutation({
    mutationFn: (candidateId: string) => 
      matchingApi.updateMatchStatus(candidateId, jobId, "shortlisted"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-matches", jobId] });
      toast.success("Candidato agregado a shortlist");
    },
  });
  
  const rejectMutation = useMutation({
    mutationFn: (candidateId: string) =>
      matchingApi.updateMatchStatus(candidateId, jobId, "rejected"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-matches", jobId] });
      toast.success("Candidato rechazado");
    },
  });
  
  // Filter matches by tab
  const filteredMatches = matches?.filter((m) => {
    if (activeTab === "all") return m.status !== "rejected";
    if (activeTab === "shortlisted") return m.status === "shortlisted";
    if (activeTab === "rejected") return m.status === "rejected";
    return true;
  }) || [];
  
  // Stats
  const stats = {
    total: matches?.length || 0,
    shortlisted: matches?.filter(m => m.status === "shortlisted").length || 0,
    rejected: matches?.filter(m => m.status === "rejected").length || 0,
  };
  
  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Candidatos Recomendados
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Candidatos que matchean con esta vacante
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-gray-500">Total matches</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <UserCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.shortlisted}</p>
              <p className="text-sm text-gray-500">En shortlist</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <UserX className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.rejected}</p>
              <p className="text-sm text-gray-500">Rechazados</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Buscar candidatos..."
            className="max-w-xs"
            prefix={<Search className="w-4 h-4 text-gray-400" />}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Score mínimo:</span>
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="border rounded-md px-3 py-1.5 text-sm"
          >
            <option value={0}>Todos</option>
            <option value={50}>50%+</option>
            <option value={70}>70%+</option>
            <option value={85}>85%+</option>
          </select>
        </div>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">
            Todos ({stats.total - stats.rejected})
          </TabsTrigger>
          <TabsTrigger value="shortlisted">
            Shortlist ({stats.shortlisted})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rechazados ({stats.rejected})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab}>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No hay candidatos
              </h3>
              <p className="text-gray-500">
                {activeTab === "all"
                  ? "No se encontraron candidatos que matcheen con esta vacante"
                  : `No hay candidatos en esta categoría`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredMatches.map((match) => (
                  <CandidateMatchCard
                    key={match.id}
                    match={match}
                    onShortlist={(id) => shortlistMutation.mutate(id)}
                    onReject={(id) => rejectMutation.mutate(id)}
                    onViewProfile={(id) => window.open(`/candidate/${id}`, "_blank")}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### T26.5: Página de Jobs Recomendados para Candidate
```tsx
// apps/web/src/app/candidate/recommended/page.tsx

"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Sparkles, 
  Filter, 
  MapPin, 
  Briefcase,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { JobMatchCard } from "@/components/matching/job-match-card";
import { matchingApi } from "@/lib/api/matching";
import { useAuthStore } from "@/lib/auth";
import { toast } from "sonner";

export default function RecommendedJobsPage() {
  const { user } = useAuthStore();
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [minScore, setMinScore] = useState(50);
  
  const { data: jobs, isLoading, refetch } = useQuery({
    queryKey: ["recommended-jobs", user?.candidateProfileId, remoteOnly, minScore],
    queryFn: () => matchingApi.getJobsForCandidate(user?.candidateProfileId!, {
      remoteOnly,
      minScore,
      limit: 20,
    }),
    enabled: !!user?.candidateProfileId,
  });
  
  const applyMutation = useMutation({
    mutationFn: (jobId: string) => matchingApi.applyToJob(jobId),
    onSuccess: () => {
      toast.success("¡Aplicación enviada!");
      refetch();
    },
  });
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
            <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Trabajos Recomendados
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Vacantes que matchean con tu perfil
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>
      
      {/* Filters */}
      <div className="flex items-center gap-6 mb-6 p-4 bg-white dark:bg-gray-900 rounded-lg border">
        <div className="flex items-center gap-2">
          <Switch
            id="remote"
            checked={remoteOnly}
            onCheckedChange={setRemoteOnly}
          />
          <Label htmlFor="remote" className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            Solo remoto
          </Label>
        </div>
        
        <div className="flex items-center gap-2">
          <Label className="text-sm text-gray-500">Match mínimo:</Label>
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="border rounded-md px-3 py-1.5 text-sm"
          >
            <option value={0}>Todos</option>
            <option value={50}>50%+</option>
            <option value={70}>70%+ (Recomendado)</option>
            <option value={85}>85%+ (Excelente)</option>
          </select>
        </div>
      </div>
      
      {/* Results */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : jobs?.length === 0 ? (
        <div className="text-center py-16">
          <Briefcase className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
            No hay vacantes recomendadas
          </h3>
          <p className="text-gray-500 mb-4">
            Completa tu perfil para recibir mejores recomendaciones
          </p>
          <Button asChild>
            <a href="/candidate/profile">Completar perfil</a>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs?.map((job, index) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <JobMatchCard
                match={job}
                onApply={(id) => applyMutation.mutate(id)}
                onSave={(id) => toast.info("Guardado")}
                onViewDetails={(id) => window.location.href = `/jobs/${id}`}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### Fase 3: API Client

#### T26.6: Cliente de API para matching
```typescript
// apps/web/src/lib/api/matching.ts

import { api } from "./client";

export interface MatchResult {
  id: string;
  score: number;
  semanticScore: number;
  skillsScore: number;
  metadata: Record<string, any>;
  status?: string;
}

export interface MatchFilters {
  minScore?: number;
  remoteOnly?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  limit?: number;
}

export const matchingApi = {
  // Para Employer
  getCandidatesForJob: async (
    jobId: string, 
    filters?: MatchFilters
  ): Promise<MatchResult[]> => {
    const params = new URLSearchParams();
    if (filters?.minScore) params.append("min_score", String(filters.minScore));
    if (filters?.remoteOnly) params.append("remote_only", "true");
    if (filters?.limit) params.append("limit", String(filters.limit));
    
    const response = await api.get(`/matching/candidates-for-job/${jobId}?${params}`);
    return response.data;
  },
  
  // Para Candidate
  getJobsForCandidate: async (
    candidateId: string,
    filters?: MatchFilters
  ): Promise<MatchResult[]> => {
    const params = new URLSearchParams();
    if (filters?.minScore) params.append("min_score", String(filters.minScore));
    if (filters?.remoteOnly) params.append("remote_only", "true");
    if (filters?.salaryMin) params.append("salary_min", String(filters.salaryMin));
    if (filters?.salaryMax) params.append("salary_max", String(filters.salaryMax));
    if (filters?.limit) params.append("limit", String(filters.limit));
    
    const response = await api.get(`/matching/jobs-for-candidate/${candidateId}?${params}`);
    return response.data;
  },
  
  // Score específico
  getMatchScore: async (candidateId: string, jobId: string) => {
    const response = await api.get(`/matching/score/${candidateId}/${jobId}`);
    return response.data;
  },
  
  // Guardar match
  saveMatch: async (candidateId: string, jobId: string) => {
    const response = await api.post("/matching/save", {
      candidate_id: candidateId,
      job_id: jobId,
    });
    return response.data;
  },
  
  // Actualizar estado
  updateMatchStatus: async (
    candidateId: string,
    jobId: string,
    status: "shortlisted" | "rejected" | "reviewed"
  ) => {
    // Primero obtener o crear el match
    const saveResponse = await api.post("/matching/save", {
      candidate_id: candidateId,
      job_id: jobId,
    });
    
    const matchId = saveResponse.data.match_id;
    
    // Luego actualizar status
    const response = await api.patch(`/matching/status/${matchId}`, {
      status,
    });
    return response.data;
  },
  
  // Aplicar a job (para candidatos)
  applyToJob: async (jobId: string) => {
    const response = await api.post(`/applications`, { job_id: jobId });
    return response.data;
  },
  
  // Stats
  getMatchStats: async (jobId: string) => {
    const response = await api.get(`/matching/job/${jobId}/matches`);
    return response.data;
  },
};
```

---

### Fase 4: Integración con Flujos Existentes

#### T26.7: Agregar link de matches a vacante
```tsx
// Agregar en la página de detalle de vacante del employer
// apps/web/src/app/employer/jobs/[id]/page.tsx

// Agregar este botón en la UI:
<Button asChild>
  <Link href={`/employer/jobs/${jobId}/matches`}>
    <Sparkles className="w-4 h-4 mr-2" />
    Ver Candidatos Recomendados
  </Link>
</Button>
```

#### T26.8: Agregar "Recomendados" al nav del Candidate
```tsx
// En el sidebar/nav del candidato, agregar:
{
  label: "Recomendados",
  href: "/candidate/recommended",
  icon: Sparkles,
}
```

---

### Fase 5: E2E Tests

#### T26.9: Tests de Matching UI
```typescript
// apps/web/e2e/tests/matching/matching.spec.ts

import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Matching Module', () => {
  
  test.describe('Employer - Job Matches', () => {
    
    test.beforeEach(async ({ page, loginAs }) => {
      await loginAs('employer');
    });
    
    test('should display matches page for a job', async ({ page }) => {
      // Navegar a una vacante existente
      await page.goto('/employer/jobs');
      
      // Click en primera vacante
      await page.click('[data-testid="job-card"]:first-child');
      
      // Click en ver matches
      await page.click('text=Candidatos Recomendados');
      
      // Verificar que la página carga
      await expect(page.locator('h1')).toContainText('Candidatos');
    });
    
    test('should display match score badges', async ({ page }) => {
      await page.goto('/employer/jobs/test-job-id/matches');
      
      // Verificar que hay badges de score
      const scoreBadges = page.locator('[data-testid="match-score-badge"]');
      await expect(scoreBadges.first()).toBeVisible();
    });
    
    test('should filter by minimum score', async ({ page }) => {
      await page.goto('/employer/jobs/test-job-id/matches');
      
      // Cambiar filtro de score
      await page.selectOption('select', '70');
      
      // Esperar actualización
      await page.waitForTimeout(500);
      
      // Verificar que todos los scores visibles son >= 70
      // (este test depende de tener datos de prueba)
    });
    
    test('should shortlist a candidate', async ({ page }) => {
      await page.goto('/employer/jobs/test-job-id/matches');
      
      // Hover en primera card
      const firstCard = page.locator('[data-testid="candidate-match-card"]:first-child');
      await firstCard.hover();
      
      // Click en shortlist
      await firstCard.locator('button:has-text("+")'). click();
      
      // Verificar toast de éxito
      await expect(page.locator('text=shortlist')).toBeVisible();
    });
    
  });
  
  test.describe('Candidate - Recommended Jobs', () => {
    
    test.beforeEach(async ({ page, loginAs }) => {
      await loginAs('candidate');
    });
    
    test('should display recommended jobs page', async ({ page }) => {
      await page.goto('/candidate/recommended');
      
      await expect(page.locator('h1')).toContainText('Recomendados');
    });
    
    test('should show match scores on job cards', async ({ page }) => {
      await page.goto('/candidate/recommended');
      
      const jobCards = page.locator('[data-testid="job-match-card"]');
      
      // Si hay jobs, verificar que tienen score
      const count = await jobCards.count();
      if (count > 0) {
        await expect(jobCards.first().locator('[data-testid="match-score-badge"]')).toBeVisible();
      }
    });
    
    test('should filter by remote only', async ({ page }) => {
      await page.goto('/candidate/recommended');
      
      // Toggle remote filter
      await page.click('label:has-text("Solo remoto")');
      
      // Esperar actualización
      await page.waitForTimeout(500);
    });
    
    test('should apply to a job', async ({ page }) => {
      await page.goto('/candidate/recommended');
      
      const applyButton = page.locator('button:has-text("Aplicar")').first();
      
      if (await applyButton.isVisible()) {
        await applyButton.click();
        
        // Verificar éxito
        await expect(page.locator('text=Aplicación')).toBeVisible();
      }
    });
    
  });
  
});
```

---

## ✅ Checklist de Verificación

### Componentes
- [ ] MatchScoreBadge renderiza correctamente
- [ ] CandidateMatchCard muestra info y acciones
- [ ] JobMatchCard muestra info y acciones
- [ ] Animaciones funcionan

### Páginas
- [ ] `/employer/jobs/[id]/matches` carga y muestra candidatos
- [ ] `/candidate/recommended` carga y muestra jobs
- [ ] Filtros funcionan (score, remote)
- [ ] Tabs funcionan (all, shortlisted, rejected)

### Acciones
- [ ] Shortlist candidato funciona
- [ ] Reject candidato funciona
- [ ] Apply to job funciona
- [ ] Save job funciona

### Navegación
- [ ] Link a matches desde detalle de vacante
- [ ] Link a recomendados en nav de candidato

### Tests
- [ ] Tests E2E pasan

---

## 📝 Output Esperado

```markdown
## Prompt 26 Complete - Matching UI

### Components
- [x] MatchScoreBadge with color coding
- [x] CandidateMatchCard with actions
- [x] JobMatchCard with apply/save

### Pages
- [x] /employer/jobs/[id]/matches
- [x] /candidate/recommended

### API Client
- [x] matchingApi with all endpoints

### Integration
- [x] Link from job detail to matches
- [x] Nav item for candidate recommendations

### Tests
- [x] E2E tests for matching flows

### Files Created
- apps/web/src/components/matching/match-score-badge.tsx
- apps/web/src/components/matching/candidate-match-card.tsx
- apps/web/src/components/matching/job-match-card.tsx
- apps/web/src/app/employer/jobs/[id]/matches/page.tsx
- apps/web/src/app/candidate/recommended/page.tsx
- apps/web/src/lib/api/matching.ts
- apps/web/e2e/tests/matching/matching.spec.ts

### Ready For
- Prompt 27: Video Interviews setup
```

---

## 🚨 Cuando Termines

1. **Verificar build**:
```bash
cd apps/web && npm run build
```

2. **Correr tests**:
```bash
npx playwright test e2e/tests/matching/ --project=chromium
```

3. **Actualizar `tasks/todo.md`**

4. **Commit**:
```bash
git add .
git commit -m "feat(ui): add matching UI for employers and candidates

- Add MatchScoreBadge component with color coding
- Add CandidateMatchCard with shortlist/reject actions
- Add JobMatchCard with apply/save actions
- Create employer matches page with filters
- Create candidate recommended jobs page
- Add matchingApi client
- Include E2E tests"
git push
```
