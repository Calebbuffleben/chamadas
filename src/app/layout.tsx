import { ClerkProvider, OrganizationSwitcher, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="pt-BR">
        <body className={inter.className}>
          <SignedIn>
            <div className="p-4">
              <OrganizationSwitcher
                afterCreateOrganizationUrl={(org) => `/${org.id}/dashboard`}
                afterLeaveOrganizationUrl="/select-org"
                afterSelectOrganizationUrl={(org) => `/${org.id}/dashboard`}
                hidePersonal
              />
            </div>
            <main className="min-h-screen bg-gray-50">
              {children}
            </main>
          </SignedIn>
          <SignedOut>
            <RedirectToSignIn />
          </SignedOut>
        </body>
      </html>
    </ClerkProvider>
  )
}
