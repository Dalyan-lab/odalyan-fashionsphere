'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProductCategory, type AuthUser } from '@odalyan/shared';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { useT } from '@/lib/i18n';
import type { Product, Shop } from '@/lib/types';
import { Topbar } from '@/components/dashboard/topbar';
import { Icon } from '@/components/dashboard/icons';
import { AiStudioModal, type StudioMode } from '@/components/dashboard/ai-studio-modal';
import { ImageUploadInput } from '@/components/dashboard/image-upload-input';

/* Images de démonstration (rendu visuel des modules IA à venir) */
const IMG = {
  hero: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900',
  mannequin: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400',
  video: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400',
  pub: 'https://images.unsplash.com/photo-1467043237213-65f2da53396f?w=400',
  avatar: 'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=400',
  dress: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=300',
  runway: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=300',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const t = useT();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [studio, setStudio] = useState<StudioMode | null>(null);

  const refresh = async () => {
    try {
      const s = await apiFetch<Shop | null>('/shops/me');
      setShop(s ?? null);
      if (s) setProducts(await apiFetch<Product[]>('/products/mine'));
    } catch {
      setShop(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  if (!user) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="text-muted">{t('dh.authRequired')}</p>
          <Link href="/login" className="btn-primary mt-6">
            {t('common.signin')}
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-muted">{t('common.loading')}</div>;
  }

  // Les comptes Client (ex: inscription via Google/GitHub) deviennent vendeurs avant d'ouvrir une boutique
  if (user.role === 'CUSTOMER') return <BecomeSeller onUpgraded={refresh} />;

  if (!shop) return <CreateShopForm onCreated={refresh} />;

  const revenue = shop.revenue ?? 0;

  return (
    <>
      <Topbar userInitial={shop.name.charAt(0).toUpperCase()} />

      <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-[1fr_360px]">
        {/* ===== Colonne centrale ===== */}
        <div className="min-w-0 space-y-6">
          {/* HERO */}
          <section className="relative overflow-hidden rounded-3xl border border-border bg-brand-violet-magenta">
            <div className="relative z-10 max-w-md p-7">
              <p className="text-sm font-medium text-white/80">{t('dh.welcome')}</p>
              <h1 className="mt-1 font-display text-4xl font-bold text-white">FashionSphere AI</h1>
              <p className="mt-3 text-sm text-white/85">{t('dh.heroDesc')}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-magenta transition hover:opacity-90">
                  {Icon.plus({ width: 18, height: 18 })} {t('dh.addProduct')}
                </button>
                <Link
                  href={`/shop/${shop.slug}`}
                  className="rounded-xl border border-white/40 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {t('dh.viewShop')}
                </Link>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={IMG.hero}
              alt=""
              className="absolute right-0 top-0 h-full w-1/2 object-cover opacity-90"
              style={{ maskImage: 'linear-gradient(to right, transparent, black 40%)' }}
            />
          </section>

          {/* STATS */}
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon="stats" label={t('dh.totalSales')} value={`${revenue.toLocaleString('fr-FR')} €`} trend="+8.5%" />
            <StatCard icon="orders" label={t('dh.orders')} value={String(shop._count?.orders ?? 0)} trend="+14.2%" />
            <StatCard icon="clients" label={t('dh.visitors')} value="12 640" trend="+21.7%" demo />
            <StatCard icon="marketing" label={t('dh.conversion')} value="2.45%" trend="+6.2%" demo />
          </section>

          {/* OUTILS IA */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <span className="text-brand-violet">{Icon.sparkles({})}</span> {t('dh.myAiTools')}
              </h2>
              <Link href="/dashboard/studio" className="text-sm text-brand-violet hover:underline">
                {t('dh.openStudio')}
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <AiToolCard img={IMG.mannequin} title={t('dh.tool.mannequin')} desc={t('dh.tool.mannequinDesc')} phase="P2" onAction={() => setStudio('mannequin')} />
              <AiToolCard img={IMG.pub} title={t('dh.tool.adcopy')} desc={t('dh.tool.adcopyDesc')} phase="P2" onAction={() => setStudio('adcopy')} />
              <AiToolCard img={IMG.runway} title={t('dh.tool.mannequin3d')} desc={t('dh.tool.mannequin3dDesc')} phase="P3" soon />
              <AiToolCard img={IMG.video} title={t('dh.tool.video')} desc={t('dh.tool.videoDesc')} phase="P4" soon />
            </div>
          </section>

          {/* PRODUITS */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">{t('dh.myProducts')}</h2>
              <Link href="/dashboard/products" className="text-sm text-brand-violet hover:underline">
                {t('common.viewAll')}
              </Link>
            </div>
            {products.length === 0 ? (
              <div className="card p-10 text-center text-muted">
                {t('dh.noProducts')}
                <AddProductInline onAdded={refresh} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {products.map((p) => (
                  <ProductMini key={p.id} product={p} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ===== Panneau droit ===== */}
        <aside className="space-y-6">
          {/* Mon Avatar */}
          <Panel title={t('dh.avatar.title')} subtitle={t('dh.avatar.sub')}>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[0, 1, 2].map((i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={`${IMG.avatar}&sig=${i}`} alt="" className="h-10 w-10 rounded-full border-2 border-surface object-cover" />
                ))}
              </div>
              <button className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-border text-faint transition hover:text-content">
                {Icon.plus({})}
              </button>
            </div>
            <Link href="/dashboard/avatars" className="btn-primary mt-4 block w-full py-2 text-center text-sm">
              {t('dh.avatar.cta')}
            </Link>
          </Panel>

          {/* Essayage virtuel */}
          <Panel title={t('dh.tryon.title')} subtitle={t('dh.tryon.sub')}>
            <div className="grid grid-cols-5 gap-1.5">
              {['Face', '45°', 'Profil', 'Dos', '45°'].map((a, i) => (
                <div key={i} className="overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${IMG.dress}&sig=${i}`} alt={a} className="aspect-[3/5] w-full object-cover" />
                  <p className="bg-surface-2 py-0.5 text-center text-[9px] text-faint">{a}</p>
                </div>
              ))}
            </div>
            <Link href="/dashboard/tryon" className="mt-3 block text-center text-[10px] text-brand-violet hover:underline">
              {t('dh.tryon.cta')}
            </Link>
          </Panel>

          {/* Défilé animé */}
          <Panel title={t('dh.runway.title')} subtitle={t('dh.runway.sub')}>
            <div className="mb-2 flex justify-end">
              <Link href="/dashboard/defile" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition hover:text-content">
                {Icon.play({ width: 14, height: 14 })} {t('dh.runway.launch')}
              </Link>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${IMG.runway}&sig=${i}`} alt="" className="aspect-[3/5] w-full object-cover" />
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button className="grid h-8 w-8 place-items-center rounded-full bg-brand-violet-magenta text-white">
                {Icon.play({ width: 14, height: 14 })}
              </button>
              <div className="h-1.5 flex-1 rounded-full bg-surface-2">
                <div className="h-full w-1/3 rounded-full bg-brand-violet-magenta" />
              </div>
            </div>
            <Link href="/dashboard/defile" className="mt-3 block text-center text-[10px] text-brand-violet hover:underline">
              {t('dh.runway.open')}
            </Link>
          </Panel>

          {/* Réseaux sociaux */}
          <Panel title={t('dh.social.title')} subtitle={t('dh.social.sub')}>
            <button className="btn-primary mb-3 w-full py-2 text-sm">{t('dh.social.cta')}</button>
            <div className="grid grid-cols-5 gap-2">
              {SOCIALS.map((s) => (
                <div key={s.name} className="flex flex-col items-center gap-1">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-xl text-white"
                    style={{ background: s.color }}
                  >
                    {s.short}
                  </span>
                  <span className="text-[9px] text-faint">{s.name}</span>
                </div>
              ))}
            </div>
            <PhaseTag phase="Phase 5" />
          </Panel>
        </aside>
      </div>

      {studio && (
        <AiStudioModal mode={studio} products={products} onClose={() => setStudio(null)} />
      )}
    </>
  );
}

const SOCIALS = [
  { name: 'Instagram', short: 'IG', color: 'linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)' },
  { name: 'TikTok', short: 'TT', color: '#010101' },
  { name: 'YouTube', short: 'YT', color: '#FF0000' },
  { name: 'Pinterest', short: 'P', color: '#E60023' },
  { name: 'X', short: 'X', color: '#111' },
];

function StatCard({
  icon,
  label,
  value,
  trend,
  demo,
}: {
  icon: keyof typeof Icon;
  label: string;
  value: string;
  trend: string;
  demo?: boolean;
}) {
  const t = useT();
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-brand-violet">
          {Icon[icon]({ width: 18, height: 18 })}
        </span>
        <span className="text-xs font-semibold text-emerald-500">▲ {trend}</span>
      </div>
      <p className="mt-3 font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted">
        {label}
        {demo && <span className="ml-1 text-faint">({t('common.demo')})</span>}
      </p>
    </div>
  );
}

function AiToolCard({
  img,
  title,
  desc,
  phase,
  onAction,
  soon,
}: {
  img: string;
  title: string;
  desc: string;
  phase: string;
  onAction?: () => void;
  soon?: boolean;
}) {
  const t = useT();
  return (
    <div className="card group overflow-hidden">
      <div className="relative aspect-[16/10] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt={title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <span className="absolute right-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {phase}
        </span>
      </div>
      <div className="p-3.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 line-clamp-2 text-xs text-muted">{desc}</p>
        {soon ? (
          <button disabled className="btn-ghost mt-3 w-full cursor-not-allowed py-1.5 text-xs opacity-60">
            🔒 {t('common.soon')} ({phase})
          </button>
        ) : (
          <button onClick={onAction} className="btn-primary mt-3 w-full py-1.5 text-xs">
            {Icon.sparkles({ width: 14, height: 14 })} {t('common.generate')}
          </button>
        )}
      </div>
    </div>
  );
}

function ProductMini({ product }: { product: Product }) {
  const t = useT();
  const img = product.images[0] ?? 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=300';
  return (
    <Link href={`/product/${product.id}`} className="card overflow-hidden transition hover:border-border">
      <div className="aspect-square overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt={product.name} className="h-full w-full object-cover" />
      </div>
      <div className="p-2.5">
        <p className="line-clamp-1 text-xs font-medium">{product.name}</p>
        <p className="mt-0.5 text-sm font-bold text-brand-violet">{Number(product.price).toFixed(2)} €</p>
        <p className="mt-1 flex items-center gap-1 text-[10px] text-emerald-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {t('common.inStock')}
        </p>
      </div>
    </Link>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mb-3 mt-0.5 text-xs text-faint">{subtitle}</p>
      {children}
    </section>
  );
}

function PhaseTag({ phase }: { phase: string }) {
  const t = useT();
  return (
    <p className="mt-3 text-center text-[10px] text-faint">{t('dh.availableIn')} {phase}</p>
  );
}

function AddProductInline({ onAdded }: { onAdded: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="btn-primary mx-auto mt-4 block">
        {t('dh.addFirstProduct')}
      </button>
    );
  return (
    <div className="mt-4">
      <ProductForm onAdded={onAdded} />
    </div>
  );
}

function ProductForm({ onAdded }: { onAdded: () => void }) {
  const t = useT();
  const [form, setForm] = useState({ name: '', price: '', category: ProductCategory.FEMME as ProductCategory, image: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          price: Number(form.price),
          category: form.category,
          status: 'ACTIVE',
          images: form.image ? [form.image] : [],
        }),
      });
      setForm({ name: '', price: '', category: ProductCategory.FEMME, image: '' });
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-3 text-left">
      {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-400">{error}</p>}
      <input className="input" placeholder={t('dh.productName')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      <input className="input" type="number" step="0.01" placeholder={t('dh.price')} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
      <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ProductCategory })}>
        {Object.values(ProductCategory).map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <ImageUploadInput label={t('dh.imageOptional')} value={form.image} onChange={(url) => setForm({ ...form, image: url })} />
      <button className="btn-primary w-full" disabled={loading}>{loading ? '…' : t('common.add')}</button>
    </form>
  );
}

function BecomeSeller({ onUpgraded }: { onUpgraded: () => void }) {
  const t = useT();
  const setUser = useAuth((s) => s.setUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const upgrade = async () => {
    setLoading(true);
    setError('');
    try {
      const user = await apiFetch<AuthUser>('/auth/become-seller', { method: 'POST' });
      setUser(user);
      onUpgraded();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-violet-magenta text-white">
        {Icon.shop({ width: 30, height: 30 })}
      </span>
      <h1 className="mt-6 font-display text-4xl font-bold">{t('dh.becomeSeller')}</h1>
      <p className="mt-3 text-muted">{t('dh.becomeSellerDesc')}</p>
      <div className="mt-6 grid grid-cols-3 gap-3 text-left text-sm">
        <div className="card p-3">{t('dh.perk.shop')}</div>
        <div className="card p-3">{t('dh.perk.studio')}</div>
        <div className="card p-3">{t('dh.perk.campaigns')}</div>
      </div>
      {error && <p className="mt-4 rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-400">{error}</p>}
      <button onClick={upgrade} disabled={loading} className="btn-primary mt-8">
        {loading ? '…' : t('dh.becomeSellerCta')}
      </button>
      <p className="mt-3">
        <Link href="/marketplace" className="text-sm text-muted hover:text-content">
          {t('dh.continueAsClient')}
        </Link>
      </p>
    </div>
  );
}

function CreateShopForm({ onCreated }: { onCreated: () => void }) {
  const t = useT();
  const [form, setForm] = useState({ name: '', slug: '', slogan: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/shops', { method: 'POST', body: JSON.stringify(form) });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-display text-4xl font-bold">{t('dh.createShop')}</h1>
      <p className="mt-2 text-muted">{t('dh.createShopDesc')}</p>
      <form onSubmit={submit} className="card mt-8 space-y-4 p-6">
        {error && <p className="rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-400">{error}</p>}
        <div>
          <label className="label">{t('dh.brandName')}</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
                slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
              })
            }
            required
          />
        </div>
        <div>
          <label className="label">{t('dh.slug')}</label>
          <input
            className="input"
            value={form.slug}
            onChange={(e) =>
              setForm({
                ...form,
                slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, ''),
              })
            }
            required
          />
          <p className="mt-1 text-xs text-faint">odalyan.ai/shop/{form.slug || 'ma-marque'}</p>
        </div>
        <div>
          <label className="label">{t('dh.slogan')}</label>
          <input className="input" value={form.slogan} onChange={(e) => setForm({ ...form, slogan: e.target.value })} />
        </div>
        <button className="btn-primary w-full" disabled={loading}>{loading ? '…' : t('dh.createShop')}</button>
      </form>
    </div>
  );
}
