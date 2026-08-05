'use server'

import { revalidatePath } from 'next/cache'
import { requireOperatorAccess } from '@/lib/operator-auth'
import { createServiceClient } from '@/lib/supabase/server'

interface ParsedContact {
  name: string
  company_raw: string | null
  title: string | null
  linkedin_url: string | null
  email: string | null
}

/**
 * Parses a LinkedIn "Connections" CSV export. LinkedIn's export has a few
 * preamble lines before the real header row, so we find the header by
 * looking for the "First Name" column rather than assuming row 0.
 */
function parseLinkedInCsv(raw: string): ParsedContact[] {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const headerIndex = lines.findIndex((line) => /first\s*name/i.test(line))
  if (headerIndex === -1) return []

  const header = splitCsvLine(lines[headerIndex]).map((h) => h.trim().toLowerCase())
  const col = (name: string) => header.findIndex((h) => h === name)
  const firstNameIdx = col('first name')
  const lastNameIdx = col('last name')
  const companyIdx = col('company')
  const titleIdx = col('position')
  const urlIdx = col('url')
  const emailIdx = col('email address')

  const contacts: ParsedContact[] = []
  for (const line of lines.slice(headerIndex + 1)) {
    const cells = splitCsvLine(line)
    const first = firstNameIdx >= 0 ? cells[firstNameIdx]?.trim() : ''
    const last = lastNameIdx >= 0 ? cells[lastNameIdx]?.trim() : ''
    const name = [first, last].filter(Boolean).join(' ').trim()
    if (!name) continue

    contacts.push({
      name,
      company_raw: companyIdx >= 0 ? cells[companyIdx]?.trim() || null : null,
      title: titleIdx >= 0 ? cells[titleIdx]?.trim() || null : null,
      linkedin_url: urlIdx >= 0 ? cells[urlIdx]?.trim() || null : null,
      email: emailIdx >= 0 ? cells[emailIdx]?.trim() || null : null,
    })
  }
  return contacts
}

/** Minimal RFC 4180 CSV line splitter — handles quoted fields with commas. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}

export async function importNetworkCsv(csvText: string) {
  await requireOperatorAccess()
  const supabase = createServiceClient()

  const contacts = parseLinkedInCsv(csvText)
  if (contacts.length === 0) {
    return { imported: 0, error: 'No rows found — expected a LinkedIn "Connections" CSV export.' }
  }

  const batchId = crypto.randomUUID()
  const rows = contacts.map((c) => ({ ...c, source: 'linkedin_csv' as const, imported_batch_id: batchId }))

  const chunkSize = 500
  let imported = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from('network_contacts').insert(chunk)
    if (error) {
      return { imported, error: error.message }
    }
    imported += chunk.length
  }

  revalidatePath('/network')
  revalidatePath('/dashboard')
  return { imported, error: null }
}

export async function addNetworkContact(input: {
  name: string
  company_raw?: string
  title?: string
  linkedin_url?: string
}) {
  await requireOperatorAccess()
  const supabase = createServiceClient()

  const { error } = await supabase.from('network_contacts').insert({
    name: input.name,
    company_raw: input.company_raw || null,
    title: input.title || null,
    linkedin_url: input.linkedin_url || null,
    source: 'manual',
  })

  if (error) throw new Error(error.message)

  revalidatePath('/network')
  revalidatePath('/dashboard')
}
