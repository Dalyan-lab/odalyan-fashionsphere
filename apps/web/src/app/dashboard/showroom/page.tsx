'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { BodyType } from '@odalyan/shared';
import { Topbar } from '@/components/dashboard/topbar';
import { Icon } from '@/components/dashboard/icons';
import { apiFetch, uploadImage } from '@/lib/api';
import type { Product } from '@/lib/types';
import type { MannequinOptions } from '@/components/three/showroom';

const Showroom = dynamic(() => import('@/components/three/showroom'), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-muted">Chargement du moteur 3D…</div>,
});

const GltfViewer = dynamic(() => import('@/components/three/gltf-viewer'), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-muted">Chargement du modèle 3D…</div>,
});

const ANGLE_LABELS = ['Face', '45° gauche', 'Profil gauche', '45° droite', 'Dos'];
const GARMENT_COLORS = ['#7c3aed', '#e8527a', '#c0306a', '#3b82f6', '#0e7a5f', '#1f2937', '#f4825e', '#facc15'];

const BODY_SCALE: Record<string, number> = {
  [BodyType.MINCE]: 0.85,
  [BodyType.NORMALE]: 1,
  [BodyType.ATHLETIQUE]: 1.12,
  [BodyType.GRANDE_TAILLE]: 1.3,
};

type ModelCategory = 'Femme' | 'Homme' | 'Enfant';
const MODELS: Record<ModelCategory, string> = {
  Femme: '/models/femme.glb',
  Homme: '/models/homme.glb',
  Enfant: '/models/femme.glb', // modèle féminin réduit (placeholder enfant)
};

const SIZES = ['S', 'M', 'L', 'XL'] as const;
const SIZE_SCALE: Record<string, number> = { S: 0.92, M: 1, L: 1.08, XL: 1.16 };

export default function ShowroomPage() {
  const [mode, setMode] = useState<'gltf' | 'stylized'>('gltf');
  const [garmentColor, setGarmentColor] = useState('#7c3aed');
  const [bodyType, setBodyType] = useState<BodyType>(BodyType.NORMALE);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);

  // Produit appliqué comme texture (try-on 3D)
  const [products, setProducts] = useState<Product[]>([]);
  const [garmentTextureUrl, setGarmentTextureUrl] = useState('');

  // Modèle 3D réaliste
  const [category, setCategory] = useState<ModelCategory>('Femme');
  const [size, setSize] = useState<string>('M');
  const [customModelUrl, setCustomModelUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    apiFetch<Product[]>('/products/mine')
      .then((p) => setProducts(p.filter((x) => x.images[0])))
      .catch(() => undefined);
  }, []);

  const modelUrl = customModelUrl || MODELS[category];
  const modelName = customModelUrl ? customName : `${category} (modèle réaliste)`;
  const bodyScale = BODY_SCALE[bodyType] ?? 1;
  const sizeScale = (SIZE_SCALE[size] ?? 1) * (category === 'Enfant' && !customModelUrl ? 0.78 : 1);

  const stylizedOptions: MannequinOptions = {
    garmentColor,
    skinColor: '#caa07a',
    bodyScale,
    garmentTextureUrl: garmentTextureUrl || undefined,
  };

  const onModelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(glb|gltf)$/i.test(file.name)) {
      setUploadError('Formats acceptés : .glb ou .gltf');
      return;
    }
    setUploadError('');
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      setCustomModelUrl(url);
      setCustomName(file.name);
      setPlaying(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Échec de l’import');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Topbar />
      <div className="p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-violet-magenta text-white">
            {Icon.cube({})}
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">Showroom 3D</h1>
            <p className="text-muted">Mannequin humain 3D réaliste, essayage et défilé animé.</p>
          </div>
          <span className="ml-3 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-bold text-brand-violet">
            Phase 3
          </span>
        </div>

        {/* Bascule de mode */}
        <div className="mt-5 inline-flex gap-1 rounded-xl bg-surface-2 p-1">
          <button
            onClick={() => { setMode('gltf'); setPlaying(false); }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${mode === 'gltf' ? 'bg-brand-violet-magenta text-white' : 'text-muted'}`}
          >
            Mannequin réaliste
          </button>
          <button
            onClick={() => { setMode('stylized'); setPlaying(false); }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${mode === 'stylized' ? 'bg-brand-violet-magenta text-white' : 'text-muted'}`}
          >
            Mannequin stylisé
          </button>
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Scène 3D */}
          <div className="card relative h-[600px] overflow-hidden">
            {mode === 'gltf' ? (
              <GltfViewer
                url={modelUrl}
                playing={playing}
                bodyScale={bodyScale}
                sizeScale={sizeScale}
                garmentTextureUrl={garmentTextureUrl || undefined}
              />
            ) : (
              <Showroom options={stylizedOptions} playing={playing} onStep={setStep} />
            )}

            <div className="pointer-events-none absolute left-4 top-4 rounded-lg border border-border bg-bg/60 px-3 py-1.5 text-sm backdrop-blur">
              {mode === 'stylized' && playing ? (
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-brand-magenta" />
                  Défilé · {ANGLE_LABELS[step]}
                </span>
              ) : mode === 'gltf' ? (
                <span className="text-muted">🧍 {modelName}{playing ? ' · défilé' : ''}</span>
              ) : (
                <span className="text-muted">🖱️ Glissez pour tourner · molette pour zoomer</span>
              )}
            </div>

            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-bg/70 px-3 py-2 backdrop-blur">
              <button
                onClick={() => setPlaying((p) => !p)}
                className="grid h-9 w-9 place-items-center rounded-full bg-brand-violet-magenta text-white"
              >
                {playing ? '❚❚' : Icon.play({ width: 14, height: 14 })}
              </button>
              <span className="text-xs text-muted">{playing ? 'Défilé en cours' : 'Lancer le défilé'}</span>
            </div>
          </div>

          {/* Contrôles */}
          <div className="space-y-5">
            {/* Mannequin (mode réaliste) */}
            {mode === 'gltf' && (
              <div className="card p-5">
                <h2 className="mb-3 font-bold">Mannequin</h2>
                <label className="label">Type</label>
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {(Object.keys(MODELS) as ModelCategory[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => { setCategory(c); setCustomModelUrl(''); setPlaying(false); }}
                      className={`rounded-xl border px-2 py-2 text-sm transition ${!customModelUrl && category === c ? 'border-brand-violet bg-surface-2' : 'border-border text-muted'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <label className="label">Taille du vêtement</label>
                <div className="grid grid-cols-4 gap-2">
                  {SIZES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={`rounded-xl border py-2 text-sm transition ${size === s ? 'border-brand-violet bg-surface-2' : 'border-border text-muted'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-surface-2 p-4 text-center transition hover:border-brand-violet">
                  <input type="file" accept=".glb,.gltf,model/gltf-binary" className="hidden" onChange={onModelFile} />
                  {uploading ? (
                    <span className="text-sm text-muted">Import…</span>
                  ) : (
                    <>
                      <span className="text-xl">📦</span>
                      <span className="text-xs text-muted">Importer mon modèle 3D (.glb)</span>
                    </>
                  )}
                </label>
                {customModelUrl && (
                  <button onClick={() => { setCustomModelUrl(''); setCustomName(''); }} className="mt-2 w-full text-xs text-brand-violet hover:underline">
                    Revenir au modèle {category}
                  </button>
                )}
                {uploadError && <p className="mt-2 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{uploadError}</p>}
              </div>
            )}

            {/* Tenue / essayage (les deux modes) */}
            <div className="card p-5">
              <h2 className="mb-3 font-bold">Tenue</h2>
              <label className="label">Essayer un produit (texture)</label>
              <select className="input" value={garmentTextureUrl} onChange={(e) => setGarmentTextureUrl(e.target.value)}>
                <option value="">— Aucun —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.images[0]}>{p.name}</option>
                ))}
              </select>
              {garmentTextureUrl && (
                <p className="mt-1 text-[10px] text-brand-violet">✨ Produit appliqué sur le mannequin — tournez pour voir tous les angles.</p>
              )}

              {mode === 'stylized' && (
                <>
                  <label className="label mt-4">Couleur du vêtement</label>
                  <div className={`flex flex-wrap gap-2 ${garmentTextureUrl ? 'opacity-40' : ''}`}>
                    {GARMENT_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setGarmentColor(c)}
                        className={`h-8 w-8 rounded-full border-2 transition ${garmentColor === c ? 'scale-110 border-content' : 'border-transparent'}`}
                        style={{ background: c }}
                        aria-label={c}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Morphologie (les deux modes) */}
            <div className="card p-5">
              <h2 className="mb-3 font-bold">Morphologie</h2>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(BodyType).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBodyType(b)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${bodyType === b ? 'border-brand-violet bg-surface-2' : 'border-border text-muted'}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setPlaying((p) => !p)} className="btn-primary w-full">
              {playing ? 'Arrêter le défilé' : 'Lancer le défilé'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
