/**
 * Build a simple .docx from markdown-ish resume text.
 * Uses the `docx` package (OOXML) — no headless browser required.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx'

function linesFromMarkdown(md: string): string[] {
  return md
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
}

function stripMdInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^#+\s*/, '')
    .replace(/^[-*•]\s+/, '')
    .trim()
}

export async function resumeMarkdownToDocxBuffer(
  markdown: string,
  options?: { title?: string }
): Promise<Buffer> {
  const lines = linesFromMarkdown(markdown)
  const children: Paragraph[] = []

  for (const raw of lines) {
    if (!raw.trim()) {
      children.push(new Paragraph({ text: '' }))
      continue
    }

    if (raw.startsWith('# '))
      children.push(
        new Paragraph({
          text: stripMdInline(raw),
          heading: HeadingLevel.TITLE,
          spacing: { after: 120 },
        })
      )
    else if (raw.startsWith('## '))
      children.push(
        new Paragraph({
          text: stripMdInline(raw),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 80 },
        })
      )
    else if (raw.startsWith('### '))
      children.push(
        new Paragraph({
          text: stripMdInline(raw),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 60 },
        })
      )
    else if (/^[-*•]\s+/.test(raw))
      children.push(
        new Paragraph({
          text: stripMdInline(raw),
          bullet: { level: 0 },
          spacing: { after: 40 },
        })
      )
    else
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: stripMdInline(raw),
              size: 20, // 10pt
            }),
          ],
          spacing: { after: 60 },
        })
      )
  }

  const doc = new Document({
    creator: 'Job Search Command Center',
    title: options?.title ?? 'Tailored Resume',
    description: 'Generated tailored resume',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        children:
          children.length > 0
            ? children
            : [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [new TextRun({ text: markdown.slice(0, 5000) })],
                }),
              ],
      },
    ],
  })

  const uint8 = await Packer.toBuffer(doc)
  return Buffer.from(uint8)
}

export function resumeFilename(
  company?: string | null,
  title?: string | null
): string {
  const safe = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
  const parts = ['tyler-campbell']
  if (company) parts.push(safe(company))
  if (title) parts.push(safe(title))
  parts.push('resume')
  return `${parts.join('-')}.docx`
}
