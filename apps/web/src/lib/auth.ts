import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface User {
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
  isHydrated: boolean
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  updateTokens: (accessToken: string, refreshToken: string) => void
  logout: () => void
  setHydrated: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isHydrated: false,

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

      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'talentos-auth',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated()
      },
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
  return useAuthStore.getState().user?.role === 'EMPLOYER'
}

export function useAuthHydrated(): boolean {
  return useAuthStore((state) => state.isHydrated)
}

export function isRecruiter(): boolean {
  const role = useAuthStore.getState().user?.role
  return role === 'RECRUITER' || role === 'ADMIN'
}

export function isAdmin(): boolean {
  return useAuthStore.getState().user?.role === 'ADMIN'
}
