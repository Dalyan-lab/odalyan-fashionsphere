'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ProductReviewsDto } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { useT } from '@/lib/i18n';

/** Affichage en étoiles (lecture seule). */
export function Stars({ value, className = '' }: { value: number; className?: string }) {
  const rounded = Math.round(value);
  return (
    <span className={`inline-flex ${className}`} aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rounded ? 'text-amber-400' : 'text-faint/40'}>
          ★
        </span>
      ))}
    </span>
  );
}

export function ProductReviews({ productId }: { productId: string }) {
  const t = useT();
  const user = useAuth((s) => s.user);
  const [data, setData] = useState<ProductReviewsDto | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => {
    apiFetch<ProductReviewsDto>(`/reviews/product/${productId}`, { auth: false })
      .then(setData)
      .catch(() => undefined);
  };
  useEffect(() => {
    load();
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch(`/reviews/product/${productId}`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment: comment || undefined }),
      });
      setComment('');
      setMsg({ ok: true, text: t('rev.thanks') });
      load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : t('common.error') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-6 pb-16">
      <div className="border-t border-border pt-10">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl font-bold">{t('rev.title')}</h2>
          {data && data.count > 0 && (
            <span className="flex items-center gap-2 text-sm text-muted">
              <Stars value={data.average} />
              <strong>{data.average.toFixed(1)}</strong> · {data.count} {t('rev.count')}
            </span>
          )}
        </div>

        {/* Formulaire (utilisateur connecté) */}
        <div className="mt-6 max-w-xl">
          {user ? (
            <div className="card space-y-3 p-5">
              <p className="text-sm font-semibold">{t('rev.leave')}</p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRating(i)}
                    className={`text-2xl transition ${i <= rating ? 'text-amber-400' : 'text-faint/40 hover:text-amber-300'}`}
                    aria-label={`${i}/5`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('rev.commentPlaceholder')}
                rows={3}
                className="input w-full"
              />
              <div className="flex items-center gap-3">
                <button onClick={submit} disabled={busy} className="btn-primary text-sm">
                  {busy ? '…' : t('rev.submit')}
                </button>
                {msg && (
                  <span className={`text-xs ${msg.ok ? 'text-emerald-500' : 'text-red-400'}`}>{msg.text}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="card p-5 text-sm text-muted">
              {t('rev.loginToReview')}{' '}
              <Link href="/login" className="text-brand-violet hover:underline">
                {t('nav.login')}
              </Link>
            </div>
          )}
        </div>

        {/* Liste des avis */}
        <div className="mt-8 space-y-4">
          {!data || data.count === 0 ? (
            <p className="text-faint">{t('rev.none')}</p>
          ) : (
            data.reviews.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.author}</span>
                  <Stars value={r.rating} className="text-sm" />
                </div>
                {r.comment && <p className="mt-2 text-sm text-muted">{r.comment}</p>}
                <p className="mt-1 text-[11px] text-faint">
                  {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
