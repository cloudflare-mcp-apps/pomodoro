import { useMemo } from 'react';
import type { App } from '@modelcontextprotocol/ext-apps';
import { WtyczkiBadge } from './wtyczki-badge';

// Quiet, fleet-wide footer: wtyczki.ai brand badge + 2 random cross-sell links to OUR OWN
// published servers + one soft B2B link to the custom-MCP service. Non-dominating by design
// (see WTYCZKI_FOOTER_PROPOSALS.md). The CATALOG block below is AUTO-SYNCED from the single
// source of truth /wtyczki-catalog.json via `npm run sync:footer-catalog` — when a new server
// goes live, add one entry there and re-run the sync. `id` = project slug (excludes self).

const SITE = 'https://wtyczki.ai';
const B2B_PATH = '/wspolpraca-ai/';

type CatalogEntry = { name: string; path: string; id?: string };

const CATALOG: CatalogEntry[] = [
  // AUTO-SYNCED from /wtyczki-catalog.json — run `npm run sync:footer-catalog`. Edit the JSON, not this.
  { name: 'Dziennik nastroju i energii', path: '/wtyczki/hobby/mood-energy-log/', id: 'mood-energy-log' },
  { name: 'Pomodoro Focus', path: '/wtyczki/produktywnosc/pomodoro/', id: 'pomodoro' },
  { name: 'Audyt sprzedaży', path: '/wtyczki/premium/sales-auditor/', id: 'sales-audit' },
  { name: 'Green Web Auditor', path: '/wtyczki/biznes/green-web-auditor/', id: 'sustainability-auditor' },
  { name: 'Sprawdź Posła', path: '/wtyczki/premium/sprawdz-posla/', id: 'sprawdz-posla' },
  { name: 'OpenSky — loty na żywo', path: '/wtyczki/hobby/opensky/', id: 'opensky' },
  { name: 'SaaS Calculator', path: '/wtyczki/biznes/saas-calculator/', id: 'saas-navigator' },
  { name: 'Kalkulator ROI reklam', path: '/wtyczki/biznes/ads-roi/', id: 'ads-roi' },
  { name: 'Kursy walut NBP', path: '/wtyczki/biznes/kursy-walut-nbp-mcp/', id: 'nbp-exchange' },
];

function tagged(path: string, slug: string, medium: 'xsell' | 'b2b' | 'badge'): string {
  return `${SITE}${path}?utm_source=mcp&utm_medium=widget_footer&utm_campaign=${slug}-${medium}`;
}

function pickTwo(slug: string): CatalogEntry[] {
  const pool = CATALOG.filter((e) => e.id !== slug);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 2);
}

const linkClass =
  'py-1 px-0 bg-transparent border-0 cursor-pointer text-inherit text-[11px] leading-none underline-offset-2 hover:underline hover:text-gray-700 dark:hover:text-gray-200';

export function WtyczkiFooter({
  app,
  slug,
  cta = 'Wtyczka pod Twój proces? Porozmawiajmy',
}: {
  app: App | null;
  slug: string;
  cta?: string;
}) {
  const picks = useMemo(() => pickTwo(slug), [slug]);
  const open = (url: string) => { app?.openLink({ url }).catch(() => {}); };

  return (
    <footer className="shrink-0 border-t border-gray-100 dark:border-gray-800 px-4 py-2">
      <div className="max-w-2xl mx-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400 opacity-70">
        <WtyczkiBadge onClick={() => open(tagged('/wszystkie-wtyczki/', slug, 'badge'))} />
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>Inne wtyczki:</span>
          {picks.map((p, i) => (
            <span key={p.path} className="flex items-center gap-x-2">
              <button type="button" onClick={() => open(tagged(p.path, slug, 'xsell'))} className={linkClass}>
                {p.name}
              </button>
              {i < picks.length - 1 && <span aria-hidden="true">·</span>}
            </span>
          ))}
        </span>
        <button
          type="button"
          onClick={() => open(tagged(B2B_PATH, slug, 'b2b'))}
          className={`${linkClass} sm:ml-auto`}
        >
          {cta} →
        </button>
      </div>
    </footer>
  );
}
