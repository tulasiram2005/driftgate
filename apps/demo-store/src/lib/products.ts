import type { BugFlag } from "./flags";

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  compareAtCents: number | null;
  image: string;
  imageAlt: string;
  sizes: { label: string; stock: number }[];
  featured: boolean;
}

export const productSeeds: Product[] = [
  {
    id: "shirt",
    slug: "everyday-shirt",
    name: "Everyday T-Shirt",
    description:
      "Demo white cotton T-shirt. Illustrative photo; no actual sales or brand affiliation.",
    category: "Tops",
    priceCents: 3999,
    compareAtCents: 4999,
    image: "/products/shirt.jpg",
    imageAlt: "White cotton T-shirt",
    sizes: [
      { label: "S", stock: 12 },
      { label: "M", stock: 8 },
      { label: "L", stock: 0 },
    ],
    featured: true,
  },
  {
    id: "trousers",
    slug: "tailored-trousers",
    name: "Cropped Denim Trousers",
    description: "Demo dark cropped denim trousers. Illustrative photo.",
    category: "Bottoms",
    priceCents: 5999,
    compareAtCents: null,
    image: "/products/trousers.jpg",
    imageAlt: "Dark cropped denim trousers",
    sizes: [
      { label: "S", stock: 6 },
      { label: "M", stock: 9 },
      { label: "L", stock: 4 },
    ],
    featured: false,
  },
  {
    id: "dress",
    slug: "weekend-dress",
    name: "Occasion Dress",
    description: "Demo red long occasion dress. Illustrative photo.",
    category: "Dresses",
    priceCents: 7999,
    compareAtCents: 9999,
    image: "/products/dress.jpg",
    imageAlt: "Red long occasion dress",
    sizes: [
      { label: "S", stock: 5 },
      { label: "M", stock: 7 },
      { label: "L", stock: 3 },
    ],
    featured: true,
  },
  {
    id: "jacket",
    slug: "utility-jacket",
    name: "Biker Jacket",
    description: "Demo black biker jacket. Illustrative photo.",
    category: "Outerwear",
    priceCents: 8999,
    compareAtCents: null,
    image: "/products/jacket.jpg",
    imageAlt: "Black biker jacket",
    sizes: [
      { label: "S", stock: 4 },
      { label: "M", stock: 6 },
      { label: "L", stock: 2 },
    ],
    featured: true,
  },
  {
    id: "bag",
    slug: "city-tote",
    name: "City Backpack",
    description: "Demo navy backpack. Illustrative photo.",
    category: "Accessories",
    priceCents: 2999,
    compareAtCents: null,
    image: "/products/bag.jpg",
    imageAlt: "Navy backpack",
    sizes: [{ label: "One Size", stock: 15 }],
    featured: false,
  },
  {
    id: "sneakers",
    slug: "daily-sneakers",
    name: "Daily Running Shoes",
    description: "Demo red running shoe. Illustrative photo; no brand affiliation.",
    category: "Footwear",
    priceCents: 6999,
    compareAtCents: null,
    image: "/products/sneakers.jpg",
    imageAlt: "Red running shoe",
    sizes: [
      { label: "38", stock: 5 },
      { label: "40", stock: 7 },
      { label: "42", stock: 3 },
    ],
    featured: false,
  },
];

export function presentProducts(products: Product[], flags: readonly BugFlag[]): Product[] {
  return products
    .filter((p) => !(flags.includes("missingProduct") && p.id === "bag"))
    .map((p) => ({
      ...p,
      name: flags.includes("wrongProductTitle") && p.id === "dress" ? "Utility Jacket" : p.name,
      imageAlt: flags.includes("missingAlt") && p.id === "shirt" ? "" : p.imageAlt,
      image:
        flags.includes("brokenImage") && p.id === "jacket"
          ? "/products/missing-jacket.jpg"
          : p.image,
      priceCents:
        flags.includes("priceMismatch") && p.id === "shirt" ? p.priceCents + 500 : p.priceCents,
      sizes: p.sizes.map((size) => ({
        ...size,
        stock:
          flags.includes("stockMismatch") && p.id === "shirt" && size.label === "L"
            ? 5
            : size.stock,
      })),
    }));
}
