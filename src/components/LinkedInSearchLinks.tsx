import { buildLinkedInJobSearchUrls } from '@/lib/linkedin'
import { ExternalLink, Linkedin } from 'lucide-react'

interface Props {
  terms: string[]
  locations: string[]
}

export function LinkedInSearchLinks({ terms, locations }: Props) {
  const links = buildLinkedInJobSearchUrls({ terms, locations })

  if (links.length === 0) return null

  return (
    <div className="card border-[#0A66C2]/15 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Linkedin className="h-4 w-4 text-[#0A66C2]" />
        <h2 className="font-medium">Open on LinkedIn</h2>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        One-click searches using your saved terms (past 24h, newest first).
        Review on LinkedIn, then import roles worth pursuing below.
      </p>
      <ul className="flex flex-wrap gap-2">
        {links.map((link, i) => (
          <li key={`${link.url}-${i}`}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs"
            >
              {link.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
