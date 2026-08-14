'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface MailStatus {
  configured: boolean;
  host: string | null;
  port: string;
  secure: boolean;
  user: string | null;
  from: string;
}

/**
 * Diagnostic de la messagerie, réservé à l'administrateur.
 *
 * Les envois de l'application avalent leurs erreurs pour ne jamais faire
 * échouer une commande : une configuration SMTP fausse est donc invisible
 * depuis l'extérieur. Ce panneau affiche les réglages en place et permet un
 * envoi de test qui remonte le message d'erreur exact du serveur.
 */
export function MailDiagnostic() {
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [to, setTo] = useState('');
  const [result, setResult] = useState<{ sent: boolean; error?: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    apiFetch<MailStatus>('/admin/mail/status')
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const sendTest = async () => {
    if (!to.trim()) return;
    setSending(true);
    setResult(null);
    try {
      setResult(
        await apiFetch<{ sent: boolean; error?: string }>('/admin/mail/test', {
          method: 'POST',
          body: JSON.stringify({ to: to.trim() }),
        }),
      );
    } catch (err) {
      setResult({ sent: false, error: err instanceof Error ? err.message : 'Erreur inconnue' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card p-5">
      <h2 className="mb-1 font-bold">✉️ Envoi d’emails</h2>
      <p className="mb-4 text-xs text-muted">
        Réinitialisations de mot de passe, confirmations de commande et alertes.
      </p>

      {status === null ? (
        <p className="text-sm text-muted">…</p>
      ) : !status.configured ? (
        <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-500">
          ⚠️ SMTP non configuré : aucun email ne part. Renseignez les variables <code>SMTP_*</code>.
        </p>
      ) : (
        <dl className="mb-4 space-y-1 text-xs">
          {[
            ['Serveur', `${status.host}:${status.port}${status.secure ? ' (SSL)' : ''}`],
            ['Identifiant', status.user ?? '—'],
            ['Expéditeur', status.from],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-24 shrink-0 text-faint">{k}</dt>
              <dd className="break-all">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Adresse de test"
          className="input min-w-[200px] flex-1"
        />
        <button onClick={sendTest} disabled={sending || !to.trim()} className="btn-primary text-sm disabled:opacity-40">
          {sending ? '…' : 'Envoyer un test'}
        </button>
      </div>

      {result && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            result.sent ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-400'
          }`}
        >
          {result.sent
            ? '✅ Email envoyé. S’il n’arrive pas, regardez les indésirables.'
            : `❌ Échec — ${result.error ?? 'raison inconnue'}`}
        </p>
      )}
    </div>
  );
}
