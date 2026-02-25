import type { Metadata } from 'next'
import { Toaster } from 'sonner'
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
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              borderRadius: '8px',
              fontFamily: 'Inter, system-ui, sans-serif',
            },
            className: 'text-sm',
          }}
          richColors
          closeButton
        />
      </body>
    </html>
  )
}
