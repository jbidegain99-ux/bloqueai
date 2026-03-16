'use client'

import { AppShell } from '@/components/brand/AppShell'

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
