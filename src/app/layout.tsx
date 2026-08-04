import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { MobileNav } from '@/components/MobileNav'
import { Sidebar } from '@/components/Sidebar'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: {
    default: 'Job Search Command Center',
    template: '%s · Job Search Command Center',
  },
  description: 'Private job pipeline for triage, applications, and follow-up.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f5f7fb',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full bg-slate-950">
      <body className={`${inter.className} min-h-full`}>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <div className="min-h-[100dvh] bg-[#f5f7fb] lg:flex">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <MobileNav />
            <main id="main-content" tabIndex={-1} className="safe-page outline-none">
              <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-5 sm:px-6 sm:pb-12 sm:pt-7 lg:px-8 lg:py-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}
