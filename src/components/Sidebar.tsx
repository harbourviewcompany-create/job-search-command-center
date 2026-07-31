'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BriefcaseBusiness,
  ContactRound,
  DollarSign,
  LayoutDashboard,
  Settings,
  Target,
  Trello,
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

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-slate-950 text-white lg:flex">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-950 shadow-lg shadow-black/20">
          <Target className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">Job Command Center</p>
          <p className="text-xs text-slate-400">Private workspace</p>
        </div>
      </div>

      <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 p-3">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80',
                active
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
          <p className="text-xs font-medium text-slate-200">Search pipeline</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Triage, apply, and follow up from one workspace.</p>
        </div>
      </div>
    </aside>
  )
}
