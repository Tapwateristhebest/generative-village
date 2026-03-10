import { NextResponse } from 'next/server';
import { loadGameState, saveGameState } from '@/lib/engine/state';
import { executeBuy, executeSell } from '@/lib/economy/shop';
import type { ItemStack } from '@/lib/farming/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { gameId, type, itemId, quantity = 1 } = body as {
      gameId: string;
      type: 'buy' | 'sell';
      itemId: string;
      quantity?: number;
    };

    if (!gameId || !type || !itemId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const state = await loadGameState(gameId);
    if (!state) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }

    let result;
    if (type === 'buy') {
      result = executeBuy(state.shopInventory, state.playerGold, state.playerInventory, itemId, quantity);
    } else {
      result = executeSell(state.playerGold, state.playerInventory, itemId, quantity);
    }

    if (result.success) {
      state.playerGold += result.goldChange;

      if (result.inventoryChange) {
        if (result.inventoryChange.quantity > 0) {
          // Adding to inventory
          const existing = state.playerInventory.find(i => i.itemId === result.inventoryChange!.itemId);
          if (existing) {
            existing.quantity += result.inventoryChange.quantity;
          } else {
            state.playerInventory.push({ ...result.inventoryChange });
          }
        } else {
          // Removing from inventory
          const existing = state.playerInventory.find(i => i.itemId === result.inventoryChange!.itemId);
          if (existing) {
            existing.quantity += result.inventoryChange.quantity; // quantity is negative
            if (existing.quantity <= 0) {
              state.playerInventory = state.playerInventory.filter(i => i.itemId !== result.inventoryChange!.itemId);
            }
          }
        }
      }

      if (result.updatedShop) {
        state.shopInventory = result.updatedShop;
      }

      await saveGameState(state);
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      gameState: state,
    });
  } catch (error) {
    console.error('Shop transaction failed:', error);
    return NextResponse.json({ success: false, error: 'Transaction failed' }, { status: 500 });
  }
}
