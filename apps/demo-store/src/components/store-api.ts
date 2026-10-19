"use client";

import { useEffect, useState } from "react";

export type Flags = Record<string, boolean>;
export type Product = { id: string; slug: string; name: string; description: string; category: string; priceCents: number; compareAtCents: number | null; image: string; imageAlt: string; sizes: { label: string; stock: number }[]; featured: boolean };
export type CartItem = { productId: string; size: string; quantity: number };
export type Quote = { items: { productId: string; name: string; size: string; quantity: number; unitPriceCents: number; lineTotalCents: number }[]; subtotalCents: number; discountCents: number; taxCents: number; totalCents: number };
export const money = (cents: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(cents / 100);

export async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options.headers } }); }
  catch (error) { if (options.signal?.aborted) throw error; throw new Error("Unable to connect. Check your connection and try again."); }
  let body: { data?: T; error?: { code: string; message: string } };
  try { body = await response.json() as typeof body; }
  catch { throw new Error("The store returned an unexpected response. Please try again."); }
  if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Something went wrong. Please try again.");
  if (typeof body.data === "object" && "flags" in body.data && Array.isArray(body.data.flags)) {
    body.data.flags = Object.fromEntries(body.data.flags.map((flag: string) => [flag, true]));
  }
  return body.data;
}

export function useResource<T>(url: string) {
  const [state, setState] = useState<{ url: string; data: T | null; error: string; loading: boolean }>({ url, data: null, error: "", loading: true });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ url, data: null, error: "", loading: true });
    void request<T>(url, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ url, data, error: "", loading: false });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ url, data: null, error: error instanceof Error ? error.message : "Unable to load the collection.", loading: false });
    });
    return () => controller.abort();
  }, [url, revision]);
  return { data: state.url === url ? state.data : null, error: state.url === url ? state.error : "", loading: state.url !== url || state.loading, retry: () => setRevision(value => value + 1) };
}
