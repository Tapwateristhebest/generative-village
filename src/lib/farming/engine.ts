// ============================================
// Farming engine: till, plant, water, grow, harvest
// ============================================

import type { Tile, CropOnTile } from '../world/types';
import { ALL_CROPS, ENERGY_COSTS } from './types';
import type { ItemStack } from './types';

export interface FarmAction {
  type: 'till' | 'plant' | 'water' | 'harvest' | 'forage';
  x: number;
  y: number;
  cropId?: string;
}

export interface FarmResult {
  success: boolean;
  message: string;
  energyCost: number;
  itemGained?: ItemStack;
  tileUpdate?: Tile;
}

export function canTill(tile: Tile): boolean {
  return tile.type === 'dirt' && !tile.crop;
}

export function canPlant(tile: Tile, cropId: string): boolean {
  return tile.type === 'tilled' && !tile.crop && !!ALL_CROPS[cropId];
}

export function canWater(tile: Tile): boolean {
  return !!tile.crop && !tile.crop.wateredToday;
}

export function canHarvest(tile: Tile): boolean {
  if (!tile.crop) return false;
  const def = ALL_CROPS[tile.crop.cropId];
  if (!def) return false;
  return tile.crop.currentStage >= def.stages.length - 1;
}

export function executeTill(tile: Tile): FarmResult {
  if (!canTill(tile)) {
    return { success: false, message: 'Cannot till this tile', energyCost: 0 };
  }
  const updated: Tile = { ...tile, type: 'tilled' };
  return {
    success: true,
    message: 'Tilled the soil',
    energyCost: ENERGY_COSTS.till,
    tileUpdate: updated,
  };
}

export function executePlant(tile: Tile, cropId: string, currentDay: number): FarmResult {
  if (!canPlant(tile, cropId)) {
    return { success: false, message: 'Cannot plant here', energyCost: 0 };
  }
  const crop: CropOnTile = {
    cropId,
    plantedDay: currentDay,
    currentStage: 0,
    wateredToday: false,
    daysSinceWater: 0,
  };
  const updated: Tile = { ...tile, type: 'planted', crop };
  return {
    success: true,
    message: `Planted ${ALL_CROPS[cropId].name} seeds`,
    energyCost: ENERGY_COSTS.plant,
    tileUpdate: updated,
  };
}

export function executeWater(tile: Tile): FarmResult {
  if (!canWater(tile)) {
    return { success: false, message: 'Nothing to water here', energyCost: 0 };
  }
  const crop: CropOnTile = { ...tile.crop!, wateredToday: true, daysSinceWater: 0 };
  const updated: Tile = { ...tile, type: 'watered', crop };
  return {
    success: true,
    message: 'Watered the crop',
    energyCost: ENERGY_COSTS.water,
    tileUpdate: updated,
  };
}

export function executeHarvest(tile: Tile): FarmResult {
  if (!canHarvest(tile)) {
    return { success: false, message: 'Nothing ready to harvest', energyCost: 0 };
  }
  const def = ALL_CROPS[tile.crop!.cropId];
  const item: ItemStack = {
    itemId: tile.crop!.cropId,
    name: def.name,
    quantity: 1,
    category: 'crop',
  };
  const updated: Tile = { ...tile, type: 'dirt', crop: null };
  return {
    success: true,
    message: `Harvested ${def.name}!`,
    energyCost: ENERGY_COSTS.harvest,
    itemGained: item,
    tileUpdate: updated,
  };
}

export function executeForage(tile: Tile): FarmResult {
  if (!tile.forageable) {
    return { success: false, message: 'Nothing to forage here', energyCost: 0 };
  }
  const item: ItemStack = {
    itemId: tile.forageable,
    name: tile.forageable.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    quantity: 1,
    category: 'foraged',
  };
  const updated: Tile = { ...tile, forageable: undefined, interactable: false };
  return {
    success: true,
    message: `Found ${item.name}!`,
    energyCost: ENERGY_COSTS.forage,
    itemGained: item,
    tileUpdate: updated,
  };
}

// Called at the start of each new day to advance crop growth
export function advanceCrops(tiles: Tile[][]): { grownCount: number; diedCount: number } {
  let grownCount = 0;
  let diedCount = 0;

  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      const tile = tiles[y][x];
      if (!tile.crop) continue;

      const def = ALL_CROPS[tile.crop.cropId];
      if (!def) continue;

      if (tile.crop.wateredToday) {
        // Advance growth stage
        const daysGrowing = tile.crop.currentStage + 1;
        const totalStages = def.stages.length - 1;
        if (daysGrowing < totalStages) {
          tile.crop.currentStage = daysGrowing;
          tile.type = daysGrowing === totalStages - 1 ? 'crop_stage2' : 'crop_stage1';
        } else {
          tile.crop.currentStage = totalStages;
          tile.type = 'crop_ready';
        }
        grownCount++;
      } else {
        tile.crop.daysSinceWater++;
        if (tile.crop.daysSinceWater >= 3) {
          // Crop dies
          tile.crop = null;
          tile.type = 'dirt';
          diedCount++;
        }
      }

      // Reset watered status for new day
      if (tile.crop) {
        tile.crop.wateredToday = false;
        if (tile.type === 'watered') {
          tile.type = tile.crop.currentStage === 0 ? 'planted' :
            tile.crop.currentStage >= (def.stages.length - 1) ? 'crop_ready' :
            tile.crop.currentStage >= (def.stages.length - 2) ? 'crop_stage2' : 'crop_stage1';
        }
      }
    }
  }

  return { grownCount, diedCount };
}
