'use client';

import { useState } from 'react';
import { uploadFile } from '@/lib/api';

/**
 * Champ vidéo : import depuis l'appareil, ou collage d'une adresse.
 *
 * Partagé plutôt que recopié dans chaque écran. Le serveur ré-encode ce qu'il
 * reçoit en MP4, donc un export de téléphone passe tel quel — mais cela prend
 * du temps, et c'est précisément ce qu'il faut dire pendant l'attente : un
 * bouton figé sans explication donne l'impression d'un site cassé.
 */
export function VideoUploadInput({
  value,
  onChange,
  label = 'Vidéo',
  hint,
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
}) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const importer = async (file: File | undefined) => {
    if (!file) return;
    setErreur('');
    setEnvoi(true);
    try {
      const { url } = await uploadFile(file);
      onChange(url);
    } catch (err) {
      // L'ancien champ avalait cette erreur : l'envoi échouait, le bouton
      // reprenait son état normal, et rien ne l'expliquait.
      setErreur(err instanceof Error ? err.message : 'Échec de l’envoi');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div>
      <label className="label">{label}</label>

      {value ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={value}
            controls
            muted
            playsInline
            preload="metadata"
            className="max-h-48 w-full rounded-lg border border-border bg-black"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs text-red-400 hover:underline"
            >
              ✕ Retirer la vidéo
            </button>
            <span className="min-w-0 flex-1 truncate text-[11px] text-faint">{value}</span>
          </div>
        </div>
      ) : (
        <>
          <label
            className={`mb-2 flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-surface-2 p-4 text-center transition ${
              envoi ? 'cursor-wait opacity-70' : 'cursor-pointer hover:border-brand-violet'
            }`}
          >
            <input
              type="file"
              accept="video/*"
              className="hidden"
              disabled={envoi}
              onChange={(e) => importer(e.target.files?.[0])}
            />
            {envoi ? (
              <>
                <span className="text-sm text-muted">Envoi et conversion en cours…</span>
                <span className="text-[10px] text-faint">
                  Une vidéo lourde peut demander une à deux minutes. Ne fermez pas la page.
                </span>
              </>
            ) : (
              <>
                <span className="text-xl">🎬</span>
                <span className="text-xs text-muted">Importer une vidéo depuis mon appareil</span>
                <span className="text-[10px] text-faint">
                  MP4, MOV, WebM — convertie automatiquement, jusqu’à 200 Mo
                </span>
              </>
            )}
          </label>

          <input
            className="input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="…ou collez une URL https://"
          />
        </>
      )}

      {hint && <p className="mt-1 text-[11px] text-faint">{hint}</p>}
      {erreur && <p className="mt-1 text-xs text-red-400">{erreur}</p>}
    </div>
  );
}
