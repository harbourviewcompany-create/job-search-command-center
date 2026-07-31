import { AddContactForm } from '@/components/AddContactForm'
import { createClient } from '@/lib/supabase/server'
import { normalizeDisplayText } from '@/lib/text.mjs'
import { formatDate } from '@/lib/utils'
import type { Company, Contact } from '@/types/database'

export const dynamic = 'force-dynamic'

type ContactWithCompany = Contact & {
  companies: Pick<Company, 'name'> | null
}

export default async function ContactsPage() {
  const supabase = await createClient()

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*, companies(name)')
    .order('created_at', { ascending: false })

  const typedContacts = (contacts ?? []) as ContactWithCompany[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Decision-makers and recruiters. Add manually, or use Apollo lookup when
          APOLLO_API_KEY is configured. Draft outreach from any application.
        </p>
      </div>

      <AddContactForm />

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Title</th>
              <th className="px-5 py-3 font-medium">Company</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Source</th>
              <th className="px-5 py-3 font-medium">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {typedContacts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                  No contacts yet. Add one above or import via Apollo.
                </td>
              </tr>
            )}
            {typedContacts.map((contact) => {
              const name = normalizeDisplayText(contact.name, 'Unknown contact')
              const title = normalizeDisplayText(contact.title, '—')
              const company = normalizeDisplayText(contact.companies?.name, '—')
              const source = normalizeDisplayText(contact.source, '—')

              return (
                <tr key={contact.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-medium">
                    {contact.linkedin_url ? (
                      <a
                        href={contact.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:underline"
                      >
                        {name}
                      </a>
                    ) : (
                      name
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{title}</td>
                  <td className="px-5 py-3 text-slate-600">{company}</td>
                  <td className="px-5 py-3">
                    {contact.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-brand-600 hover:underline"
                      >
                        {contact.email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-400 capitalize">{source}</td>
                  <td className="px-5 py-3 text-slate-400">
                    {formatDate(contact.created_at)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
