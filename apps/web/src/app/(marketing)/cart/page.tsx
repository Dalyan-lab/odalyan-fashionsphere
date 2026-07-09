'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { apiFetch } from '@/lib/api';
import { useAuth, useCart } from '@/lib/store';
import { stripePromise, stripeConfigured } from '@/lib/stripe';
import { convertAndFormat, useLocale } from '@/lib/i18n';

interface CheckoutResult {
  order: { id: string; orderNumber: string; totalAmount: string };
  payment: { rawPayload?: { clientSecret?: string; link?: string } | null };
}

export default function CartPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, remove, clear, total } = useCart();
  const currency = useLocale((s) => s.currency);

  const [address, setAddress] = useState({ fullName: '', line1: '', city: '', postalCode: '', country: 'CI' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'pay' | 'done'>('idle');
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [provider, setProvider] = useState<'paystack' | 'stripe' | 'mock'>('mock');

  useEffect(() => {
    apiFetch<{ provider: 'paystack' | 'stripe' | 'mock' }>('/payments/config', { auth: false })
      .then((c) => setProvider(c.provider))
      .catch(() => undefined);
  }, []);

  const fmt = (eur: number) => convertAndFormat(eur, 'EUR', currency);
  const payNote =
    provider === 'paystack'
      ? 'Paiement sécurisé : carte & Mobile Money (Wave, Orange, MTN, Moov) via Paystack.'
      : provider === 'stripe' && stripeConfigured
        ? 'Paiement sécurisé par carte (Stripe).'
        : 'Aucun fournisseur configuré — paiement simulé.';

  const checkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login');
      return;
    }
    setError('');
    setStatus('loading');
    try {
      const res = await apiFetch<CheckoutResult>('/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
          shippingAddress: address,
        }),
      });
      const link = res.payment?.rawPayload?.link;
      const secret = res.payment?.rawPayload?.clientSecret;
      if (link) {
        // Paystack : redirection vers la page de paiement hébergée (carte + Mobile Money)
        window.location.href = link;
        return;
      }
      if (secret && stripeConfigured) {
        // Stripe : paiement réel par carte
        setClientSecret(secret);
        setStatus('pay');
      } else {
        // Mode simulé (aucun fournisseur configuré) — commande déjà marquée payée
        clear();
        setStatus('done');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du paiement');
      setStatus('idle');
    }
  };

  if (status === 'done') {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <div className="text-6xl">✅</div>
        <h1 className="mt-4 font-display text-3xl font-bold">Commande confirmée !</h1>
        <p className="mt-2 text-muted">Merci pour votre achat sur Odalyan FashionSphere.</p>
        <Link href="/marketplace" className="btn-primary mt-8">Continuer mes achats</Link>
      </main>
    );
  }

  if (items.length === 0 && status !== 'pay') {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-muted">Votre panier est vide.</p>
        <Link href="/marketplace" className="btn-primary mt-6">Voir la marketplace</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-10 px-6 py-12 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h1 className="font-display text-4xl font-bold">Mon panier</h1>
        <div className="mt-6 space-y-3">
          {items.map((i) => (
            <div key={`${i.productId}-${i.variantId}`} className="card flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {i.image && <img src={i.image} alt="" className="h-14 w-14 rounded-lg object-cover" />}
                <div>
                  <p className="font-medium">{i.name}</p>
                  <p className="text-sm text-faint">{i.quantity} × {fmt(i.price)}</p>
                </div>
              </div>
              {status !== 'pay' && (
                <button onClick={() => remove(i.productId, i.variantId)} className="text-sm text-red-300">Retirer</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card h-fit space-y-3 p-6">
        <h2 className="font-display text-2xl font-bold">Paiement</h2>
        <div className="flex justify-between text-lg">
          <span className="text-muted">Total</span>
          <span className="font-bold text-brand-coral">{fmt(total())}</span>
        </div>
        {error && <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>}

        {status === 'pay' && clientSecret && stripePromise ? (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#7c3aed' } } }}
          >
            <PaymentForm
              onSuccess={() => { clear(); setStatus('done'); }}
              onError={setError}
            />
          </Elements>
        ) : (
          <form onSubmit={checkout} className="space-y-3">
            <input className="input" placeholder="Nom complet" value={address.fullName} onChange={(e) => setAddress({ ...address, fullName: e.target.value })} required />
            <input className="input" placeholder="Adresse" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} required />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Ville" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} required />
              <input className="input" placeholder="Code postal" value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} required />
            </div>
            <select
              className="input"
              value={address.country}
              onChange={(e) => setAddress({ ...address, country: e.target.value })}
              required
            >
              <option value="CI">Côte d’Ivoire</option>
              <option value="SN">Sénégal</option>
              <option value="ML">Mali</option>
              <option value="BF">Burkina Faso</option>
              <option value="BJ">Bénin</option>
              <option value="TG">Togo</option>
              <option value="NE">Niger</option>
              <option value="GN">Guinée</option>
              <option value="CM">Cameroun</option>
              <option value="FR">France</option>
              <option value="OT">Autre pays</option>
            </select>
            <button className="btn-primary w-full" disabled={status === 'loading'}>
              {status === 'loading'
                ? '…'
                : provider === 'stripe' && stripeConfigured
                  ? 'Continuer vers le paiement'
                  : 'Payer'}
            </button>
            <p className="text-center text-xs text-faint">{payNote}</p>
          </form>
        )}
      </div>
    </main>
  );
}

function PaymentForm({ onSuccess, onError }: { onSuccess: () => void; onError: (m: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);

  const pay = async () => {
    if (!stripe || !elements) return;
    setPaying(true);
    onError('');
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });
    if (error) {
      onError(error.message ?? 'Paiement refusé');
      setPaying(false);
      return;
    }
    if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess();
    } else {
      onError('Le paiement n’a pas abouti. Réessayez.');
      setPaying(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement />
      <button onClick={pay} disabled={!stripe || paying} className="btn-primary w-full">
        {paying ? 'Paiement…' : 'Payer maintenant'}
      </button>
    </div>
  );
}
