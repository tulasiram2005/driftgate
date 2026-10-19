"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ShieldCheck, ShoppingBag, Trash2, X } from "lucide-react";
import { money, request, useResource } from "./store-api";
import type { Flags, Product, Quote } from "./store-api";
import { useStore } from "./store-context";
import { PageMetadata, Quantity } from "./store-ui";
import { checkoutKey } from "../lib/checkout-key";

type Order = { orderId: string; totalCents: number; status: "SIMULATED" };
export function Cart() {
  const store = useStore();
  const { environment, items, coupons, ready } = store;
  const catalog = useResource<{ products: Product[]; flags: Flags }>(
    `/api/${environment}/products`,
  );
  const [quote, setQuote] = useState<{ body: string; data: Quote } | null>(null);
  const [quoteError, setQuoteError] = useState<{ key: string; message: string } | null>(null);
  const [error, setError] = useState("");
  const [coupon, setCoupon] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const lock = useRef(false);
  const checkoutController = useRef<AbortController | null>(null);
  const attempt = useRef<{ body: string; key: string } | null>(null);
  const body = JSON.stringify({ items, coupons });
  const quoteKey = `${environment}:${revision}:${body}`;
  const currentQuote =
    items.length === 0
      ? { items: [], subtotalCents: 0, discountCents: 0, taxCents: 0, totalCents: 0 }
      : quote?.body === quoteKey
        ? quote.data
        : null;
  const visibleError = error || (quoteError?.key === quoteKey ? quoteError.message : "");
  useEffect(() => () => checkoutController.current?.abort(), []);
  useEffect(() => {
    if (!ready || order) return;
    const controller = new AbortController();
    if (items.length === 0) {
      return () => controller.abort();
    }
    void request<Quote>(`/api/${environment}/quote`, {
      method: "POST",
      body,
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setQuote({ body: quoteKey, data });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setQuoteError({
            key: quoteKey,
            message: reason instanceof Error ? reason.message : "Unable to update your bag.",
          });
      });
    return () => controller.abort();
  }, [body, environment, ready, quoteKey, order, items.length]);
  async function checkout() {
    if (lock.current || !currentQuote || items.length === 0 || order) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    checkoutController.current = controller;
    try {
      if (attempt.current?.body !== body) {
        let previous: { body?: unknown; key?: unknown } | null = null;
        try {
          const saved = sessionStorage.getItem(`threadline:${environment}:checkout`);
          const parsed: unknown = saved ? JSON.parse(saved) : null;
          if (parsed && typeof parsed === "object") previous = parsed;
        } catch {
          /* In-memory key still protects retries when browser storage is unavailable. */
        }
        attempt.current =
          previous?.body === body && typeof previous.key === "string"
            ? { body, key: previous.key }
            : { body, key: checkoutKey() };
        try {
          sessionStorage.setItem(
            `threadline:${environment}:checkout`,
            JSON.stringify(attempt.current),
          );
        } catch {
          /* Keep the in-memory attempt key. */
        }
      }
      const result = await request<Order>(`/api/${environment}/checkout`, {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({ items, coupons, idempotencyKey: attempt.current.key }),
      });
      if (controller.signal.aborted) return;
      setOrder(result);
      store.clear();
      try {
        sessionStorage.removeItem(`threadline:${environment}:checkout`);
      } catch {
        /* The receipt remains visible if storage becomes unavailable. */
      }
    } catch (reason: unknown) {
      if (!controller.signal.aborted)
        setError(reason instanceof Error ? reason.message : "Checkout failed. Please try again.");
    } finally {
      if (!controller.signal.aborted) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  const flags = catalog.data?.flags ?? {};
  if (order)
    return (
      <div className="page-shell">
        <PageMetadata title="Demo order complete" path={`/${environment}/cart`} flags={flags} />
        <section className="order-success">
          <span className="success-icon">
            <Check size={32} />
          </span>
          <p className="eyebrow">Simulated order / {environment}</p>
          <h1>A good choice.</h1>
          <p>Your demo order is complete. No payment was taken and nothing will be shipped.</p>
          <dl>
            <div>
              <dt>Order reference</dt>
              <dd>{order.orderId}</dd>
            </div>
            <div>
              <dt>Demo total</dt>
              <dd>{money(order.totalCents)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{order.status}</dd>
            </div>
          </dl>
          <Link className="primary-button" href={`/${environment}`}>
            Continue shopping <ArrowRight size={18} />
          </Link>
        </section>
      </div>
    );
  return (
    <div className="page-shell">
      <PageMetadata title="Your cart" path={`/${environment}/cart`} flags={flags} />
      <Link className="back-link" href={`/${environment}`}>
        <ArrowLeft size={16} />
        Continue shopping
      </Link>
      <div className="cart-heading">
        <h1>
          Your bag<span>.</span>
        </h1>
        <span className="eyebrow">
          {items.reduce((sum, item) => sum + item.quantity, 0)} pieces / Demo
        </span>
      </div>
      {!ready ? (
        <p role="status">Loading your bag...</p>
      ) : (
        <div className="cart-layout">
          <section aria-label="Cart items">
            {items.length === 0 ? (
              <div className="empty-bag">
                <ShoppingBag size={40} strokeWidth={1} />
                <h2>A little room for something good.</h2>
                <p>Your cart is empty.</p>
                <Link className="secondary-button" href={`/${environment}`}>
                  Explore the collection <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              items.map((item) => {
                const product = catalog.data?.products.find(
                  (product) => product.id === item.productId,
                );
                const line = currentQuote?.items.find(
                  (line) => line.productId === item.productId && line.size === item.size,
                );
                const name = product?.name ?? line?.name ?? item.productId;
                return (
                  <article className="cart-item" key={`${item.productId}:${item.size}`}>
                    <div className="cart-thumbnail">
                      {product && (
                        <img src={product.image} alt={product.imageAlt} width={120} height={150} />
                      )}
                    </div>
                    <div className="cart-item-info">
                      <p className="eyebrow">{product?.category ?? "Collection"}</p>
                      <h2>
                        {product ? (
                          <Link href={`/${environment}/products/${product.slug}`}>{name}</Link>
                        ) : (
                          name
                        )}
                      </h2>
                      <p>Size: {item.size}</p>
                      <Quantity
                        value={item.quantity}
                        disabled={busy}
                        label={`Quantity for ${name} size ${item.size}`}
                        onChange={(quantity) =>
                          store.update(
                            items.map((entry) =>
                              entry.productId === item.productId && entry.size === item.size
                                ? { ...entry, quantity }
                                : entry,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="cart-item-actions">
                      <span>
                        {line
                          ? money(line.lineTotalCents)
                          : product
                            ? money(product.priceCents * item.quantity)
                            : "Pending"}
                      </span>
                      <button
                        disabled={busy}
                        className="icon-button"
                        title={`Remove ${name}`}
                        aria-label={`Remove ${name} size ${item.size}`}
                        onClick={() =>
                          store.update(
                            items.filter(
                              (entry) =>
                                entry.productId !== item.productId || entry.size !== item.size,
                            ),
                          )
                        }
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </section>
          <aside className="order-summary" aria-label="Order summary">
            <h2>Order summary</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const code = coupon.trim().toUpperCase();
                if (code && !coupons.includes(code)) store.setCoupons([...coupons, code]);
                setCoupon("");
              }}
            >
              <label htmlFor="coupon">Coupon code</label>
              <div className="coupon-input">
                <input
                  id="coupon"
                  value={coupon}
                  onChange={(event) => setCoupon(event.target.value)}
                  placeholder="Enter code"
                  disabled={busy}
                />
                <button
                  className="secondary-button"
                  disabled={busy || !coupon.trim()}
                  type="submit"
                >
                  Apply
                </button>
              </div>
            </form>
            {coupons.length > 0 && (
              <ul className="coupon-list">
                {coupons.map((code) => (
                  <li key={code}>
                    {code}
                    <button
                      className="icon-button"
                      disabled={busy}
                      aria-label={`Remove coupon ${code}`}
                      onClick={() => store.setCoupons(coupons.filter((value) => value !== code))}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <dl className="totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{currentQuote ? money(currentQuote.subtotalCents) : "..."}</dd>
              </div>
              <div>
                <dt>Discount</dt>
                <dd>{currentQuote ? `-${money(currentQuote.discountCents)}` : "..."}</dd>
              </div>
              <div>
                <dt>Tax</dt>
                <dd>{currentQuote ? money(currentQuote.taxCents) : "..."}</dd>
              </div>
              <div className="grand-total">
                <dt>
                  Total <span>INR</span>
                </dt>
                <dd>{currentQuote ? money(currentQuote.totalCents) : "..."}</dd>
              </div>
            </dl>
            {visibleError && (
              <div className="error-message" role="alert">
                <p>{visibleError}</p>
                <button
                  className="text-link"
                  onClick={() => setRevision((value) => value + 1)}
                  disabled={busy}
                >
                  Try again
                </button>
              </div>
            )}
            {!currentQuote && !visibleError && <p role="status">Updating total...</p>}
            <button
              className={`primary-button checkout-button${flags.webkitCheckoutHidden ? " seeded-webkit-hidden" : ""}`}
              onClick={() => void checkout()}
              disabled={busy || !currentQuote || items.length === 0}
            >
              {busy ? "Placing demo order..." : "Place demo order"}
              <ArrowRight size={18} />
            </button>
            <p className="checkout-note">
              <ShieldCheck size={18} aria-hidden="true" />
              Sandbox checkout. No payment or personal details required.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
