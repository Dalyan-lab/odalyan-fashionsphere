'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResponse, AuthUser } from '@odalyan/shared';
import { setToken } from './api';

interface AuthState {
  user: AuthUser | null;
  refreshToken: string | null;
  setAuth: (res: AuthResponse) => void;
  setUser: (user: AuthUser) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      refreshToken: null,
      setAuth: (res) => {
        setToken(res.tokens.accessToken);
        set({ user: res.user, refreshToken: res.tokens.refreshToken });
      },
      setUser: (user) => set({ user }),
      clear: () => {
        setToken(null);
        set({ user: null, refreshToken: null });
      },
    }),
    { name: 'odalyan-auth' },
  ),
);

interface SidebarState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  close: () => void;
}

/** État du menu latéral (drawer mobile). Non persisté. */
export const useSidebar = create<SidebarState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  close: () => set({ open: false }),
}));

interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  price: number;
  image?: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (productId: string, variantId?: string) => void;
  clear: () => void;
  total: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === item.productId && i.variantId === item.variantId,
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i === existing ? { ...i, quantity: i.quantity + item.quantity } : i,
              ),
            };
          }
          return { items: [...state.items, item] };
        }),
      remove: (productId, variantId) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.productId === productId && i.variantId === variantId),
          ),
        })),
      clear: () => set({ items: [] }),
      total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    { name: 'odalyan-cart' },
  ),
);
