'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BriefcaseBusiness,
  ContactRound,
  DollarSign,
  LayoutDashboard,
  Menu,
  Settings,
  Target,
  Trello,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { href: '/dashboard', label: "Today's actions", icon: LayoutDashboard },
  { href: '/jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { href: '/applications', label: 'Pipeline', icon: Trello },
  { href: '/opportunities', label: 'Cash plays', icon: DollarSign },
  { href: '/contacts', label: 'Contacts', icon: ContactRound },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="mobile-safe-top sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur lg:hidden">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          onClick={() => setOpen(false)}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
            <Target className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-950">Job Command Center</span>
            <span className="block text-xs text-slate-500">Private workspace</span>
          </span>
        </Link>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav id="mobile-navigation" aria-label="Primary" className="border-t border-slate-200 bg-white px-3 py-3 shadow-lg">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {navigation.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`)
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                      active
                        ? 'border-brand-200 bg-brand-50 text-brand-800'
                        : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </header>
  )
}
