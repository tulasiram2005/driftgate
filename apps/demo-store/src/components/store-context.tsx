"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { ArrowUpRight, Moon, ShoppingBag, Sun } from "lucide-react";
import type { CartItem } from "./store-api";

type Store = { environment: string; items: CartItem[]; coupons: string[]; ready: boolean; update: (items: CartItem[]) => void; setCoupons: (coupons: string[]) => void; clear: () => void };
const Context = createContext<Store | null>(null);
export function useStore() { const value = useContext(Context); if (!value) throw new Error("StoreProvider missing"); return value; }

export function StoreProvider({ environment, children }: { environment: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [items, setItems] = useState<CartItem[]>([]);
  const [coupons, setCoupons] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [light, setLight] = useState(false);
  const [storageError, setStorageError] = useState("");
  const storageKey = `threadline:${environment}:cart`;
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (saved && typeof saved === "object" && "items" in saved && Array.isArray(saved.items)) {
        setItems(saved.items.filter((item: unknown): item is CartItem => Boolean(item && typeof item === "object" && "productId" in item && typeof item.productId === "string" && "size" in item && typeof item.size === "string" && "quantity" in item && typeof item.quantity === "number" && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99)));
        if ("coupons" in saved && Array.isArray(saved.coupons)) setCoupons(saved.coupons.filter((coupon: unknown): coupon is string => typeof coupon === "string"));
      }
    } catch { setStorageError("Cart storage is unavailable. Your bag will last for this visit only."); }
    setReady(true);
  }, [storageKey]);
  function persist(nextItems: CartItem[], nextCoupons: string[]) {
    try { localStorage.setItem(storageKey, JSON.stringify({ items: nextItems, coupons: nextCoupons })); } catch { setStorageError("Cart storage is unavailable. Your bag will last for this visit only."); }
  }
  function update(next: CartItem[]) { setItems(next); persist(next, coupons); }
  function changeCoupons(next: string[]) { setCoupons(next); persist(items, next); }
  function clear() { setItems([]); setCoupons([]); persist([], []); }
  function toggleTheme() { const next = !light; setLight(next); document.documentElement.dataset.theme = next ? "light" : "dark"; }
  return <Context.Provider value={{ environment, items, coupons, ready, update, setCoupons: changeCoupons, clear }}>
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="demo-bar"><span><span className="signal-dot" /> DEMO STOREFRONT</span><span>No real transactions</span></div>
    <header className="site-header"><Link className="wordmark" href={`/${environment}`} aria-label="Threadline home">Threadline<span className="wordmark-dot">.</span></Link><nav className="shop-nav" aria-label="Store"><Link href={`/${environment}`} aria-current={pathname === `/${environment}` ? "page" : undefined}>Collection</Link><Link href={`/${environment}/cart`} className="bag-link" aria-label={`Cart, ${items.reduce((sum, item) => sum + item.quantity, 0)} items`}><ShoppingBag size={18} aria-hidden="true" /><span>Cart</span><span className="cart-count">{items.reduce((sum, item) => sum + item.quantity, 0)}</span></Link><button className="icon-button" onClick={toggleTheme} aria-label={light ? "Use dark theme" : "Use light theme"} title={light ? "Use dark theme" : "Use light theme"}>{light ? <Moon size={18} /> : <Sun size={18} />}</button></nav></header>
    <div className="environment-bar"><span className="eyebrow">Demo environment</span><nav aria-label="Demo environment">{["staging", "uat", "preprod", "prod"].map(env => <Link key={env} href={`/${env}${pathname.replace(/^\/[^/]+/, "")}`} aria-current={environment === env ? "page" : undefined}>{env}</Link>)}</nav></div>
    {storageError && <p role="status" className="storage-notice">{storageError}</p>}
    <main id="main" tabIndex={-1}>{children}</main>
    <footer className="site-footer"><Link className="footer-brand" href={`/${environment}`}>Threadline.</Link><p>Fictional pieces. Real attention to detail.</p><span className="eyebrow">Demo collection / 2026</span><Link href={`/${environment}`}>Back to collection <ArrowUpRight size={16} aria-hidden="true" /></Link></footer>
  </Context.Provider>;
}
