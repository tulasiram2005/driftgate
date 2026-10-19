"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Search, X } from "lucide-react";
import { money, useResource } from "./store-api";
import type { Flags, Product } from "./store-api";
import { useStore } from "./store-context";
import { PageMetadata, ProductImage, ResourceState } from "./store-ui";

export function Catalogue() {
  const { environment } = useStore();
  const resource = useResource<{ products: Product[]; flags: Flags }>(`/api/${environment}/products`);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All pieces");
  const products = resource.data?.products ?? [];
  const flags = resource.data?.flags ?? {};
  const categories = ["All pieces", ...new Set(products.map(product => product.category))];
  const visible = products.filter(product => (category === "All pieces" || product.category === category) && `${product.name} ${product.category}`.toLowerCase().includes(search.toLowerCase().trim()));
  return <div className="page-shell">
    <PageMetadata title="The collection" path={`/${environment}`} flags={flags} />
    <section className="collection-heading"><div><p className="eyebrow">Threadline / Collection 01</p><h1>The everyday edit<span>.</span></h1></div><p>Considered shapes.<br />Everyday essentials.</p></section>
    <div className="collection-tools"><div className="search-field"><Search size={18} aria-hidden="true" /><label className="sr-only" htmlFor="product-search">Search products</label><input id="product-search" type="search" placeholder="Search products" value={search} onChange={event => setSearch(event.target.value)} /></div><div className="category-field"><label htmlFor="category">Category</label><select id="category" value={category} onChange={event => setCategory(event.target.value)}>{categories.map(value => <option key={value}>{value}</option>)}</select></div><p className="result-count" aria-live="polite">{visible.length} pieces</p></div>
    {resource.loading || resource.error ? <ResourceState {...resource} /> : visible.length === 0 ? <section className="resource-state"><h2>No pieces found</h2><p>Try another name or category.</p><button className="secondary-button" onClick={() => { setSearch(""); setCategory("All pieces"); }}><X size={16} />Clear filters</button></section> : <div className="product-grid">{visible.map((product, index) => <article className="product-card" key={product.id}><Link href={`/${environment}/products/${flags.brokenLink && product.id === "sneakers" ? "unavailable-piece" : product.slug}`} className="product-photo" aria-label={`View ${product.name}`}><ProductImage product={product} flags={flags} priority={index < 3} />{(product.compareAtCents || (flags.staleBadge && product.featured)) && <span className="product-badge">{flags.staleBadge ? "50% off" : `${Math.round((1 - product.priceCents / (product.compareAtCents ?? product.priceCents)) * 100)}% off`}</span>}<span className="photo-arrow"><ArrowUpRight size={20} /></span></Link><div className="product-caption"><div><p className="eyebrow">{product.category}</p><h2><Link href={`/${environment}/products/${product.slug}`}>{product.name}</Link></h2></div><div className="product-price"><span>{money(product.priceCents)}</span>{product.compareAtCents && <del>{money(product.compareAtCents)}</del>}</div></div></article>)}</div>}
    <div className="collection-end"><span className="eyebrow">Made for the everyday</span><span>01 / Threadline demo collection</span></div>
  </div>;
}
