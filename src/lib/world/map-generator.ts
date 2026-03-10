// ============================================
// Generate the initial 32x32 village world map
// ============================================

import type { WorldMap, Tile, Building, Region, Position } from './types';
import { MAP_WIDTH, MAP_HEIGHT } from './types';

function makeTile(type: Tile['type'], overrides?: Partial<Tile>): Tile {
  const walkableTypes = new Set(['grass', 'dirt', 'tilled', 'watered', 'path', 'floor', 'door', 'planted', 'crop_stage1', 'crop_stage2', 'crop_ready']);
  const interactableTypes = new Set(['door', 'crop_ready', 'tree', 'rock']);
  return {
    type,
    crop: null,
    walkable: walkableTypes.has(type),
    interactable: interactableTypes.has(type),
    ...overrides,
  };
}

function fillRect(tiles: Tile[][], x: number, y: number, w: number, h: number, type: Tile['type'], overrides?: Partial<Tile>) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
        tiles[ty][tx] = makeTile(type, overrides);
      }
    }
  }
}

function placeBuilding(tiles: Tile[][], b: Building) {
  // Building body (walls)
  fillRect(tiles, b.position.x, b.position.y, b.size.w, b.size.h, 'building', {
    walkable: false,
    interactable: false,
    buildingId: b.id,
  });
  // Door
  tiles[b.doorPosition.y][b.doorPosition.x] = makeTile('door', {
    walkable: true,
    interactable: true,
    buildingId: b.id,
  });
}

export function generateWorldMap(): WorldMap {
  // Initialize all grass
  const tiles: Tile[][] = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    tiles[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      tiles[y][x] = makeTile('grass');
    }
  }

  // === REGIONS ===

  // Forest (top rows 0-5)
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < MAP_WIDTH; x++) {
      // Dense trees with some gaps
      if (Math.random() < 0.55) {
        tiles[y][x] = makeTile('tree', { walkable: false, interactable: true });
      }
      // Occasional forageable spots
      if (Math.random() < 0.08 && tiles[y][x].type === 'grass') {
        tiles[y][x] = makeTile('grass', { forageable: 'wild_herb', interactable: true });
      }
    }
  }
  // Ensure a clear path into the forest from the village
  for (let y = 3; y < 6; y++) {
    tiles[y][15] = makeTile('path');
    tiles[y][16] = makeTile('path');
  }

  // Village center paths (rows 8-11, cols 12-19)
  for (let x = 10; x < 22; x++) {
    tiles[9][x] = makeTile('path');
    tiles[10][x] = makeTile('path');
  }
  for (let y = 6; y < 14; y++) {
    tiles[y][15] = makeTile('path');
    tiles[y][16] = makeTile('path');
  }

  // Player farm area (rows 14-27, cols 4-19) - dirt for tilling
  for (let y = 14; y < 28; y++) {
    for (let x = 4; x < 20; x++) {
      tiles[y][x] = makeTile('dirt');
    }
  }
  // Farm fence (decorative)
  for (let x = 3; x < 21; x++) {
    tiles[13][x] = makeTile('fence', { walkable: false });
    tiles[28][x] = makeTile('fence', { walkable: false });
  }
  for (let y = 13; y < 29; y++) {
    tiles[y][3] = makeTile('fence', { walkable: false });
    tiles[y][20] = makeTile('fence', { walkable: false });
  }
  // Farm entrance gap
  tiles[13][15] = makeTile('path');
  tiles[13][16] = makeTile('path');

  // Pond (bottom-right, rows 25-30, cols 22-29)
  for (let y = 25; y < 31; y++) {
    for (let x = 22; x < 30; x++) {
      const dist = Math.sqrt((x - 26) ** 2 + (y - 28) ** 2);
      if (dist < 3.5) {
        tiles[y][x] = makeTile('water', { walkable: false });
      }
    }
  }

  // Rocks scattered around
  const rockPositions: Position[] = [
    { x: 2, y: 10 }, { x: 28, y: 3 }, { x: 25, y: 12 },
    { x: 1, y: 20 }, { x: 29, y: 20 }, { x: 22, y: 8 },
  ];
  for (const pos of rockPositions) {
    tiles[pos.y][pos.x] = makeTile('rock', { walkable: false, interactable: true });
  }

  // === BUILDINGS ===
  const buildings: Building[] = [
    {
      id: 'player_home',
      name: 'Your Farmhouse',
      type: 'player_home',
      position: { x: 8, y: 11 },
      size: { w: 3, h: 2 },
      doorPosition: { x: 9, y: 13 },
    },
    {
      id: 'elder_oak_home',
      name: "Elder Oak's Cottage",
      type: 'home',
      position: { x: 10, y: 6 },
      size: { w: 3, h: 2 },
      ownerId: 'elder_oak',
      doorPosition: { x: 11, y: 8 },
    },
    {
      id: 'mae_shop',
      name: "Mae's General Store",
      type: 'shop',
      position: { x: 18, y: 7 },
      size: { w: 4, h: 2 },
      ownerId: 'merchant_mae',
      doorPosition: { x: 19, y: 9 },
    },
    {
      id: 'gus_workshop',
      name: "Gus's Workshop",
      type: 'home',
      position: { x: 23, y: 6 },
      size: { w: 3, h: 2 },
      ownerId: 'tinkerer_gus',
      doorPosition: { x: 24, y: 8 },
    },
    {
      id: 'luna_cabin',
      name: "Luna's Cabin",
      type: 'home',
      position: { x: 5, y: 6 },
      size: { w: 3, h: 2 },
      ownerId: 'luna_forager',
      doorPosition: { x: 6, y: 8 },
    },
    {
      id: 'rusty_shack',
      name: "Rusty's Shack",
      type: 'home',
      position: { x: 24, y: 11 },
      size: { w: 3, h: 2 },
      ownerId: 'rusty_miner',
      doorPosition: { x: 25, y: 13 },
    },
  ];

  for (const b of buildings) {
    placeBuilding(tiles, b);
  }

  // Village center fountain/square marker
  tiles[9][15] = makeTile('path', { interactable: true });
  tiles[9][16] = makeTile('path', { interactable: true });
  tiles[10][15] = makeTile('path', { interactable: true });
  tiles[10][16] = makeTile('path', { interactable: true });

  const regions: Region[] = [
    { id: 'forest', name: 'Whisper Woods', bounds: { x: 0, y: 0, width: 32, height: 6 }, type: 'forest' },
    { id: 'village', name: 'Village Center', bounds: { x: 8, y: 6, width: 20, height: 8 }, type: 'village' },
    { id: 'farm', name: 'Player Farm', bounds: { x: 4, y: 14, width: 16, height: 14 }, type: 'farm' },
    { id: 'pond', name: 'Shimmer Pond', bounds: { x: 22, y: 25, width: 8, height: 6 }, type: 'water' },
  ];

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tiles,
    buildings,
    regions,
  };
}
