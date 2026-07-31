import type { LucideIcon } from 'lucide-react'
import {
  BriefcaseBusiness,
  ContactRound,
  DollarSign,
  LayoutDashboard,
  Settings,
  Trello,
} from 'lucide-react'

export interface NavigationItem {
  href: string
  label: string
  icon: LucideIcon
}

/** Shared primary navigation used by mobile and desktop application shells. */
export const primaryNavigation: readonly NavigationItem[] = [
  { href: '/dashboard', label: "Today's actions", icon: LayoutDashboard },
  { href: '/jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { href: '/applications', label: 'Pipeline', icon: Trello },
  { href: '/opportunities', label: 'Cash plays', icon: DollarSign },
  { href: '/contacts', label: 'Contacts', icon: ContactRound },
  { href: '/settings', label: 'Settings', icon: Settings },
]
