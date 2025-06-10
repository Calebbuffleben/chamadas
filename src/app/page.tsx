import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'

export default async function Home() {
  const session = await auth()

  if (session?.userId) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Sistema de Presença
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Gerencie suas reuniões e registre presenças
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <SignedIn>
            <div className="flex justify-center">
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
          <SignedOut>
            <div className="flex justify-center">
              <SignInButton mode="modal">
                <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                  Entrar
                </button>
              </SignInButton>
            </div>
          </SignedOut>
        </div>
      </div>
    </div>
  )
}
