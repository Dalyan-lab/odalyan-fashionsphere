'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { Shop } from '@/lib/types';
import { Sidebar } from '@/components/dashboard/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [shopName, setShopName] = useState<string | undefined>(undefined);

  useEffect(() => {
    apiFetch<Shop | null>('/shops/me')
      .then((s) => setShopName(s?.name))
      .catch(() => undefined);
  }, []);

  return (
    <div className="min-h-screen bg-bg lg:flex">
      <Sidebar shopName={shopName} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
