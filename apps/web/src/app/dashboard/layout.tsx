'use client';

import { useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import type { Shop } from '@/lib/types';
import { useShop } from '@/lib/store';
import { Sidebar } from '@/components/dashboard/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const shop = useShop((s) => s.shop);
  const setShop = useShop((s) => s.setShop);

  useEffect(() => {
    apiFetch<Shop | null>('/shops/me')
      .then((s) => setShop(s ?? null))
      .catch(() => undefined);
  }, [setShop]);

  return (
    <div className="min-h-screen bg-bg lg:flex">
      <Sidebar shopName={shop?.name} shopLogo={shop?.logoUrl ?? undefined} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
