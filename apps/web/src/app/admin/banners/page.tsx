'use client';

import { useEffect, useState } from 'react';
import {
  BANNER_THEMES,
  BANNER_THEME_LABELS,
  BANNER_TONES,
  BANNER_TONE_LABELS,
  BANNER_HEIGHTS,
  BANNER_HEIGHT_LABELS,
  BANNER_POSITIONS,
  BANNER_POSITION_LABELS,
  BANNER_ANIMATIONS,
  BANNER_ANIMATION_LABELS,
  isBannerLive,
  type MarketplaceBannerInfo,
} from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { Topbar } from '@/components/dashboard/topbar';
import { ImageUploadInput } from '@/components/dashboard/image-upload-input';
import { VideoUploadInput } from '@/components/dashboard/video-upload-input';
import { BannerCanvas } from '@/components/marketplace-hero';

/**
 * Gestion des bandeaux de la marketplace.
 *
 * Toute la valeur de l'écran tient dans une chose : lancer, programmer ou
 * arrêter une campagne **sans toucher au code**. On peut donc préparer les
 * soldes trois semaines à l'avance, et les couper en une seconde si besoin.
 */

const VIDE = {
  title: '',
  subtitle: '',
  badge: '',
  tone: 'PROMO',
  ctaLabel: '',
  ctaUrl: '',
  imageUrl: '',
  videoUrl: '',
  theme: 'violet',
  height: 'standard',
  mediaPosition: 'center',
  animation: 'none',
  active: true,
  startsAt: '',
  endsAt: '',
  priority: 0,
};

type Form = typeof VIDE;

/**
 * Brouillon local.
 *
 * Composer un bandeau prend du temps — titre, sous-titre, image, dates. Perdre
 * cette saisie parce qu'on a quitté la page une minute est inacceptable, et
 * c'est exactement ce qui arrivait : rien n'était conservé tant que
 * l'enregistrement n'avait pas abouti.
 *
 * Le brouillon retient aussi **quel** bandeau était en cours de modification :
 * restaurer la saisie d'un bandeau dans le formulaire d'un autre écraserait
 * silencieusement le mauvais.
 */
const CLE_BROUILLON = 'odalyan-brouillon-bandeau';

function lireBrouillon(): { edite: string | null; form: Form } | null {
  if (typeof window === 'undefined') return null;
  try {
    const brut = window.localStorage.getItem(CLE_BROUILLON);
    return brut ? (JSON.parse(brut) as { edite: string | null; form: Form }) : null;
  } catch {
    return null;
  }
}

/** `datetime-local` attend « AAAA-MM-JJTHH:MM », sans fuseau ni secondes. */
function versChamp(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function BannersPage() {
  const [banners, setBanners] = useState<MarketplaceBannerInfo[]>([]);
  const [form, setForm] = useState<Form>({ ...VIDE });
  const [edite, setEdite] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [brouillonRepris, setBrouillonRepris] = useState(false);

  // Reprise de la saisie interrompue, au chargement de la page.
  useEffect(() => {
    const b = lireBrouillon();
    if (!b) return;
    setForm(b.form);
    setEdite(b.edite);
    setBrouillonRepris(true);
  }, []);

  // Sauvegarde à chaque frappe. Le formulaire est petit : l'écrire en entier
  // coûte moins qu'un mécanisme de temporisation, et ne perd pas la dernière
  // touche saisie avant un départ brutal.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vierge = JSON.stringify(form) === JSON.stringify(VIDE) && !edite;
    if (vierge) window.localStorage.removeItem(CLE_BROUILLON);
    else window.localStorage.setItem(CLE_BROUILLON, JSON.stringify({ edite, form }));
  }, [form, edite]);

  const oublierBrouillon = () => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(CLE_BROUILLON);
    setBrouillonRepris(false);
  };

  const charger = () =>
    apiFetch<MarketplaceBannerInfo[]>('/banners').then(setBanners).catch(() => setBanners([]));

  useEffect(() => {
    charger();
  }, []);

  const reinitialiser = () => {
    setForm({ ...VIDE });
    setEdite(null);
    setErreur('');
    oublierBrouillon();
  };

  const editer = (b: MarketplaceBannerInfo) => {
    setEdite(b.id);
    setMsg('');
    setErreur('');
    setForm({
      title: b.title,
      subtitle: b.subtitle ?? '',
      badge: b.badge ?? '',
      tone: b.tone,
      ctaLabel: b.ctaLabel ?? '',
      ctaUrl: b.ctaUrl ?? '',
      imageUrl: b.imageUrl ?? '',
      videoUrl: b.videoUrl ?? '',
      theme: b.theme,
      height: b.height ?? 'standard',
      mediaPosition: b.mediaPosition ?? 'center',
      animation: b.animation ?? 'none',
      active: b.active,
      startsAt: versChamp(b.startsAt),
      endsAt: versChamp(b.endsAt),
      priority: b.priority,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setErreur('');
    // Contrôle fait ici plutôt que par le navigateur : sa bulle s'affiche là où
    // il veut — sur la capture d'un utilisateur, au-dessus du sous-titre alors
    // que le champ manquant était le titre — et laisse croire que tout est
    // obligatoire. Un seul message, en tête du formulaire, dit lequel manque.
    if (form.title.trim().length < 2) {
      setErreur('Le titre est obligatoire — c’est la phrase que liront vos clients. Le reste est facultatif.');
      return;
    }
    setEnvoi(true);
    try {
      // Les dates partent en ISO complet ; vides, elles valent « pas de borne ».
      const payload = {
        ...form,
        priority: Number(form.priority) || 0,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : '',
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : '',
      };
      if (edite) await apiFetch(`/banners/${edite}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await apiFetch('/banners', { method: 'POST', body: JSON.stringify(payload) });
      setMsg(edite ? 'Bandeau mis à jour.' : 'Bandeau créé.');
      reinitialiser();
      setBrouillonRepris(false);
      await charger();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = async (b: MarketplaceBannerInfo) => {
    if (!window.confirm(`Supprimer définitivement « ${b.title} » ?`)) return;
    await apiFetch(`/banners/${b.id}`, { method: 'DELETE' }).catch(() => undefined);
    if (edite === b.id) reinitialiser();
    await charger();
  };

  const basculer = async (b: MarketplaceBannerInfo) => {
    await apiFetch(`/banners/${b.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !b.active }),
    }).catch(() => undefined);
    await charger();
  };

  // Même règle que le serveur, importée et non recopiée : une administration
  // qui annoncerait « à l'antenne » un bandeau que les clients ne voient pas
  // serait pire que pas d'indication du tout.
  const enAntenne = banners.filter((b) => isBannerLive(b))[0]?.id ?? null;

  const champ = (k: keyof Form) => ({
    value: String(form[k] ?? ''),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value }),
  });

  return (
    <>
      <Topbar />
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="font-display text-3xl font-bold">Bandeaux de la marketplace</h1>
        <p className="mt-1 text-muted">
          Lancez, programmez ou coupez une campagne sans redéployer le site.
        </p>

        {/* Aperçu rendu par le composant même qui sert la marketplace : ce que
            l'on voit ici est exactement ce que verront les clients. */}
        <div className="mt-6">
          <p className="mb-2 text-xs uppercase tracking-wide text-faint">Aperçu client</p>
          <BannerCanvas
            banner={{
              id: 'apercu',
              title: form.title || 'Votre titre',
              subtitle: form.subtitle || null,
              badge: form.badge || null,
              tone: form.tone as never,
              ctaLabel: form.ctaLabel || null,
              ctaUrl: form.ctaUrl || null,
              imageUrl: form.imageUrl || null,
              videoUrl: form.videoUrl || null,
              theme: form.theme as never,
              height: form.height as never,
              mediaPosition: form.mediaPosition as never,
              animation: form.animation as never,
              active: form.active,
              startsAt: null,
              endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
              priority: Number(form.priority) || 0,
            }}
          />
        </div>

        <form onSubmit={enregistrer} noValidate className="card mt-6 space-y-4 p-6">
          <h2 className="font-bold">{edite ? 'Modifier le bandeau' : 'Nouveau bandeau'}</h2>

          {brouillonRepris && (
            <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
              <span>Votre saisie précédente a été retrouvée et remise en place.</span>
              <button
                type="button"
                onClick={reinitialiser}
                className="text-xs text-brand-violet hover:underline"
              >
                Repartir de zéro
              </button>
            </p>
          )}

          {erreur && (
            <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{erreur}</p>
          )}
          {msg && (
            <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-500">{msg}</p>
          )}

          <div>
            <label className="label">Titre</label>
            <input className="input" {...champ('title')} maxLength={90} />
          </div>
          <div>
            <label className="label">Sous-titre</label>
            <textarea className="input min-h-[70px]" {...champ('subtitle')} maxLength={180} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Pastille</label>
              <input className="input" placeholder="−30 %" {...champ('badge')} maxLength={24} />
            </div>
            <div>
              <label className="label">Ton</label>
              <select className="input" {...champ('tone')}>
                {BANNER_TONES.map((t) => (
                  <option key={t} value={t}>
                    {BANNER_TONE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Ambiance</label>
              <select className="input" {...champ('theme')}>
                {BANNER_THEMES.map((t) => (
                  <option key={t} value={t}>
                    {BANNER_THEME_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Hauteur du bandeau</label>
              <select className="input" {...champ('height')}>
                {BANNER_HEIGHTS.map((h) => (
                  <option key={h} value={h}>
                    {BANNER_HEIGHT_LABELS[h]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Cadrage du média</label>
              <select className="input" {...champ('mediaPosition')}>
                {BANNER_POSITIONS.map((c) => (
                  <option key={c} value={c}>
                    {BANNER_POSITION_LABELS[c]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-faint">
                Un bandeau est bien plus large que haut : une vidéo 16:9 y est recadrée.
                Ce réglage décide de la bande conservée.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Texte du bouton</label>
              <input className="input" placeholder="J’en profite" {...champ('ctaLabel')} />
            </div>
            <div>
              <label className="label">Lien du bouton</label>
              <input className="input" placeholder="/marketplace?category=FEMME" {...champ('ctaUrl')} />
            </div>
          </div>

          <div>
            <label className="label">Animation de l’image</label>
            <select className="input" {...champ('animation')}>
              {BANNER_ANIMATIONS.map((a) => (
                <option key={a} value={a}>
                  {BANNER_ANIMATION_LABELS[a]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-faint">
              « Orbite » anime directement l’image, sans vidéo : rien à exporter, rien à
              compresser, et le rendu reste net à toutes les tailles. Conçue pour une
              bannière large portant une rangée d’univers produits.
            </p>
          </div>

          <ImageUploadInput
            label="Image de fond"
            value={form.imageUrl}
            onChange={(url) => setForm({ ...form, imageUrl: url })}
          />
          <VideoUploadInput
            label="Vidéo de fond"
            value={form.videoUrl}
            onChange={(url) => setForm({ ...form, videoUrl: url })}
            hint="La vidéo passe devant l’image, muette et en boucle. L’image sert alors de vignette pendant le chargement — et de secours pour les visiteurs qui ont désactivé les animations."
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Début (optionnel)</label>
              <input type="datetime-local" className="input" {...champ('startsAt')} />
            </div>
            <div>
              <label className="label">Fin (optionnel)</label>
              <input type="datetime-local" className="input" {...champ('endsAt')} />
              <p className="mt-1 text-xs text-faint">
                Un décompte s’affiche dans la dernière semaine.
              </p>
            </div>
            <div>
              <label className="label">Priorité</label>
              <input type="number" min={0} max={1000} className="input" {...champ('priority')} />
              <p className="mt-1 text-xs text-faint">La plus haute l’emporte.</p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Actif
          </label>

          <div className="flex gap-3">
            <button className="btn-primary" disabled={envoi}>
              {envoi ? '…' : edite ? 'Enregistrer' : 'Créer le bandeau'}
            </button>
            {edite && (
              <button type="button" onClick={reinitialiser} className="text-sm text-muted hover:text-content">
                Annuler
              </button>
            )}
          </div>
        </form>

        <div className="mt-8 space-y-3">
          {banners.length === 0 && (
            <p className="card p-6 text-center text-sm text-muted">
              Aucun bandeau. Sans campagne, la marketplace affiche son titre habituel.
            </p>
          )}
          {banners.map((b) => (
            <div key={b.id} className="card flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {b.title}
                  {b.id === enAntenne && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-500">
                      à l’antenne
                    </span>
                  )}
                  {!b.active && (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-faint">
                      inactif
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-faint">
                  {b.badge ? `${b.badge} · ` : ''}
                  {BANNER_TONE_LABELS[b.tone]} · priorité {b.priority}
                  {b.startsAt && ` · du ${new Date(b.startsAt).toLocaleString('fr-FR')}`}
                  {b.endsAt && ` · au ${new Date(b.endsAt).toLocaleString('fr-FR')}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-sm">
                <button onClick={() => basculer(b)} className="text-muted hover:text-content">
                  {b.active ? 'Désactiver' : 'Activer'}
                </button>
                <button onClick={() => editer(b)} className="text-brand-violet hover:underline">
                  Modifier
                </button>
                <button onClick={() => supprimer(b)} className="text-muted hover:text-red-400">
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
