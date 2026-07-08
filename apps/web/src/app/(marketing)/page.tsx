'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

const FEATURES = [
  {
    icon: '🧍',
    title: 'Avatar IA personnalisé',
    desc: 'Le client crée son avatar à partir de photos ou manuellement.',
    img: 'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=600',
  },
  {
    icon: '👗',
    title: 'Essayage virtuel',
    desc: 'Visualisez chaque vêtement sur l’avatar, vue 360°.',
    img: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600',
  },
  {
    icon: '🎭',
    title: 'Mannequins IA',
    desc: 'Générez des photos studio pro à partir d’une seule image produit.',
    img: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600',
  },
  {
    icon: '🌀',
    title: 'Défilé 3D animé',
    desc: 'Mannequins 3D rotatifs et animation défilé premium.',
    img: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600',
  },
  {
    icon: '🎬',
    title: 'Vidéo IA',
    desc: 'Transformez une photo en vidéo TikTok / Reels / Shorts.',
    img: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600',
  },
  {
    icon: '📣',
    title: 'Publicité automatique',
    desc: 'Visuels, slogans, hashtags et publication multi-réseaux.',
    img: 'https://images.unsplash.com/photo-1467043237213-65f2da53396f?w=600',
  },
];

const STUDIO_STEPS = [
  '📸 Photos marketing', '🧍 Avatar mannequin', '🌀 Défilé vidéo', '🖼️ Bannière publicitaire',
  '🎬 Vidéo TikTok', '📝 Description & hashtags',
];

const PLANS = [
  { name: 'Starter', price: 'Gratuit', items: ['Boutique simple', '50 produits', 'Logo & slogan'], highlight: false },
  { name: 'Pro', price: '15€/mois', items: ['Produits illimités', 'Mannequin & Avatar IA', 'Photos IA'], highlight: true },
  { name: 'Business', price: '49€/mois', items: ['Avatar 3D', 'Défilé 3D', 'Essayage virtuel', 'Publicités IA'], highlight: false },
  { name: 'Enterprise', price: '199€/mois', items: ['White Label', 'Domaine perso', 'API complète', 'IA dédiée'], highlight: false },
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
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => (
            <div key={p.name} className={`card flex flex-col p-6 ${p.highlight ? 'ring-2 ring-brand-violet' : ''}`}>
              {p.highlight && (
                <span className="mb-3 self-start rounded-full bg-brand-gradient px-3 py-1 text-xs font-bold text-white">
                  Populaire
                </span>
              )}
              <h3 className="font-display text-2xl font-bold">{p.name}</h3>
              <p className="mt-2 text-3xl font-bold brand-gradient-text">{p.price}</p>
              <ul className="mt-6 flex-1 space-y-2 text-sm text-muted">
                {p.items.map((it) => (
                  <li key={it} className="flex items-center gap-2">
                    <span className="text-brand-coral">✓</span> {it}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="btn-primary mt-6 w-full">
                Choisir
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
