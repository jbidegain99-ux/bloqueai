import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface User {
  id: string
  email: string
  full_name: string
  role: 'CANDIDATE' | 'EMPLOYER' | 'RECRUITER' | 'ADMIN'
  company_id?: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  updateTokens: (accessToken: string, refreshToken: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) =>
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        }),

      updateTokens: (accessToken, refreshToken) =>
        set({
          accessToken,
          refreshToken,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'talentos-auth',
      storage: createJSONStorage(() => localStorage),
    }
  )
)

export function getAuthToken(): string | null {
  return useAuthStore.getState().accessToken
}

export function isCandidate(): boolean {
  return useAuthStore.getState().user?.role === 'CANDIDATE'
}

export function isEmployer(): boolean {
  const role = useAuthStore.getState().user?.role
  return role === 'EMPLOYER' || role === 'RECRUITER' || role === 'ADMIN'
}

export function isRecruiter(): boolean {
  const role = useAuthStore.getState().user?.role
  return role === 'RECRUITER' || role === 'ADMIN'
}

export function isAdmin(): boolean {
  return useAuthStore.getState().user?.role === 'ADMIN'
}
