'use client';

import { useId, useMemo, useState } from 'react';
import { convertAndFormat, useLocale, useT } from '@/lib/i18n';
import { PLATFORM_CURRENCY } from '@odalyan/shared';

/**
 * Activité des sept derniers jours.
 *
 * Une aire à série unique : la mesure est une tendance dans le temps, et il n'y
 * a qu'une grandeur à lire. Pas de légende — le titre nomme déjà ce qui est
 * tracé, et un cartouche à une seule pastille répéterait le titre en occupant
 * de la place.
 *
 * Le violet de la plateforme sert de teinte, après vérification : il tient la
 * bande de luminosité et le contraste minimum sur le fond sombre **comme** sur
 * le fond clair. Aucune couleur inventée pour l'occasion.
 *
 * Deux exigences d'accessibilité tenues ici : la valeur de chaque jour est
 * atteignable **sans survol**, par le tableau et par la navigation au clavier ;
 * et les zones de survol débordent largement les traits, parce qu'on ne vise
 * pas une ligne de deux pixels.
 */

export interface DayActivity {
  /** Jour au format AAAA-MM-JJ. */
  date: string;
  revenue: number;
  orders: number;
}

/** Géométrie du tracé, en unités du viewBox. */
const L = { w: 640, h: 190, hautPlot: 140, gaucheAxe: 52, droite: 12, hautMarge: 12 };

/** Arrondit la graduation haute à un nombre lisible plutôt qu'au maximum brut. */
function plafondLisible(max: number): number {
  if (max <= 0) return 1;
  const puissance = Math.pow(10, Math.floor(Math.log10(max)));
  for (const pas of [1, 2, 2.5, 5, 10]) {
    const candidat = pas * puissance;
    if (candidat >= max) return candidat;
  }
  return 10 * puissance;
}

export function ActivityChart({ days }: { days: DayActivity[] }) {
  const t = useT();
  const devise = useLocale((s) => s.currency);
  const idClip = useId().replace(/:/g, '');
  const [survol, setSurvol] = useState<number | null>(null);
  const [tableau, setTableau] = useState(false);

  const somme = (n: number) => convertAndFormat(n, PLATFORM_CURRENCY, devise);
  const jourCourt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' });
  const jourLong = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const g = useMemo(() => {
    const plafond = plafondLisible(Math.max(...days.map((d) => d.revenue), 0));
    const largeur = L.w - L.gaucheAxe - L.droite;
    const pas = days.length > 1 ? largeur / (days.length - 1) : 0;
    const x = (i: number) => L.gaucheAxe + i * pas;
    const y = (v: number) => L.hautMarge + (1 - v / plafond) * (L.hautPlot - L.hautMarge);
    const points = days.map((d, i) => ({ x: x(i), y: y(d.revenue), ...d }));
    const ligne = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const aire = `${ligne} L${x(days.length - 1)},${L.hautPlot} L${x(0)},${L.hautPlot} Z`;
    return { plafond, pas, points, ligne, aire, largeur };
  }, [days]);

  const total = days.reduce((s, d) => s + d.revenue, 0);
  const commandes = days.reduce((s, d) => s + d.orders, 0);
  const vide = total === 0 && commandes === 0;
  const actif = survol != null ? g.points[survol] : null;
  const dernier = g.points[g.points.length - 1];

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">{t('dh.activity.title')}</h2>
          <p className="text-xs text-muted">{t('dh.activity.sub')}</p>
        </div>
        <div className="text-right">
          {/* Chiffres proportionnels : `tabular-nums` élargit chaque chiffre à
              la largeur d'un zéro, ce qui délie un grand nombre isolé. */}
          <p className="font-display text-xl font-bold">{somme(total)}</p>
          <p className="text-[11px] text-faint">
            {commandes} {t('dh.activity.orders')}
          </p>
        </div>
      </div>

      {vide ? (
        // Une aire plate à zéro se lit comme une panne d'affichage. On dit
        // plutôt ce qui manque.
        <p className="mt-6 rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">
          {t('dh.activity.empty')}
        </p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${L.w} ${L.h}`}
            className="mt-4 w-full"
            role="img"
            aria-label={`${t('dh.activity.title')} : ${somme(total)}`}
            onPointerLeave={() => setSurvol(null)}
          >
            <defs>
              <clipPath id={`rev-${idClip}`}>
                {/* Le tracé se dévoile de gauche à droite. L'état de repos est
                    la largeur pleine : si l'animation ne s'exécute pas — onglet
                    masqué, animations réduites — le graphique reste visible au
                    lieu de disparaître. */}
                <rect
                  x="0"
                  y="0"
                  width={L.w}
                  height={L.h}
                  className="origin-left animate-drawIn motion-reduce:animate-none"
                />
              </clipPath>
            </defs>

            {/* Grille : filets pleins d'un pas au-dessus du fond, jamais en
                pointillés — le pointillé se lit comme un seuil. */}
            {[0, 0.5, 1].map((f) => {
              const y = L.hautMarge + f * (L.hautPlot - L.hautMarge);
              return (
                <g key={f}>
                  <line
                    x1={L.gaucheAxe}
                    x2={L.w - L.droite}
                    y1={y}
                    y2={y}
                    stroke="var(--border)"
                    strokeWidth="1"
                  />
                  <text
                    x={L.gaucheAxe - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill="var(--text-faint)"
                    className="text-[11px] tabular-nums"
                  >
                    {Math.round(g.plafond * (1 - f)).toLocaleString('fr-FR')}
                  </text>
                </g>
              );
            })}

            <g clipPath={`url(#rev-${idClip})`}>
              {/* Lavis à 10 % : une aire pleine et saturée écrase la ligne. */}
              <path d={g.aire} fill="var(--brand-violet)" fillOpacity="0.1" />
              <path
                d={g.ligne}
                fill="none"
                stroke="var(--brand-violet)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>

            {/* Repère de fin : un anneau de la couleur du fond le détache du
                tracé sans ajouter de contour au trait. */}
            <circle cx={dernier.x} cy={dernier.y} r="5" fill="var(--brand-violet)" stroke="var(--surface)" strokeWidth="2" />

            {actif && (
              <line
                x1={actif.x}
                x2={actif.x}
                y1={L.hautMarge}
                y2={L.hautPlot}
                stroke="var(--brand-violet)"
                strokeWidth="1"
                strokeOpacity="0.45"
              />
            )}
            {actif && (
              <circle cx={actif.x} cy={actif.y} r="5" fill="var(--brand-violet)" stroke="var(--surface)" strokeWidth="2" />
            )}

            {/* Libellés des jours. */}
            {g.points.map((p, i) => (
              <text
                key={p.date}
                x={p.x}
                y={L.hautPlot + 20}
                textAnchor="middle"
                fill={survol === i ? 'var(--text)' : 'var(--text-faint)'}
                className="text-[11px]"
              >
                {jourCourt(p.date)}
              </text>
            ))}

            {/* Zones de saisie : larges d'un pas entier et hautes de tout le
                graphique. On vise un jour, jamais un trait de deux pixels.
                Focalisables, pour que le clavier donne la même lecture que
                la souris. */}
            {g.points.map((p, i) => (
              <rect
                key={`z-${p.date}`}
                x={p.x - g.pas / 2}
                y={0}
                width={g.pas || g.largeur}
                height={L.hautPlot + 28}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${jourLong(p.date)} : ${somme(p.revenue)}, ${p.orders} ${t('dh.activity.orders')}`}
                onPointerEnter={() => setSurvol(i)}
                onFocus={() => setSurvol(i)}
                onBlur={() => setSurvol(null)}
                className="cursor-pointer outline-none"
              />
            ))}
          </svg>

          {/* Infobulle : la valeur d'abord, le jour ensuite — on a déjà la date
              sous le curseur, c'est le montant qu'on cherche. */}
          <div className="mt-2 min-h-[38px] text-center">
            {actif ? (
              <>
                <p className="font-semibold">{somme(actif.revenue)}</p>
                <p className="text-[11px] text-faint">
                  {jourLong(actif.date)} · {actif.orders} {t('dh.activity.orders')}
                </p>
              </>
            ) : (
              <p className="text-[11px] text-faint">{t('dh.activity.hint')}</p>
            )}
          </div>

          <button
            onClick={() => setTableau((v) => !v)}
            className="mt-1 text-[11px] text-brand-violet hover:underline"
            aria-expanded={tableau}
          >
            {tableau ? t('dh.activity.hideTable') : t('dh.activity.showTable')}
          </button>

          {/* Jumeau tabulaire : aucune valeur n'est accessible au seul survol. */}
          {tableau && (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="pb-1 font-medium">{t('dh.activity.day')}</th>
                  <th className="pb-1 text-right font-medium">{t('dh.activity.sales')}</th>
                  <th className="pb-1 text-right font-medium">{t('dh.activity.orders')}</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.date} className="border-t border-border">
                    <td className="py-1.5">{jourLong(d.date)}</td>
                    <td className="py-1.5 text-right tabular-nums">{somme(d.revenue)}</td>
                    <td className="py-1.5 text-right tabular-nums">{d.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
