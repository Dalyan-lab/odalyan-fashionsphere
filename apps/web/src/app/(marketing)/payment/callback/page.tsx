'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useCart } from '@/lib/store';

function CallbackInner() {
  const params = useSearchParams();
  const clearCart = useCart((s) => s.clear);
  const [state, setState] = useState<'verifying' | 'paid' | 'failed'>('verifying');

  useEffect(() => {
    const status = params.get('status');
    const provider = params.get('provider');

    // Chaque fournisseur renvoie sa référence différemment :
    // Paystack → reference/trxref ; CinetPay → notre txid ; Flutterwave → transaction_id.
    let endpoint = '/payments/flutterwave/verify';
    let payload: Record<string, string> | null = null;
    if (provider === 'paystack') {
      const reference = params.get('reference') ?? params.get('trxref');
      endpoint = '/payments/paystack/verify';
      payload = reference ? { reference } : null;
    } else if (provider === 'cinetpay') {
      const txid = params.get('txid');
      endpoint = '/payments/cinetpay/verify';
      payload = txid ? { transactionId: txid } : null;
    } else {
      const transactionId = params.get('transaction_id');
      payload = transactionId ? { transactionId } : null;
    }

    if (status === 'cancelled' || !payload) {
      setState('failed');
      return;
    }
    apiFetch<{ status: string }>(endpoint, {
      method: 'POST',
      auth: false,
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (res.status === 'PAID') {
          clearCart();
          setState('paid');
        } else {
          setState('failed');
        }
      })
      .catch(() => setState('failed'));
  }, [params, clearCart]);

  if (state === 'verifying') {
    return (
      <div>
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-border border-t-brand-magenta" />
        <p className="mt-4 text-muted">Vérification du paiement…</p>
      </div>
    );
  }

  if (state === 'paid') {
    return (
      <div>
        <div className="text-6xl">✅</div>
        <h1 className="mt-4 font-display text-3xl font-bold">Paiement réussi !</h1>
        <p className="mt-2 text-muted">Merci pour votre achat sur Odalyan FashionSphere.</p>
        <Link href="/marketplace" className="btn-primary mt-8">Continuer mes achats</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="text-6xl">⚠️</div>
      <h1 className="mt-4 font-display text-3xl font-bold">Paiement non abouti</h1>
      <p className="mt-2 text-muted">Le paiement a été annulé ou a échoué. Votre panier est conservé.</p>
      <Link href="/cart" className="btn-primary mt-8">Retour au panier</Link>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-6 text-center">
      <Suspense fallback={<p className="text-muted">Chargement…</p>}>
        <CallbackInner />
      </Suspense>
    </main>
  );
}
