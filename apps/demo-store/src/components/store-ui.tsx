"use client";

import { useEffect } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { Flags, Product } from "./store-api";

export function ResourceState({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  return <div className="resource-state" role={error ? "alert" : "status"}>{loading ? <><span className="loading-line" /><p>Loading the collection...</p></> : <><h2>We couldn&apos;t load this.</h2><p>{error}</p><button className="secondary-button" onClick={retry}><RotateCcw size={16} />Try again</button></>}</div>;
}

export function ProductImage({ product, flags, priority = false }: { product: Product; flags: Flags; priority?: boolean }) {
  // Native images intentionally preserve broken-image and missing-alt bug-bank behavior.
  const image = <img src={product.image} alt={product.imageAlt} width={900} height={1125} loading={priority ? "eager" : "lazy"} />;
  // eslint-disable-next-line jsx-a11y/alt-text -- intentional missingAlt demo fault only; baseline above has meaningful alt.
  const missingAltImage = <img src={product.image} width={900} height={1125} loading={priority ? "eager" : "lazy"} />;
  return <picture>{flags.mobileImageBroken && <source media="(max-width: 600px)" srcSet="/products/seeded-mobile-missing.jpg" />}{flags.missingAlt ? missingAltImage : image}</picture>;
}

export function Quantity({ value, max = 10, onChange, label = "Quantity", disabled = false }: { value: number; max?: number; onChange: (value: number) => void; label?: string; disabled?: boolean }) {
  return <div className="quantity-control" role="group" aria-label={label}><button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={disabled || value <= 1} onClick={() => onChange(value - 1)}><Minus size={16} /></button><output aria-label={label}>{value}</output><button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}><Plus size={16} /></button></div>;
}

export function PageMetadata({ title, path, flags, product }: { title: string; path: string; flags: Flags; product?: Product }) {
  useEffect(() => {
    document.title = `${flags.wrongProductTitle && product ? "Untitled product" : title} | Threadline`;
    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = `${window.location.origin}${flags.wrongCanonical ? "/prod/incorrect-product" : path}`;
    document.head.appendChild(canonical);
    return () => canonical.remove();
  }, [title, path, flags.wrongCanonical, flags.wrongProductTitle, product]);
  if (!product || flags.missingJsonLd) return null;
  const schema = { "@context": "https://schema.org", "@type": "Product", name: product.name, description: product.description, image: product.image, sku: product.id, offers: { "@type": "Offer", priceCurrency: "INR", price: (product.priceCents / 100).toFixed(2), availability: product.sizes.some(size => size.stock > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: path } };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026") }} />;
}
