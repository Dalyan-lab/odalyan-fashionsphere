import type { ProductCategory } from '@odalyan/shared';

export interface Variant {
  id: string;
  size: string;
  color: string;
  stock: number;
  priceOverride?: string | null;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  category: ProductCategory;
  price: string;
  currency: string;
  images: string[];
  videos: string[];
  status: string;
  variants?: Variant[];
  shop?: { name: string; slug: string; logoUrl?: string | null };
}

export interface MarketplaceResponse {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Shop {
  id: string;
  name: string;
  slug: string;
  slogan?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  showNameOnBanner?: boolean;
  showSloganOnBanner?: boolean;
  logoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  bannerPosition?: string; // "top"|"center"|"bottom" (héritage) ou "0%"…"100%"
  products?: Product[];
  subscription?: { plan: string } | null;
  _count?: { products: number; orders: number };
  revenue?: number;
}
