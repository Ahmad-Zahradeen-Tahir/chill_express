/**
 * OFFICIAL CHILL. EXPRESS MENU — exact products and prices supplied by the business.
 * Do not add items or change prices here without the business's instruction.
 * Prices are in naira; the seed converts to kobo.
 */

export type SeedOption = { name: string; delta: number };
export type SeedGroup = { name: string; required: boolean; min: number; max: number; options: SeedOption[] };
export type SeedProduct = {
  name: string;
  slug: string;
  price: number;
  description: string | null;
  image: string;
  /** true = representative/stock photo or placeholder, not this exact item */
  illustrative: boolean;
  featured?: boolean;
  groups?: SeedGroup[];
};
export type SeedCategory = { name: string; slug: string; description: string | null; products: SeedProduct[] };

const P = "/images/placeholders";
const B = "/images/brand";

export const MENU: SeedCategory[] = [
  {
    name: "Shawarma",
    slug: "shawarma",
    description: "Beef or chicken.",
    products: [
      {
        name: "Shawarma",
        slug: "shawarma",
        price: 3000, // Regular Size
        description: "Beef or chicken. Choose your size.",
        image: `${P}/shawarma.svg`,
        illustrative: true,
        featured: true,
        groups: [
          {
            name: "Protein",
            required: true,
            min: 1,
            max: 1,
            options: [
              { name: "Beef", delta: 0 },
              { name: "Chicken", delta: 0 },
            ],
          },
          {
            name: "Size",
            required: true,
            min: 1,
            max: 1,
            options: [
              { name: "Regular Size", delta: 0 }, // ₦3,000
              { name: "Queen Size", delta: 1500 }, // ₦4,500
              { name: "King Size", delta: 3000 }, // ₦6,000
              { name: "Chill Special", delta: 5500 }, // ₦8,500
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Burgers",
    slug: "burgers",
    description: null,
    products: [
      { name: "Regular Burger", slug: "regular-burger", price: 3000, description: null, image: `${B}/burger.jpg`, illustrative: false, featured: true },
      { name: "Cheese Burger", slug: "cheese-burger", price: 4000, description: null, image: `${B}/burger.jpg`, illustrative: true },
      { name: "Double Decker", slug: "double-decker", price: 6000, description: null, image: `${P}/burger.svg`, illustrative: true },
    ],
  },
  {
    name: "Loaded Fries",
    slug: "loaded-fries",
    description: "Add cheese to any box.",
    products: [
      {
        name: "Regular Box",
        slug: "loaded-fries-regular-box",
        price: 3000,
        description: "Loaded fries, regular box.",
        image: `${B}/loaded-fries.jpg`,
        illustrative: false,
        groups: [{ name: "Extras", required: false, min: 0, max: 1, options: [{ name: "With Cheese", delta: 500 }] }], // ₦3,500
      },
      {
        name: "Mega Box",
        slug: "loaded-fries-mega-box",
        price: 4000,
        description: "Loaded fries, mega box.",
        image: `${B}/loaded-fries-slush.jpg`,
        illustrative: true,
        featured: true,
        groups: [{ name: "Extras", required: false, min: 0, max: 1, options: [{ name: "With Cheese", delta: 500 }] }], // ₦4,500
      },
      {
        name: "Super Loaded Fries",
        slug: "super-loaded-fries",
        price: 6000,
        description: "Our biggest loaded fries.",
        image: `${P}/fries.svg`,
        illustrative: true,
        groups: [{ name: "Extras", required: false, min: 0, max: 1, options: [{ name: "With Cheese", delta: 500 }] }], // ₦6,500
      },
    ],
  },
  {
    name: "Beverages",
    slug: "beverages",
    description: null,
    products: [
      { name: "Premium Flavors", slug: "premium-flavors", price: 3000, description: null, image: `${P}/drink.svg`, illustrative: true },
      { name: "Soda", slug: "soda", price: 1500, description: null, image: `${P}/drink.svg`, illustrative: true },
      { name: "Ice Cream", slug: "ice-cream", price: 2500, description: null, image: `${P}/ice-cream.svg`, illustrative: true },
      { name: "Frosty Chillerz", slug: "frosty-chillerz", price: 3000, description: null, image: `${B}/store-slush.jpg`, illustrative: true, featured: true },
    ],
  },
];

export const BRANCHES = [
  { slug: "gombole-road", code: "GR", name: "Gombole Road" },
  { slug: "lagos-street", code: "LS", name: "Lagos Street" },
];

export const BUSINESS = {
  phone: "+234 7052764227",
  phoneHref: "tel:+2347052764227",
  instagram: "@chill._express.ng",
  instagramUrl: "https://www.instagram.com/chill._express.ng/",
  city: "Maiduguri, Borno State",
};
