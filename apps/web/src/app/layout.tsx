import type { Metadata } from 'next'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'TalentOS by Bloque',
  description: 'Plataforma de reclutamiento con IA - Bloque Internacional',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-bloque-gray50 font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
