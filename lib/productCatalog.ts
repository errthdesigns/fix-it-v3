/**
 * FIX IT - Currys Product Catalog
 * Fallback product recommendations by category
 */

import { ProductCategory } from './types';

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    id: 'tvs',
    name: 'TVs & Displays',
    keywords: [
      'tv',
      'television',
      'display',
      'screen',
      'monitor',
      'smart tv',
      'led tv',
      'oled',
      '4k tv',
    ],
    products: [
      {
        id: 'tv-samsung-55',
        name: 'Samsung 55" Crystal UHD 4K Smart TV',
        price: 499,
        specs: [
          '4K Ultra HD resolution (3840 x 2160)',
          '3 x HDMI ports',
          'Smart TV with built-in apps',
          'HDR support',
        ],
        currysUrl: 'https://www.currys.co.uk/products/samsung-ue55cu7100kxxu-55-smart-4k-ultra-hd-hdr-led-tv-10250717.html',
        colors: ['Titan Gray'],
        inStock: true,
        rating: 4.5,
        reviewCount: 342,
      },
      {
        id: 'tv-lg-43',
        name: 'LG 43" 4K Ultra HD Smart LED TV',
        price: 329,
        specs: [
          '4K Ultra HD (3840 x 2160)',
          'Active HDR for enhanced contrast',
          '4 x HDMI ports',
          'webOS smart platform',
        ],
        currysUrl: 'https://www.currys.co.uk/products/lg-43ur73006la-43-smart-4k-ultra-hd-hdr-led-tv-with-google-assistant-and-amazon-alexa-10257166.html',
        colors: ['Black'],
        inStock: true,
        rating: 4.3,
        reviewCount: 189,
      },
      {
        id: 'tv-sony-65',
        name: 'Sony 65" BRAVIA XR OLED 4K Smart TV',
        price: 1699,
        specs: [
          'OLED 4K HDR display',
          'Cognitive Processor XR',
          'Google TV with voice control',
          'Perfect for PS5 gaming',
        ],
        currysUrl: 'https://www.currys.co.uk/products/sony-bravia-xr-65a80l-65-smart-4k-ultra-hd-hdr-oled-tv-with-google-tv-and-assistant-10256513.html',
        colors: ['Black'],
        inStock: true,
        rating: 4.8,
        reviewCount: 91,
      },
    ],
  },
  {
    id: 'laptops',
    name: 'Laptops & Computers',
    keywords: [
      'laptop',
      'computer',
      'pc',
      'notebook',
      'macbook',
      'chromebook',
      'ultrabook',
    ],
    products: [
      {
        id: 'laptop-hp-15',
        name: 'HP 15.6" Laptop - Intel Core i5, 8GB RAM, 256GB SSD',
        price: 449,
        specs: [
          'Intel Core i5-1235U processor',
          '8GB RAM',
          '256GB SSD storage',
          'Full HD display',
        ],
        currysUrl: 'https://www.currys.co.uk/products/hp-15sfw5004na-15.6-laptop-intel-core-i5-256-gb-ssd-silver-10257445.html',
        colors: ['Silver', 'Natural Silver'],
        inStock: true,
        rating: 4.2,
        reviewCount: 267,
      },
      {
        id: 'laptop-dell-inspiron',
        name: 'Dell Inspiron 14" 2-in-1 Laptop - Intel Core i7',
        price: 699,
        specs: [
          'Intel Core i7 processor',
          '16GB RAM',
          '512GB SSD',
          'Touchscreen with stylus support',
        ],
        currysUrl: 'https://www.currys.co.uk/products/dell-inspiron-14-5430-14-2-in-1-laptop-intel-core-i7-512-gb-ssd-platinum-silver-10262258.html',
        colors: ['Platinum Silver'],
        inStock: true,
        rating: 4.6,
        reviewCount: 143,
      },
      {
        id: 'laptop-macbook-air',
        name: 'Apple MacBook Air 13.6" M2 Chip - 256GB',
        price: 1099,
        specs: [
          'Apple M2 chip',
          '8GB unified memory',
          '256GB SSD',
          'Liquid Retina display',
        ],
        currysUrl: 'https://www.currys.co.uk/products/apple-macbook-air-13.6-2022-256-gb-ssd-midnight-10232444.html',
        colors: ['Midnight', 'Starlight', 'Space Grey', 'Silver'],
        inStock: true,
        rating: 4.9,
        reviewCount: 521,
      },
    ],
  },
  {
    id: 'phones',
    name: 'Mobile Phones',
    keywords: [
      'phone',
      'mobile',
      'smartphone',
      'iphone',
      'android',
      'samsung',
      'pixel',
    ],
    products: [
      {
        id: 'phone-iphone-15',
        name: 'Apple iPhone 15 - 128GB',
        price: 799,
        specs: [
          'A16 Bionic chip',
          '6.1-inch Super Retina XDR display',
          '48MP main camera',
          'All-day battery life',
        ],
        currysUrl: 'https://www.currys.co.uk/products/apple-iphone-15-128-gb-black-10260558.html',
        colors: ['Black', 'Blue', 'Green', 'Yellow', 'Pink'],
        inStock: true,
        rating: 4.7,
        reviewCount: 892,
      },
      {
        id: 'phone-samsung-s24',
        name: 'Samsung Galaxy S24 - 256GB',
        price: 899,
        specs: [
          'Snapdragon 8 Gen 3 processor',
          '6.2-inch Dynamic AMOLED display',
          'Triple camera with AI',
          '4000 mAh battery',
        ],
        currysUrl: 'https://www.currys.co.uk/products/samsung-galaxy-s24-256-gb-onyx-black-10262712.html',
        colors: ['Onyx Black', 'Marble Grey', 'Cobalt Violet', 'Amber Yellow'],
        inStock: true,
        rating: 4.6,
        reviewCount: 634,
      },
      {
        id: 'phone-pixel-8',
        name: 'Google Pixel 8 - 128GB',
        price: 699,
        specs: [
          'Google Tensor G3 chip',
          '6.2-inch Actua display',
          'Advanced AI photography',
          '7 years of OS updates',
        ],
        currysUrl: 'https://www.currys.co.uk/products/google-pixel-8-128-gb-obsidian-10260847.html',
        colors: ['Obsidian', 'Hazel', 'Rose'],
        inStock: true,
        rating: 4.5,
        reviewCount: 421,
      },
    ],
  },
  {
    id: 'tablets',
    name: 'Tablets',
    keywords: [
      'tablet',
      'ipad',
      'tab',
      'kindle',
      'surface',
    ],
    products: [
      {
        id: 'tablet-ipad-air',
        name: 'Apple iPad Air 11" M2 - 128GB',
        price: 599,
        specs: [
          'Apple M2 chip',
          '11-inch Liquid Retina display',
          'All-day battery life',
          'Works with Apple Pencil Pro',
        ],
        currysUrl: 'https://www.currys.co.uk/products/apple-11-ipad-air-m2-2024-128-gb-space-grey-10263521.html',
        colors: ['Space Grey', 'Starlight', 'Purple', 'Blue'],
        inStock: true,
        rating: 4.8,
        reviewCount: 287,
      },
      {
        id: 'tablet-samsung-tab',
        name: 'Samsung Galaxy Tab S9 - 128GB',
        price: 549,
        specs: [
          'Snapdragon 8 Gen 2',
          '11-inch Dynamic AMOLED display',
          'IP68 water resistance',
          'S Pen included',
        ],
        currysUrl: 'https://www.currys.co.uk/products/samsung-galaxy-tab-s9-11-tablet-128-gb-graphite-10259341.html',
        colors: ['Graphite', 'Beige'],
        inStock: true,
        rating: 4.6,
        reviewCount: 193,
      },
    ],
  },
  {
    id: 'headphones',
    name: 'Headphones & Audio',
    keywords: [
      'headphones',
      'earbuds',
      'airpods',
      'speaker',
      'audio',
      'earphones',
      'buds',
    ],
    products: [
      {
        id: 'headphones-sony-wh',
        name: 'Sony WH-1000XM5 Wireless Headphones',
        price: 329,
        specs: [
          'Industry-leading noise cancellation',
          '30-hour battery life',
          'Multipoint connection',
          'Premium sound quality',
        ],
        currysUrl: 'https://www.currys.co.uk/products/sony-wh1000xm5-wireless-bluetooth-noise-cancelling-headphones-black-10232073.html',
        colors: ['Black', 'Silver'],
        inStock: true,
        rating: 4.8,
        reviewCount: 1243,
      },
      {
        id: 'earbuds-airpods-pro',
        name: 'Apple AirPods Pro (2nd Gen) with MagSafe',
        price: 229,
        specs: [
          'Active Noise Cancellation',
          'Adaptive Audio',
          'Up to 6 hours listening time',
          'MagSafe charging case',
        ],
        currysUrl: 'https://www.currys.co.uk/products/apple-airpods-pro-2nd-generation-with-magsafe-charging-case-usbc-white-10259122.html',
        colors: ['White'],
        inStock: true,
        rating: 4.7,
        reviewCount: 876,
      },
    ],
  },
];

/**
 * Detect product category from user input
 */
export function detectProductCategory(userInput: string): ProductCategory | null {
  const normalized = userInput.toLowerCase().trim();

  for (const category of PRODUCT_CATEGORIES) {
    for (const keyword of category.keywords) {
      if (normalized.includes(keyword)) {
        return category;
      }
    }
  }

  return null;
}
