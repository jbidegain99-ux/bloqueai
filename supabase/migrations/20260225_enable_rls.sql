-- =====================================================
-- TALENTO OS - Row Level Security Implementation
-- =====================================================
-- Fecha: 2026-02-25
-- Descripción: Habilitar RLS en todas las tablas públicas
-- con políticas basadas en el schema real del proyecto
-- =====================================================

-- =====================================================
-- PASO 1: HABILITAR RLS EN TODAS LAS TABLAS
-- =====================================================

-- Core
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

-- Jobs & Applications
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Evaluation
ALTER TABLE public.rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;

-- Matching & Interviews
ALTER TABLE public.candidate_job_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_interviews ENABLE ROW LEVEL SECURITY;

-- Reports & Shortlists
ALTER TABLE public.candidate_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shortlist_items ENABLE ROW LEVEL SECURITY;

-- Placements & Assignments
ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- EOR (Employer of Record)
ALTER TABLE public.eor_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eor_payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eor_payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eor_vacation_requests ENABLE ROW LEVEL SECURITY;

-- Billing
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

-- System / Admin
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alembic_version ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- PASO 2: HELPER FUNCTIONS
-- =====================================================

-- Obtener company_id del usuario autenticado
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id FROM public.users WHERE id = (SELECT auth.uid());
$$;

-- Obtener candidate_id del usuario autenticado
CREATE OR REPLACE FUNCTION public.get_user_candidate_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.candidates WHERE user_id = (SELECT auth.uid());
$$;

-- Obtener rol del usuario autenticado
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role::text FROM public.users WHERE id = (SELECT auth.uid());
$$;

-- Revocar acceso desde anon
REVOKE EXECUTE ON FUNCTION public.get_user_company_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_candidate_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM anon;


-- =====================================================
-- PASO 3: POLÍTICAS - USERS
-- =====================================================

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Empresa puede ver usuarios de su misma company (compañeros)
CREATE POLICY "users_select_same_company" ON public.users
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id() AND company_id IS NOT NULL);


-- =====================================================
-- PASO 4: POLÍTICAS - COMPANIES
-- =====================================================

CREATE POLICY "companies_select_own" ON public.companies
  FOR SELECT TO authenticated
  USING (id = public.get_user_company_id());

CREATE POLICY "companies_update_own" ON public.companies
  FOR UPDATE TO authenticated
  USING (id = public.get_user_company_id())
  WITH CHECK (id = public.get_user_company_id());


-- =====================================================
-- PASO 5: POLÍTICAS - CANDIDATES
-- =====================================================

-- Candidato ve su propio perfil
CREATE POLICY "candidates_select_own" ON public.candidates
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "candidates_insert_own" ON public.candidates
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "candidates_update_own" ON public.candidates
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Empresas pueden ver candidatos que aplicaron a sus jobs
CREATE POLICY "candidates_select_by_company" ON public.candidates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON a.job_id = j.id
      WHERE a.candidate_id = candidates.id
        AND j.company_id = public.get_user_company_id()
    )
  );


-- =====================================================
-- PASO 6: POLÍTICAS - RESUMES
-- =====================================================

CREATE POLICY "resumes_select_own" ON public.resumes
  FOR SELECT TO authenticated
  USING (candidate_id = public.get_user_candidate_id());

CREATE POLICY "resumes_insert_own" ON public.resumes
  FOR INSERT TO authenticated
  WITH CHECK (candidate_id = public.get_user_candidate_id());

CREATE POLICY "resumes_update_own" ON public.resumes
  FOR UPDATE TO authenticated
  USING (candidate_id = public.get_user_candidate_id());

CREATE POLICY "resumes_delete_own" ON public.resumes
  FOR DELETE TO authenticated
  USING (candidate_id = public.get_user_candidate_id());

-- Empresas ven resumes de candidatos que aplicaron a sus jobs
CREATE POLICY "resumes_select_by_company" ON public.resumes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON a.job_id = j.id
      WHERE a.candidate_id = resumes.candidate_id
        AND j.company_id = public.get_user_company_id()
    )
  );


-- =====================================================
-- PASO 7: POLÍTICAS - JOBS
-- =====================================================

-- Jobs publicados visibles para todos los autenticados
CREATE POLICY "jobs_select_published" ON public.jobs
  FOR SELECT TO authenticated
  USING (status = 'ACTIVE');

-- Empresa ve todos sus jobs (cualquier status)
CREATE POLICY "jobs_select_own_company" ON public.jobs
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "jobs_insert_own_company" ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "jobs_update_own_company" ON public.jobs
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "jobs_delete_own_company" ON public.jobs
  FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id());


-- =====================================================
-- PASO 8: POLÍTICAS - APPLICATIONS
-- =====================================================

-- Candidato ve sus aplicaciones
CREATE POLICY "applications_select_candidate" ON public.applications
  FOR SELECT TO authenticated
  USING (candidate_id = public.get_user_candidate_id());

-- Candidato crea aplicaciones
CREATE POLICY "applications_insert_candidate" ON public.applications
  FOR INSERT TO authenticated
  WITH CHECK (candidate_id = public.get_user_candidate_id());

-- Candidato puede actualizar sus aplicaciones (ej: withdraw)
CREATE POLICY "applications_update_candidate" ON public.applications
  FOR UPDATE TO authenticated
  USING (candidate_id = public.get_user_candidate_id());

-- Empresa ve aplicaciones a sus jobs
CREATE POLICY "applications_select_company" ON public.applications
  FOR SELECT TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE company_id = public.get_user_company_id()
    )
  );

-- Empresa puede actualizar aplicaciones (cambiar status)
CREATE POLICY "applications_update_company" ON public.applications
  FOR UPDATE TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE company_id = public.get_user_company_id()
    )
  );


-- =====================================================
-- PASO 9: POLÍTICAS - RUBRICS & RUBRIC_CRITERIA
-- =====================================================
-- Nota: rubrics NO tiene company_id, son plantillas compartidas.
-- Acceso de lectura para todos los autenticados.
-- Modificación solo via service_role.

CREATE POLICY "rubrics_select_authenticated" ON public.rubrics
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "rubric_criteria_select_authenticated" ON public.rubric_criteria
  FOR SELECT TO authenticated
  USING (true);


-- =====================================================
-- PASO 11: POLÍTICAS - CANDIDATE_JOB_MATCHES
-- =====================================================

-- Candidato ve sus matches
CREATE POLICY "matches_select_candidate" ON public.candidate_job_matches
  FOR SELECT TO authenticated
  USING (candidate_id = public.get_user_candidate_id());

-- Empresa ve matches de sus jobs
CREATE POLICY "matches_select_company" ON public.candidate_job_matches
  FOR SELECT TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE company_id = public.get_user_company_id()
    )
  );

-- Creación/actualización solo via service_role (proceso batch)


-- =====================================================
-- PASO 12: POLÍTICAS - INTERVIEW_SESSIONS
-- =====================================================

CREATE POLICY "sessions_select_candidate" ON public.interview_sessions
  FOR SELECT TO authenticated
  USING (candidate_id = public.get_user_candidate_id());

CREATE POLICY "sessions_select_company" ON public.interview_sessions
  FOR SELECT TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE company_id = public.get_user_company_id()
    )
  );


-- =====================================================
-- PASO 13: POLÍTICAS - INTERVIEW_MESSAGES
-- =====================================================

CREATE POLICY "messages_select_candidate" ON public.interview_messages
  FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.interview_sessions
      WHERE candidate_id = public.get_user_candidate_id()
    )
  );

CREATE POLICY "messages_select_company" ON public.interview_messages
  FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT id FROM public.interview_sessions
      WHERE job_id IN (
        SELECT id FROM public.jobs WHERE company_id = public.get_user_company_id()
      )
    )
  );


-- =====================================================
-- PASO 14: POLÍTICAS - INTERVIEW_INVITATIONS
-- =====================================================

-- Candidato ve sus invitaciones (por candidate_id o email)
CREATE POLICY "invitations_select_candidate" ON public.interview_invitations
  FOR SELECT TO authenticated
  USING (candidate_id = public.get_user_candidate_id());

-- Empresa ve/gestiona invitaciones de sus jobs
CREATE POLICY "invitations_select_company" ON public.interview_invitations
  FOR SELECT TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "invitations_insert_company" ON public.interview_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    job_id IN (
      SELECT id FROM public.jobs WHERE company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "invitations_update_company" ON public.interview_invitations
  FOR UPDATE TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE company_id = public.get_user_company_id()
    )
  );


-- =====================================================
-- PASO 15: POLÍTICAS - VIDEO_INTERVIEWS
-- =====================================================
-- video_interviews se vincula via application_id, no directamente a candidate/job

-- Candidato ve sus video interviews (via application → candidate)
CREATE POLICY "video_select_candidate" ON public.video_interviews
  FOR SELECT TO authenticated
  USING (
    application_id IN (
      SELECT id FROM public.applications
      WHERE candidate_id = public.get_user_candidate_id()
    )
  );

-- Empresa ve video interviews de sus jobs (via application → job)
CREATE POLICY "video_select_company" ON public.video_interviews
  FOR SELECT TO authenticated
  USING (
    application_id IN (
      SELECT a.id FROM public.applications a
      JOIN public.jobs j ON a.job_id = j.id
      WHERE j.company_id = public.get_user_company_id()
    )
  );


-- =====================================================
-- PASO 16: POLÍTICAS - CANDIDATE_REPORTS
-- =====================================================

-- Empresa ve reportes vinculados a sus jobs
CREATE POLICY "reports_select_company" ON public.candidate_reports
  FOR SELECT TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE company_id = public.get_user_company_id()
    )
  );

-- Candidato ve sus propios reportes
CREATE POLICY "reports_select_candidate" ON public.candidate_reports
  FOR SELECT TO authenticated
  USING (candidate_id = public.get_user_candidate_id());


-- =====================================================
-- PASO 17: POLÍTICAS - SHORTLIST_ITEMS
-- =====================================================

CREATE POLICY "shortlist_select_company" ON public.shortlist_items
  FOR SELECT TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "shortlist_update_company" ON public.shortlist_items
  FOR UPDATE TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "shortlist_delete_company" ON public.shortlist_items
  FOR DELETE TO authenticated
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE company_id = public.get_user_company_id()
    )
  );

-- Inserción via service_role (proceso automático de shortlisting)


-- =====================================================
-- PASO 18: POLÍTICAS - PLACEMENTS
-- =====================================================
-- placements usa client_id (FK→companies), no company_id

-- Candidato ve sus placements
CREATE POLICY "placements_select_candidate" ON public.placements
  FOR SELECT TO authenticated
  USING (
    candidate_id = public.get_user_candidate_id()
  );

-- Empresa (cliente) gestiona placements
CREATE POLICY "placements_select_company" ON public.placements
  FOR SELECT TO authenticated
  USING (client_id = public.get_user_company_id());

CREATE POLICY "placements_insert_company" ON public.placements
  FOR INSERT TO authenticated
  WITH CHECK (client_id = public.get_user_company_id());

CREATE POLICY "placements_update_company" ON public.placements
  FOR UPDATE TO authenticated
  USING (client_id = public.get_user_company_id())
  WITH CHECK (client_id = public.get_user_company_id());


-- =====================================================
-- PASO 19: POLÍTICAS - ASSIGNMENTS
-- =====================================================
-- assignments usa client_id (FK→companies)

CREATE POLICY "assignments_select_candidate" ON public.assignments
  FOR SELECT TO authenticated
  USING (candidate_id = public.get_user_candidate_id());

CREATE POLICY "assignments_select_company" ON public.assignments
  FOR SELECT TO authenticated
  USING (client_id = public.get_user_company_id());

CREATE POLICY "assignments_insert_company" ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (client_id = public.get_user_company_id());

CREATE POLICY "assignments_update_company" ON public.assignments
  FOR UPDATE TO authenticated
  USING (client_id = public.get_user_company_id())
  WITH CHECK (client_id = public.get_user_company_id());


-- =====================================================
-- PASO 20: POLÍTICAS - EOR TABLES
-- =====================================================
-- eor_employees usa client_company_id (FK→companies), NO tiene user_id
-- Solo acceso por empresa; empleados EOR no tienen cuenta de usuario

-- EOR Employees - empresa gestiona
CREATE POLICY "eor_employees_select_company" ON public.eor_employees
  FOR SELECT TO authenticated
  USING (client_company_id = public.get_user_company_id());

CREATE POLICY "eor_employees_insert_company" ON public.eor_employees
  FOR INSERT TO authenticated
  WITH CHECK (client_company_id = public.get_user_company_id());

CREATE POLICY "eor_employees_update_company" ON public.eor_employees
  FOR UPDATE TO authenticated
  USING (client_company_id = public.get_user_company_id())
  WITH CHECK (client_company_id = public.get_user_company_id());

-- EOR Payroll Runs - empresa gestiona
-- eor_payroll_runs usa client_company_id
CREATE POLICY "eor_payroll_runs_select_company" ON public.eor_payroll_runs
  FOR SELECT TO authenticated
  USING (client_company_id = public.get_user_company_id());

CREATE POLICY "eor_payroll_runs_insert_company" ON public.eor_payroll_runs
  FOR INSERT TO authenticated
  WITH CHECK (client_company_id = public.get_user_company_id());

CREATE POLICY "eor_payroll_runs_update_company" ON public.eor_payroll_runs
  FOR UPDATE TO authenticated
  USING (client_company_id = public.get_user_company_id())
  WITH CHECK (client_company_id = public.get_user_company_id());

-- EOR Payroll Items - via payroll_run → company
CREATE POLICY "eor_payroll_items_select_company" ON public.eor_payroll_items
  FOR SELECT TO authenticated
  USING (
    payroll_run_id IN (
      SELECT id FROM public.eor_payroll_runs
      WHERE client_company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "eor_payroll_items_insert_company" ON public.eor_payroll_items
  FOR INSERT TO authenticated
  WITH CHECK (
    payroll_run_id IN (
      SELECT id FROM public.eor_payroll_runs
      WHERE client_company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "eor_payroll_items_update_company" ON public.eor_payroll_items
  FOR UPDATE TO authenticated
  USING (
    payroll_run_id IN (
      SELECT id FROM public.eor_payroll_runs
      WHERE client_company_id = public.get_user_company_id()
    )
  );

-- EOR Vacation Requests - empresa gestiona (via employee → company)
CREATE POLICY "eor_vacation_select_company" ON public.eor_vacation_requests
  FOR SELECT TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM public.eor_employees
      WHERE client_company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "eor_vacation_insert_company" ON public.eor_vacation_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id IN (
      SELECT id FROM public.eor_employees
      WHERE client_company_id = public.get_user_company_id()
    )
  );

CREATE POLICY "eor_vacation_update_company" ON public.eor_vacation_requests
  FOR UPDATE TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM public.eor_employees
      WHERE client_company_id = public.get_user_company_id()
    )
  );


-- =====================================================
-- PASO 21: POLÍTICAS - BILLING
-- =====================================================

-- Plans: lectura pública (catálogo)
CREATE POLICY "plans_select_all" ON public.plans
  FOR SELECT TO authenticated
  USING (true);

-- Subscriptions: solo la empresa propietaria
CREATE POLICY "subscriptions_select_company" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "subscriptions_insert_company" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "subscriptions_update_company" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id());

-- Invoices: solo la empresa propietaria
CREATE POLICY "invoices_select_company" ON public.invoices
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

-- Usage Records: solo la empresa propietaria
CREATE POLICY "usage_records_select_company" ON public.usage_records
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());


-- =====================================================
-- PASO 23: TABLAS DE SISTEMA (Solo service_role)
-- =====================================================
-- Sin políticas para authenticated = bloqueado.
-- Solo service_role puede acceder (bypass RLS automático).

-- audit_logs: sin política → bloqueado para authenticated
-- system_settings: sin política → bloqueado para authenticated
-- llm_logs: sin política → bloqueado para authenticated
-- leads: sin política → bloqueado para authenticated
-- alembic_version: sin política → bloqueado para authenticated


-- =====================================================
-- PASO 24: ÍNDICES PARA PERFORMANCE DE RLS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_rls_users_company_id ON public.users(company_id);
CREATE INDEX IF NOT EXISTS idx_rls_candidates_user_id ON public.candidates(user_id);
CREATE INDEX IF NOT EXISTS idx_rls_jobs_company_id ON public.jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_rls_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_rls_applications_candidate_id ON public.applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_rls_applications_job_id ON public.applications(job_id);
CREATE INDEX IF NOT EXISTS idx_rls_interview_sessions_candidate_id ON public.interview_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_rls_interview_sessions_job_id ON public.interview_sessions(job_id);
CREATE INDEX IF NOT EXISTS idx_rls_interview_messages_session_id ON public.interview_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_rls_video_interviews_application_id ON public.video_interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_rls_candidate_reports_job_id ON public.candidate_reports(job_id);
CREATE INDEX IF NOT EXISTS idx_rls_candidate_reports_candidate_id ON public.candidate_reports(candidate_id);
CREATE INDEX IF NOT EXISTS idx_rls_shortlist_items_job_id ON public.shortlist_items(job_id);
CREATE INDEX IF NOT EXISTS idx_rls_placements_client_id ON public.placements(client_id);
CREATE INDEX IF NOT EXISTS idx_rls_placements_candidate_id ON public.placements(candidate_id);
CREATE INDEX IF NOT EXISTS idx_rls_assignments_client_id ON public.assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_rls_assignments_candidate_id ON public.assignments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_rls_eor_employees_client_company_id ON public.eor_employees(client_company_id);
CREATE INDEX IF NOT EXISTS idx_rls_eor_payroll_runs_client_company_id ON public.eor_payroll_runs(client_company_id);
CREATE INDEX IF NOT EXISTS idx_rls_eor_payroll_items_payroll_run_id ON public.eor_payroll_items(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_rls_eor_payroll_items_employee_id ON public.eor_payroll_items(employee_id);
CREATE INDEX IF NOT EXISTS idx_rls_eor_vacation_employee_id ON public.eor_vacation_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_rls_subscriptions_company_id ON public.subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_rls_invoices_company_id ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_rls_usage_records_company_id ON public.usage_records(company_id);
CREATE INDEX IF NOT EXISTS idx_rls_invitations_candidate_id ON public.interview_invitations(candidate_id);
CREATE INDEX IF NOT EXISTS idx_rls_invitations_job_id ON public.interview_invitations(job_id);
CREATE INDEX IF NOT EXISTS idx_rls_matches_candidate_id ON public.candidate_job_matches(candidate_id);
CREATE INDEX IF NOT EXISTS idx_rls_matches_job_id ON public.candidate_job_matches(job_id);
CREATE INDEX IF NOT EXISTS idx_rls_rubric_criteria_rubric_id ON public.rubric_criteria(rubric_id);


-- =====================================================
-- FIN DE MIGRACIÓN RLS
-- =====================================================
