'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

const FEATURES = [
  {
    icon: '🔥',
    title: 'ViralAmazone',
    desc: 'Repérez les produits Amazon en explosion et générez un script viral en un clic — avec vos liens d’affiliation.',
    img: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=600',
  },
  {
    icon: '🎭',
    title: 'Mannequins IA',
    desc: 'Votre vraie photo produit, portée par un mannequin réaliste. Fini les shootings coûteux.',
    img: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600',
  },
  {
    icon: '🎬',
    title: 'Vidéo IA',
    desc: 'Transformez une photo ou un visuel en vidéo défilé prête pour TikTok / Reels / Shorts.',
    img: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600',
  },
  {
    icon: '📣',
    title: 'Campagnes en 1 clic',
    desc: 'Visuel, textes et légendes par réseau — à partir de vos produits ou de vos créations IA.',
    img: 'https://images.unsplash.com/photo-1467043237213-65f2da53396f?w=600',
  },
  {
    icon: '👗',
    title: 'Essayage virtuel & défilé 360°',
    desc: 'Visualisez chaque vêtement sur un mannequin réaliste, en rotation 360°.',
    img: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600',
  },
  {
    icon: '🏆',
    title: 'Niveaux & récompenses',
    desc: 'Plus vous créez et générez de clics, plus vous montez de niveau et gagnez des crédits IA offerts.',
    img: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=600',
  },
];

const STUDIO_STEPS = [
  '📸 Photos marketing', '🧍 Avatar mannequin', '🌀 Défilé vidéo', '🖼️ Bannière publicitaire',
  '🎬 Vidéo TikTok', '📝 Description & hashtags',
];

const PLANS = [
  {
    name: 'Découverte',
    price: 'Gratuit',
    eur: '',
    items: ['Boutique en ligne + 50 produits', 'Liens d’affiliation ViralAmazone', '15 crédits IA / mois'],
    highlight: false,
  },
  {
    name: 'Créateur',
    price: '9 800 FCFA',
    eur: '≈ 15 € / mois',
    items: ['Produits illimités', 'Mannequins & avatars IA', 'Campagnes IA multi-réseaux', '150 crédits IA / mois'],
    highlight: true,
  },
  {
    name: 'Studio Pro',
    price: '32 000 FCFA',
    eur: '≈ 49 € / mois',
    items: ['Tout Créateur, plus', 'Vidéos IA (défilé, animation)', 'Essayage virtuel & défilé 360°', '600 crédits IA / mois'],
    highlight: false,
  },
  {
    name: 'Marque',
    price: '130 000 FCFA',
    eur: '≈ 199 € / mois',
    items: ['Tout Studio Pro, plus', 'Domaine perso & marque blanche', 'API complète', '5 000 crédits IA / mois'],
    highlight: false,
  },
];

const STATS = [
  { value: '+30%', label: 'd’engagement' },
  { value: '-40%', label: 'de retours produits' },
  { value: '2 min', label: 'photo → campagne' },
];

export default function HomePage() {
  return (
    <main className="overflow-hidden">
      {/* HERO */}
      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pt-16 pb-24 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-4 py-1.5 text-sm">
            <span className="h-2 w-2 rounded-full bg-brand-coral" />
            <span className="brand-gradient-text font-semibold">La mode du futur commence ici</span>
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] md:text-6xl">
            Créez, animez, exposez et vendez avec la puissance de{' '}
            <span className="brand-gradient-text">l’IA</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            La première plateforme FashionTech qui transforme une simple photo de vêtement en
            mannequins, défilés 3D, vidéos et publicités — prêtes à vendre.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link href="/register" className="btn-primary text-base">
              Créer ma boutique
            </Link>
            <Link href="/marketplace" className="btn-ghost text-base">
              Découvrir la marketplace
            </Link>
          </div>
          <div className="mt-10 flex gap-8">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="font-display text-3xl font-bold brand-gradient-text">{s.value}</p>
                <p className="text-sm text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Visuel hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="relative"
        >
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-brand-gradient opacity-30 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900"
              alt="Mode IA"
              className="aspect-[4/5] w-full object-cover"
            />
            <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-2xl border border-border bg-bg/70 p-3 backdrop-blur-lg">
              <Image src="/logo.png" alt="Odalyan" width={40} height={40} className="h-10 w-10 object-contain" />
              <div>
                <p className="text-sm font-semibold">Studio IA généré</p>
                <p className="text-xs text-muted">Mannequin · Défilé · Vidéo · Pub</p>
              </div>
              <span className="ml-auto rounded-full bg-brand-gradient px-3 py-1 text-xs font-bold text-white">
                2 min
              </span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-center">
          <h2 className="font-display text-4xl font-bold">Un studio IA complet pour la mode</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted">
            Tout ce dont une boutique, une marque ou un créateur a besoin pour vendre et faire sa
            publicité — automatisé par l’IA.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="card group overflow-hidden"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.img} alt={f.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <span className="absolute left-3 top-3 grid h-10 w-10 place-items-center rounded-xl bg-bg/70 text-xl backdrop-blur">
                  {f.icon}
                </span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FASHION AI STUDIO — campagne en un clic */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="card relative overflow-hidden p-8 md:p-12">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-gradient opacity-20 blur-3xl" />
          <div className="relative grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="brand-gradient-text text-sm font-bold uppercase tracking-wider">
                Fashion AI Studio™
              </span>
              <h2 className="mt-3 font-display text-4xl font-bold">
                D’une photo à une campagne complète, en un clic
              </h2>
              <p className="mt-4 text-muted">
                Importez la photo d’un vêtement. L’IA génère automatiquement tout ce qu’il vous faut
                pour vendre et faire votre publicité.
              </p>
              <Link href="/register" className="btn-primary mt-8">
                Essayer le Studio IA
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {STUDIO_STEPS.map((s) => (
                <div key={s} className="card-2 flex items-center gap-2 p-4 text-sm font-medium">
                  <span className="text-brand-coral">✓</span> {s}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-center font-display text-4xl font-bold">Des offres pour chaque ambition</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted">
          Paiement mensuel ou annuel (−2 mois), sans engagement. Wave, Orange Money, MTN, Moov &amp; carte.
        </p>

        {/* Offre Fondateur */}
        <div className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-3 text-center text-sm">
          <span className="font-semibold text-amber-500">★ Offre Fondateur — 40 % sur vos 3 premiers mois</span>
          <span className="text-muted">
            avec le code <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-brand-violet">FONDATEUR</span>, pour les 100 premières boutiques.
          </span>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => (
            <div key={p.name} className={`card flex flex-col p-6 ${p.highlight ? 'ring-2 ring-brand-violet' : ''}`}>
              {p.highlight && (
                <span className="mb-3 self-start rounded-full bg-brand-gradient px-3 py-1 text-xs font-bold text-white">
                  Populaire
                </span>
              )}
              <h3 className="font-display text-2xl font-bold">{p.name}</h3>
              <p className="mt-2 text-3xl font-bold brand-gradient-text">{p.price}</p>
              {p.eur && <p className="mt-0.5 text-xs text-faint">{p.eur}</p>}
              <ul className="mt-6 flex-1 space-y-2 text-sm text-muted">
                {p.items.map((it) => (
                  <li key={it} className="flex items-center gap-2">
                    <span className="text-brand-coral">✓</span> {it}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="btn-primary mt-6 w-full">
                {p.price === 'Gratuit' ? 'Commencer' : 'Choisir'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <div className="card relative overflow-hidden p-12">
          <div className="absolute inset-0 -z-10 bg-brand-gradient opacity-10" />
          <h2 className="font-display text-4xl font-bold">
            « De la photo du vêtement à la vente en quelques minutes. »
          </h2>
          <Link href="/register" className="btn-primary mt-8 text-base">
            Démarrer gratuitement
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-10 text-center text-sm text-faint">
        © {new Date().getFullYear()} Odalyan FashionSphere AI™ — Créez, animez, exposez et vendez avec
        l’IA.
      </footer>
    </main>
  );
}
