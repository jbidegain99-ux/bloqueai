'use client'

export default function SentryTestPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Sentry Test Page</h1>
      <p className="mb-4 text-gray-600">
        Esta página es solo para verificar que Sentry funciona. Eliminar después de verificar.
      </p>
      <button
        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        onClick={() => {
          throw new Error('Test error from TalenOS - Sentry verification')
        }}
      >
        Lanzar Error de Prueba
      </button>
    </div>
  )
}
