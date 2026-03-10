// ============================================
// World types for the village simulator
// ============================================

export interface Position {
  x: number;
  y: number;
}

export type TileType =
  | 'grass' | 'dirt' | 'tilled' | 'watered'
  | 'path' | 'water' | 'tree' | 'rock'
  | 'building' | 'door' | 'fence' | 'bridge'
  | 'planted' | 'crop_stage1' | 'crop_stage2' | 'crop_ready'
  | 'wall' | 'floor';

export interface CropOnTile {
  cropId: string;
  plantedDay: number;
  currentStage: number;
  wateredToday: boolean;
  daysSinceWater: number;
}

export interface Tile {
  type: TileType;
  crop?: CropOnTile | null;
  walkable: boolean;
  interactable: boolean;
  buildingId?: string;
  forageable?: string; // item id that can be foraged here
}

export interface Building {
  id: string;
  name: string;
  type: 'home' | 'shop' | 'community_center' | 'player_home';
  position: Position;
  size: { w: number; h: number };
  ownerId?: string;
  doorPosition: Position;
}

export interface Region {
  id: string;
  name: string;
  bounds: { x: number; y: number; width: number; height: number };
  type: 'farm' | 'village' | 'forest' | 'water' | 'home';
}

export interface WorldMap {
  width: number;
  height: number;
  tiles: Tile[][];
  buildings: Building[];
  regions: Region[];
}

export const MAP_WIDTH = 32;
export const MAP_HEIGHT = 32;
