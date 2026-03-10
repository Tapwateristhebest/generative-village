// ============================================
// Shop buy/sell logic
// ============================================

import type { ShopInventory } from './types';
import { getSellPrice } from './types';
import type { ItemStack } from '../farming/types';

export interface ShopTransaction {
  type: 'buy' | 'sell';
  itemId: string;
  quantity: number;
}

export interface ShopResult {
  success: boolean;
  message: string;
  goldChange: number;
  inventoryChange?: ItemStack;
  updatedShop?: ShopInventory;
}

export function executeBuy(
  shop: ShopInventory,
  playerGold: number,
  playerInventory: ItemStack[],
  itemId: string,
  quantity: number = 1
): ShopResult {
  const shopItem = shop.items.find(i => i.itemId === itemId);
  if (!shopItem) {
    return { success: false, message: 'Item not in stock', goldChange: 0 };
  }

  if (shopItem.stock !== -1 && shopItem.stock < quantity) {
    return { success: false, message: 'Not enough in stock', goldChange: 0 };
  }

  const totalCost = shopItem.price * quantity;
  if (playerGold < totalCost) {
    return { success: false, message: `Not enough gold (need ${totalCost}, have ${playerGold})`, goldChange: 0 };
  }

  // Update shop stock
  if (shopItem.stock !== -1) {
    shopItem.stock -= quantity;
  }

  // Determine item category for inventory
  const category = shopItem.category === 'seed' ? 'seed' : shopItem.category === 'tool' ? 'tool' : 'material';

  return {
    success: true,
    message: `Bought ${quantity}x ${shopItem.name} for ${totalCost}g`,
    goldChange: -totalCost,
    inventoryChange: {
      itemId: shopItem.itemId,
      name: shopItem.name,
      quantity,
      category: category as ItemStack['category'],
    },
    updatedShop: shop,
  };
}

export function executeSell(
  playerGold: number,
  playerInventory: ItemStack[],
  itemId: string,
  quantity: number = 1
): ShopResult {
  const invItem = playerInventory.find(i => i.itemId === itemId);
  if (!invItem || invItem.quantity < quantity) {
    return { success: false, message: "You don't have enough of that item", goldChange: 0 };
  }

  const priceEach = getSellPrice(itemId);
  const totalGold = priceEach * quantity;

  return {
    success: true,
    message: `Sold ${quantity}x ${invItem.name} for ${totalGold}g`,
    goldChange: totalGold,
    inventoryChange: {
      itemId,
      name: invItem.name,
      quantity: -quantity,
      category: invItem.category,
    },
  };
}
