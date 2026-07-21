import Link from 'next/link';

/** Coquille commune aux pages légales (Conditions, Confidentialité). */
export function LegalShell({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-violet">
        Odalyan FashionSphere AI™
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-faint">Dernière mise à jour : {updated}</p>
      <p className="mt-6 text-muted">{intro}</p>

      <div className="mt-10 space-y-8">{children}</div>

      <div className="mt-14 border-t border-border pt-6 text-sm text-faint">
        <p>
          Une question ? Écrivez-nous à{' '}
          <a href="mailto:technodalyan@gmail.com" className="text-brand-violet hover:underline">
            technodalyan@gmail.com
          </a>
          .
        </p>
        <p className="mt-3 flex gap-4">
          <Link href="/conditions" className="hover:underline">Conditions d’utilisation</Link>
          <Link href="/confidentialite" className="hover:underline">Politique de confidentialité</Link>
          <Link href="/" className="hover:underline">Accueil</Link>
        </p>
      </div>
    </main>
  );
}

/** Une section de page légale : titre + contenu. */
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}
