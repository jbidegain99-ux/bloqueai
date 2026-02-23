export const TEST_CREDENTIALS = {
  admin: { email: 'admin@example.com', password: 'Admin123!' },
  employer: { email: 'employer@example.com', password: 'Employer123!' },
  candidate: { email: 'candidate1@example.com', password: 'Candidate123!' },
} as const

export const TEST_VACANCY = {
  title: 'QA Engineer - E2E Test',
  description: 'This is a test vacancy created by Playwright E2E tests. It should be cleaned up after testing.',
} as const

export const TEST_EMPLOYEE = {
  firstName: 'Test',
  lastName: 'Employee',
  dui: '00000000-0',
  position: 'Developer',
  salary: '1500',
} as const

export const ROUTES = {
  login: '/login',
  register: '/register',
  pricing: '/pricing',
  calculator: '/calculator',
  landing: '/',
  employer: {
    dashboard: '/employer/dashboard',
    jobs: '/employer/jobs',
    jobsNew: '/employer/jobs/new',
    shortlists: '/employer/shortlists',
    eor: '/employer/eor',
    eorNew: '/employer/eor/new',
    billing: '/employer/settings/billing',
  },
  candidate: {
    dashboard: '/dashboard',
    profile: '/candidate/profile',
    jobs: '/candidate/jobs',
    applications: '/candidate/applications',
    resume: '/candidate/resume',
    cvBuilder: '/candidate/cv-builder',
  },
  admin: {
    dashboard: '/admin/dashboard',
    clients: '/admin/clients',
    interviews: '/admin/interviews',
    kpis: '/admin/kpis',
    placements: '/admin/placements',
    rubrics: '/admin/rubrics',
    settings: '/admin/settings',
  },
} as const
