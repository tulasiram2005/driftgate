"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ShoppingBag } from "lucide-react";
import { money, useResource } from "./store-api";
import type { Flags, Product } from "./store-api";
import { useStore } from "./store-context";
import { PageMetadata, ProductImage, Quantity, ResourceState } from "./store-ui";

export function ProductDetail({ slug }: { slug: string }) {
  const store = useStore();
  const resource = useResource<{ product: Product; flags: Flags }>(
    `/api/${store.environment}/products/${encodeURIComponent(slug)}`,
  );
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  if (!resource.data)
    return (
      <div className="page-shell">
        <Link className="back-link" href={`/${store.environment}`}>
          <ArrowLeft size={16} />
          Collection
        </Link>
        <ResourceState {...resource} />
      </div>
    );
  const { product, flags } = resource.data;
  const selected = product.sizes.find((item) => item.label === size);
  const existing =
    store.items.find((item) => item.productId === product.id && item.size === size)?.quantity ?? 0;
  const available = Math.max(0, Math.min(10, selected?.stock ?? 0) - existing);
  function add() {
    if (!size || available < quantity) {
      setNotice("Choose an available size and quantity.");
      return;
    }
    const found = store.items.some((item) => item.productId === product.id && item.size === size);
    store.update(
      found
        ? store.items.map((item) =>
            item.productId === product.id && item.size === size
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          )
        : [...store.items, { productId: product.id, size, quantity }],
    );
    setNotice(`${quantity} ${product.name} added to your cart.`);
  }
  return (
    <div className="page-shell">
      <PageMetadata
        title={product.name}
        path={`/${store.environment}/products/${slug}`}
        flags={flags}
        product={product}
      />
      <Link className="back-link" href={`/${store.environment}`}>
        <ArrowLeft size={16} />
        Collection
      </Link>
      <div className="product-detail">
        <div className="detail-photo">
          <ProductImage product={product} flags={flags} priority />
        </div>
        <section className="detail-info">
          <p className="eyebrow">{product.category} / Collection 01</p>
          <h1>{product.name}</h1>
          <div className="detail-price">
            <span>{money(product.priceCents)}</span>
            {product.compareAtCents && <del>{money(product.compareAtCents)}</del>}
            {flags.staleBadge && <span className="sale-text">50% off</span>}
          </div>
          <p className="description">{product.description}</p>
          <fieldset className="size-picker">
            <legend>
              Size <span>{size || "Select a size"}</span>
            </legend>
            <div>
              {product.sizes.map((option) => (
                <button
                  type="button"
                  key={option.label}
                  disabled={option.stock <= 0}
                  aria-pressed={size === option.label}
                  onClick={() => {
                    setSize(option.label);
                    setQuantity(1);
                    setNotice("");
                  }}
                >
                  {option.label}
                  {option.stock <= 0 && <span className="sr-only">, out of stock</span>}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="stock-label">
            {selected
              ? available > 0
                ? `${available} available`
                : "No more available for your bag"
              : "Select a size to see availability"}
          </p>
          <div className="purchase-row">
            <Quantity value={quantity} max={Math.max(1, available)} onChange={setQuantity} />
            <button
              className="primary-button"
              onClick={add}
              disabled={!store.ready || !size || quantity > available}
            >
              <ShoppingBag size={18} />
              Add to cart
            </button>
          </div>
          <p className="add-notice" role="status">
            {notice && (
              <>
                <Check size={16} />
                {notice}
              </>
            )}
          </p>
          {notice.includes("added") && (
            <Link className="text-link" href={`/${store.environment}/cart`}>
              View cart <ArrowRight size={16} />
            </Link>
          )}
          <div className="product-note">
            <span className="eyebrow">A fictional collection</span>
            <p>Demo only. Orders are simulated. No payment or personal details are collected.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
