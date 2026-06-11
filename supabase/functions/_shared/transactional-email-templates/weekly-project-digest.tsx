import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Link, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface DigestItemProps {
  name: string
  number?: string | null
  bucket: 'active' | 'quiet' | 'stale'
  daysSinceMovement: number
  summary: string
  projectId: string
}

interface Props {
  name?: string
  counts?: { active: number; quiet: number; stale: number }
  items?: DigestItemProps[]
  appUrl?: string
}

const BUCKET_META: Record<DigestItemProps['bucket'], { label: string; color: string; bg: string; emoji: string }> = {
  active: { label: 'Active', color: '#166534', bg: '#dcfce7', emoji: '🟢' },
  quiet:  { label: 'Quiet',  color: '#854d0e', bg: '#fef9c3', emoji: '🟡' },
  stale:  { label: 'Stale',  color: '#991b1b', bg: '#fee2e2', emoji: '🔴' },
}

const Email = ({ name = 'there', counts = { active: 0, quiet: 0, stale: 0 }, items = [], appUrl = 'https://ordinopm.com' }: Props) => {
  const bySection: Record<DigestItemProps['bucket'], DigestItemProps[]> = { active: [], quiet: [], stale: [] }
  for (const it of items) bySection[it.bucket].push(it)

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${counts.active} active · ${counts.quiet} quiet · ${counts.stale} stale`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Weekly Project Digest</Heading>
          <Text style={subtle}>Hi {name}, here's where your open projects stand this morning.</Text>

          <Section style={summaryRow}>
            <Text style={summaryCellGreen}>{counts.active} Active</Text>
            <Text style={summaryCellYellow}>{counts.quiet} Quiet</Text>
            <Text style={summaryCellRed}>{counts.stale} Stale</Text>
          </Section>

          {(['stale', 'active', 'quiet'] as const).map((bucket) => {
            const list = bySection[bucket]
            if (list.length === 0) return null
            const meta = BUCKET_META[bucket]
            return (
              <Section key={bucket} style={{ marginTop: '28px' }}>
                <Heading as="h2" style={{ ...h2, color: meta.color }}>
                  {meta.emoji} {meta.label} ({list.length})
                </Heading>
                {bucket === 'stale' && (
                  <Text style={subtle}>No movement in 30+ days — review or close.</Text>
                )}
                {bucket === 'quiet' && (
                  <Text style={subtle}>Quiet for 8–30 days. Reusing last summary.</Text>
                )}
                {list.map((it) => (
                  <Section key={it.projectId} style={card}>
                    <Text style={cardTitle}>
                      <Link href={`${appUrl}/projects/${it.projectId}`} style={cardLink}>
                        {it.name}{it.number ? ` · #${it.number}` : ''}
                      </Link>
                      <span style={{ ...cardBadge, color: meta.color, backgroundColor: meta.bg }}>
                        {it.daysSinceMovement}d
                      </span>
                    </Text>
                    <Text style={cardBody}>{it.summary}</Text>
                  </Section>
                ))}
              </Section>
            )
          })}

          <Hr style={hr} />
          <Text style={footer}>
            Sent weekly by Ordino. Update your digest preferences in{' '}
            <Link href={`${appUrl}/settings`} style={footerLink}>Settings → Notifications</Link>.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'Your weekly project digest',
  displayName: 'Weekly Project Digest',
  previewData: {
    name: 'Manny',
    counts: { active: 4, quiet: 2, stale: 1 },
    items: [
      { projectId: 'abc', name: '218 Greene St', number: '042726-1', bucket: 'stale', daysSinceMovement: 41,
        summary: 'PW1 filed, awaiting plan exam. No movement since filing. Recommend follow-up call to DOB.' },
      { projectId: 'def', name: '240 Greene St', number: '032426-1', bucket: 'active', daysSinceMovement: 2,
        summary: 'Objections received yesterday. PM drafting response. Target resolution end of week.' },
      { projectId: 'ghi', name: '209 Highland', number: '032326-1', bucket: 'quiet', daysSinceMovement: 14,
        summary: 'Waiting on client signature. Last reminder sent 14 days ago.' },
    ],
    appUrl: 'https://ordinopm.com',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '640px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }
const h2 = { fontSize: '16px', fontWeight: 600, margin: '0 0 8px 0', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }
const subtle = { fontSize: '14px', color: '#64748b', margin: '0 0 16px 0' }
const summaryRow = { display: 'flex', gap: '8px', marginTop: '16px' }
const summaryCellBase = { flex: 1, padding: '10px 14px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, margin: 0 }
const summaryCellGreen = { ...summaryCellBase, backgroundColor: '#dcfce7', color: '#166534' }
const summaryCellYellow = { ...summaryCellBase, backgroundColor: '#fef9c3', color: '#854d0e' }
const summaryCellRed = { ...summaryCellBase, backgroundColor: '#fee2e2', color: '#991b1b' }
const card = { padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', margin: '8px 0' }
const cardTitle = { fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: '0 0 6px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const cardLink = { color: '#0f172a', textDecoration: 'none' }
const cardBadge = { fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }
const cardBody = { fontSize: '13px', color: '#334155', margin: 0, whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#e2e8f0', margin: '28px 0 16px 0' }
const footer = { fontSize: '12px', color: '#94a3b8', textAlign: 'center' as const, margin: 0 }
const footerLink = { color: '#94a3b8', textDecoration: 'underline' }
