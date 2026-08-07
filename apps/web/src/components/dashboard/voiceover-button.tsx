'use client';

import { useState } from 'react';
import type { VideoAsset } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { GenTimer } from './video-gallery';

/** Voix préréglées du modèle TTS (MiniMax speech-02). */
const VOICES = [
  { id: 'Friendly_Person', key: 'vo.voiceFriendly' },
  { id: 'Calm_Woman', key: 'vo.voiceCalmWoman' },
  { id: 'Lively_Girl', key: 'vo.voiceLivelyGirl' },
  { id: 'Deep_Voice_Man', key: 'vo.voiceDeepMan' },
  { id: 'Elegant_Man', key: 'vo.voiceElegantMan' },
];
const LANGS = ['fr', 'en', 'ar', 'es'];

/** Ambiances musicales → prompt MusicGen (libellé traduit côté i18n). */
const AMBIANCES = [
  { key: 'vo.ambAfro', prompt: 'upbeat modern afro-chic fashion background music, catchy, instrumental, no vocals' },
  { key: 'vo.ambLuxe', prompt: 'elegant luxury fashion background music, smooth, cinematic, instrumental, no vocals' },
  { key: 'vo.ambDynamic', prompt: 'energetic upbeat pop runway music, driving beat, instrumental, no vocals' },
  { key: 'vo.ambChill', prompt: 'chill lo-fi relaxed background music, mellow, instrumental, no vocals' },
];

/**
 * Ajoute une voix off publicitaire à une vidéo. Script optionnel (généré si vide).
 * Crée une NOUVELLE vidéo ; `onDone` rafraîchit la liste pour l'afficher.
 */
export function VoiceoverButton({
  videoId,
  productName,
  onDone,
}: {
  videoId: string;
  productName?: string;
  onDone?: (created?: VideoAsset) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [script, setScript] = useState('');
  const [language, setLanguage] = useState('fr');
  const [voice, setVoice] = useState(VOICES[0]!.id);
  const [music, setMusic] = useState(false);
  const [ambiance, setAmbiance] = useState(AMBIANCES[0]!.prompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const created = await apiFetch<VideoAsset>(`/ai/video/${videoId}/voiceover`, {
        method: 'POST',
        body: JSON.stringify({
          script: script.trim() || undefined,
          language,
          voice,
          music,
          musicPrompt: music ? ambiance : undefined,
        }),
      });
      setOpen(false);
      setScript('');
      onDone?.(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-border py-1.5 text-[11px] font-medium text-brand-violet transition hover:border-brand-violet"
      >
        🎙️ {t('vo.add')}
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-brand-violet/40 bg-surface-2 p-2">
      <textarea
        className="input min-h-[54px] text-xs"
        value={script}
        onChange={(e) => setScript(e.target.value)}
        placeholder={t('vo.scriptPh') + (productName ? ` (${productName})` : '')}
      />
      <div className="grid grid-cols-2 gap-2">
        <select className="input text-xs" value={voice} onChange={(e) => setVoice(e.target.value)}>
          {VOICES.map((v) => (
            <option key={v.id} value={v.id}>{t(v.key)}</option>
          ))}
        </select>
        <select className="input text-xs" value={language} onChange={(e) => setLanguage(e.target.value)}>
          {LANGS.map((l) => (
            <option key={l} value={l}>{t(`lang.${l}`)}</option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-xs text-content">
        <input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} />
        🎵 {t('vo.music')}
      </label>
      {music && (
        <select className="input text-xs" value={ambiance} onChange={(e) => setAmbiance(e.target.value)}>
          {AMBIANCES.map((a) => (
            <option key={a.key} value={a.prompt}>{t(a.key)}</option>
          ))}
        </select>
      )}
      {error && <p className="rounded bg-red-500/15 px-2 py-1 text-[11px] text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={run} disabled={loading} className="btn-primary flex-1 py-1.5 text-xs">
          {loading ? (
            <span>⏱️ <GenTimer /> · {t('vo.generating')}</span>
          ) : (
            <>✨ {t('vo.generate')}</>
          )}
        </button>
        {!loading && (
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted"
          >
            {t('common.cancel')}
          </button>
        )}
      </div>
      <p className="text-[10px] text-faint">{t('vo.hint')}</p>
    </div>
  );
}
