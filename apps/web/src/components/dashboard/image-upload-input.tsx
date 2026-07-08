'use client';

import { useState } from 'react';
import { uploadImage } from '@/lib/api';

/** Champ image : saisie d'URL OU import direct d'un fichier (upload). */
export function ImageUploadInput({
  value,
  onChange,
  label = 'Image',
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="label">{label}</label>

      {value ? (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="aperçu" className="h-14 w-14 rounded-lg object-cover" />
          <span className="flex-1 truncate text-xs text-faint">{value}</span>
          <button type="button" onClick={() => onChange('')} className="text-xs text-red-400 hover:text-red-300">
            Retirer
          </button>
        </div>
      ) : (
        <label className="mb-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-surface-2 p-4 text-center transition hover:border-brand-violet">
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
          {uploading ? (
            <span className="text-sm text-muted">Import en cours…</span>
          ) : (
            <>
              <span className="text-xl">📤</span>
              <span className="text-xs text-muted">Importer une image depuis mon appareil</span>
              <span className="text-[10px] text-faint">JPG, PNG, WebP — max 8 Mo</span>
            </>
          )}
        </label>
      )}

      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…ou collez une URL https://"
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
