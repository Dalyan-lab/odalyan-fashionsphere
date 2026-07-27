'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n';

/** Pipeline de création guidé : avatar → studio → essayage → défilé → vidéo → publier. */
const STEPS = [
  { key: 'wf.avatar', href: '/dashboard/avatars' },
  { key: 'wf.studio', href: '/dashboard/studio' },
  { key: 'wf.tryon', href: '/dashboard/tryon' },
  { key: 'wf.defile', href: '/dashboard/defile' },
  { key: 'wf.video', href: '/dashboard/video' },
  { key: 'wf.publish', href: '/dashboard/publications' },
];

/**
 * Fil d'étapes affiché en tête des pages du Studio créatif : situe l'utilisateur
 * dans le parcours et propose l'étape suivante. Invisible hors du pipeline.
 */
export function WorkflowSteps() {
  const pathname = usePathname();
  const t = useT();
  const idx = STEPS.findIndex((s) => s.href === pathname);
  if (idx === -1) return null;
  const next = STEPS[idx + 1];

  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface-2/40 px-3 py-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-faint">{t('wf.title')}</span>
      <ol className="flex flex-wrap items-center gap-1 text-xs">
        {STEPS.map((s, i) => (
          <li key={s.href} className="flex items-center gap-1">
            <Link
              href={s.href}
              className={`flex items-center gap-1.5 rounded-full px-2 py-1 transition ${
                i === idx
                  ? 'bg-brand-violet-magenta text-white'
                  : i < idx
                    ? 'text-brand-violet hover:underline'
                    : 'text-faint hover:text-muted'
              }`}
            >
              <span
                className={`grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold ${
                  i === idx ? 'bg-white/25' : 'bg-surface-2'
                }`}
              >
                {i + 1}
              </span>
              {t(s.key)}
            </Link>
            {i < STEPS.length - 1 && <span className="text-faint">→</span>}
          </li>
        ))}
      </ol>
      {next && (
        <Link
          href={next.href}
          className="ml-auto rounded-lg bg-brand-violet-magenta px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
        >
          {t('wf.next')} : {t(next.key)} →
        </Link>
      )}
    </div>
  );
}
