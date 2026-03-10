// ============================================
// Economy types and shop inventory
// ============================================

import { SPRING_CROPS, FORAGE_ITEMS } from '../farming/types';

export interface ShopItem {
  itemId: string;
  name: string;
  price: number;
  stock: number; // -1 = infinite
  category: 'seed' | 'tool' | 'food' | 'material';
}

export interface ShopInventory {
  items: ShopItem[];
}

export function getDefaultShopInventory(): ShopInventory {
  return {
    items: [
      // Seeds (infinite stock)
      ...SPRING_CROPS.map(crop => ({
        itemId: `${crop.id}_seed`,
        name: `${crop.name} Seeds`,
        price: crop.seedPrice,
        stock: -1,
        category: 'seed' as const,
      })),
      // Tools (limited)
      { itemId: 'hoe', name: 'Hoe', price: 50, stock: 1, category: 'tool' },
      { itemId: 'watering_can', name: 'Watering Can', price: 50, stock: 1, category: 'tool' },
    ],
  };
}

// Sell prices for crops and foraged items
export function getSellPrice(itemId: string): number {
  // Check crops
  const crop = SPRING_CROPS.find(c => c.id === itemId);
  if (crop) return crop.sellPrice;

  // Check foraged items
  const forage = FORAGE_ITEMS[itemId];
  if (forage) return forage.sellPrice;

  // Seeds can be sold back at half price
  const seedCrop = SPRING_CROPS.find(c => `${c.id}_seed` === itemId);
  if (seedCrop) return Math.floor(seedCrop.seedPrice / 2);

  return 5; // default junk price
}
