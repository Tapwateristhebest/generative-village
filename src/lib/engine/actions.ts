// ============================================
// Process player actions on game state
// ============================================

import type { GameState } from './state';
import type { Position } from '../world/types';
import type { ItemStack } from '../farming/types';
import { ENERGY_COSTS, ALL_CROPS } from '../farming/types';
import { executeTill, executePlant, executeWater, executeHarvest, executeForage } from '../farming/engine';
import { MAP_WIDTH, MAP_HEIGHT } from '../world/types';

export type PlayerAction =
  | { type: 'move'; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'use_tool'; tool: string }
  | { type: 'plant'; cropId: string }
  | { type: 'interact' }
  | { type: 'sleep' };

export interface ActionResult {
  success: boolean;
  message: string;
  stateUpdated: boolean;
  interactionTarget?: { type: 'villager' | 'shop' | 'building'; id: string };
}

function getDirection(dir: string): Position {
  switch (dir) {
    case 'up': return { x: 0, y: -1 };
    case 'down': return { x: 0, y: 1 };
    case 'left': return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
    default: return { x: 0, y: 0 };
  }
}

function getFacingTile(state: GameState): Position {
  // Player faces down by default, use last movement direction if tracked
  return { x: state.playerPosition.x, y: state.playerPosition.y + 1 };
}

function addToInventory(inventory: ItemStack[], item: ItemStack): ItemStack[] {
  const existing = inventory.find(i => i.itemId === item.itemId);
  if (existing) {
    existing.quantity += item.quantity;
    return inventory;
  }
  return [...inventory, { ...item }];
}

export function processAction(state: GameState, action: PlayerAction): ActionResult {
  switch (action.type) {
    case 'move': return processMove(state, action.direction);
    case 'use_tool': return processUseTool(state, action.tool);
    case 'plant': return processPlant(state, action.cropId);
    case 'interact': return processInteract(state);
    case 'sleep': return processSleep(state);
    default: return { success: false, message: 'Unknown action', stateUpdated: false };
  }
}

function processMove(state: GameState, direction: string): ActionResult {
  const delta = getDirection(direction);
  const newX = state.playerPosition.x + delta.x;
  const newY = state.playerPosition.y + delta.y;

  if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) {
    return { success: false, message: 'Cannot go that way', stateUpdated: false };
  }

  const tile = state.worldMap.tiles[newY][newX];
  if (!tile.walkable) {
    return { success: false, message: 'Something is in the way', stateUpdated: false };
  }

  // Check villager collision
  const villagerAtPos = state.villagers.find(v => v.position.x === newX && v.position.y === newY);
  if (villagerAtPos) {
    return { success: false, message: `${villagerAtPos.name} is here`, stateUpdated: false };
  }

  state.playerPosition = { x: newX, y: newY };
  return { success: true, message: '', stateUpdated: true };
}

function processUseTool(state: GameState, tool: string): ActionResult {
  const facing = getFacingTile(state);
  if (facing.y < 0 || facing.y >= MAP_HEIGHT || facing.x < 0 || facing.x >= MAP_WIDTH) {
    return { success: false, message: 'Nothing there', stateUpdated: false };
  }

  const tile = state.worldMap.tiles[facing.y][facing.x];

  if (tool === 'hoe') {
    if (state.playerEnergy < ENERGY_COSTS.till) {
      return { success: false, message: 'Too tired!', stateUpdated: false };
    }
    const result = executeTill(tile);
    if (result.success && result.tileUpdate) {
      state.worldMap.tiles[facing.y][facing.x] = result.tileUpdate;
      state.playerEnergy -= result.energyCost;
      return { success: true, message: result.message, stateUpdated: true };
    }
    return { success: false, message: result.message, stateUpdated: false };
  }

  if (tool === 'watering_can') {
    if (state.playerEnergy < ENERGY_COSTS.water) {
      return { success: false, message: 'Too tired!', stateUpdated: false };
    }
    const result = executeWater(tile);
    if (result.success && result.tileUpdate) {
      state.worldMap.tiles[facing.y][facing.x] = result.tileUpdate;
      state.playerEnergy -= result.energyCost;
      return { success: true, message: result.message, stateUpdated: true };
    }
    return { success: false, message: result.message, stateUpdated: false };
  }

  return { success: false, message: `Can't use ${tool} here`, stateUpdated: false };
}

function processPlant(state: GameState, cropId: string): ActionResult {
  const facing = getFacingTile(state);
  if (facing.y < 0 || facing.y >= MAP_HEIGHT || facing.x < 0 || facing.x >= MAP_WIDTH) {
    return { success: false, message: 'Nothing there', stateUpdated: false };
  }

  // Check player has seeds
  const seedId = `${cropId}_seed`;
  const seedItem = state.playerInventory.find(i => i.itemId === seedId);
  if (!seedItem || seedItem.quantity <= 0) {
    return { success: false, message: `No ${ALL_CROPS[cropId]?.name || cropId} seeds`, stateUpdated: false };
  }

  if (state.playerEnergy < ENERGY_COSTS.plant) {
    return { success: false, message: 'Too tired!', stateUpdated: false };
  }

  const tile = state.worldMap.tiles[facing.y][facing.x];
  const result = executePlant(tile, cropId, state.currentDay);
  if (result.success && result.tileUpdate) {
    state.worldMap.tiles[facing.y][facing.x] = result.tileUpdate;
    state.playerEnergy -= result.energyCost;
    // Remove seed from inventory
    seedItem.quantity -= 1;
    if (seedItem.quantity <= 0) {
      state.playerInventory = state.playerInventory.filter(i => i.itemId !== seedId);
    }
    return { success: true, message: result.message, stateUpdated: true };
  }
  return { success: false, message: result.message, stateUpdated: false };
}

function processInteract(state: GameState): ActionResult {
  const px = state.playerPosition.x;
  const py = state.playerPosition.y;

  // Check adjacent tiles for interactable things (including diagonal-ish)
  const checkPositions: Position[] = [
    { x: px, y: py - 1 }, { x: px, y: py + 1 },
    { x: px - 1, y: py }, { x: px + 1, y: py },
  ];

  // Check for nearby villagers first
  for (const pos of checkPositions) {
    const villager = state.villagers.find(v => v.position.x === pos.x && v.position.y === pos.y);
    if (villager) {
      // Check if this is the shopkeeper
      if (villager.id === 'merchant_mae') {
        return {
          success: true,
          message: `Talking to ${villager.name}`,
          stateUpdated: false,
          interactionTarget: { type: 'shop', id: villager.id },
        };
      }
      return {
        success: true,
        message: `Talking to ${villager.name}`,
        stateUpdated: false,
        interactionTarget: { type: 'villager', id: villager.id },
      };
    }
  }

  // Check for harvestable crops
  for (const pos of checkPositions) {
    if (pos.y < 0 || pos.y >= MAP_HEIGHT || pos.x < 0 || pos.x >= MAP_WIDTH) continue;
    const tile = state.worldMap.tiles[pos.y][pos.x];

    if (tile.type === 'crop_ready' && tile.crop) {
      if (state.playerEnergy < ENERGY_COSTS.harvest) {
        return { success: false, message: 'Too tired!', stateUpdated: false };
      }
      const result = executeHarvest(tile);
      if (result.success && result.tileUpdate && result.itemGained) {
        state.worldMap.tiles[pos.y][pos.x] = result.tileUpdate;
        state.playerEnergy -= result.energyCost;
        state.playerInventory = addToInventory(state.playerInventory, result.itemGained);
        return { success: true, message: result.message, stateUpdated: true };
      }
    }

    // Check for forageable items
    if (tile.forageable) {
      if (state.playerEnergy < ENERGY_COSTS.forage) {
        return { success: false, message: 'Too tired!', stateUpdated: false };
      }
      const result = executeForage(tile);
      if (result.success && result.tileUpdate && result.itemGained) {
        state.worldMap.tiles[pos.y][pos.x] = result.tileUpdate;
        state.playerEnergy -= result.energyCost;
        state.playerInventory = addToInventory(state.playerInventory, result.itemGained);
        return { success: true, message: result.message, stateUpdated: true };
      }
    }

    // Check for doors/buildings
    if (tile.type === 'door' && tile.buildingId) {
      const building = state.worldMap.buildings.find(b => b.id === tile.buildingId);
      if (building) {
        return {
          success: true,
          message: `${building.name}`,
          stateUpdated: false,
          interactionTarget: { type: 'building', id: building.id },
        };
      }
    }
  }

  return { success: false, message: 'Nothing to interact with', stateUpdated: false };
}

function processSleep(state: GameState): ActionResult {
  if (state.currentPhase !== 'night' && state.currentPhase !== 'evening') {
    return { success: false, message: "It's not time to sleep yet", stateUpdated: false };
  }
  return { success: true, message: 'Going to sleep...', stateUpdated: true };
}
