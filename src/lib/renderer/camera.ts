// ============================================
// Camera / viewport tracking
// ============================================

import { TILE_SIZE } from './sprites';
import { MAP_WIDTH, MAP_HEIGHT } from '../world/types';

export interface Camera {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  viewportWidth: number;
  viewportHeight: number;
}

export function createCamera(viewportWidth: number, viewportHeight: number): Camera {
  return {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    viewportWidth,
    viewportHeight,
  };
}

export function updateCamera(camera: Camera, playerX: number, playerY: number): void {
  // Center camera on player
  const targetX = playerX * TILE_SIZE - camera.viewportWidth / 2 + TILE_SIZE / 2;
  const targetY = playerY * TILE_SIZE - camera.viewportHeight / 2 + TILE_SIZE / 2;

  // Clamp to map bounds
  const maxX = MAP_WIDTH * TILE_SIZE - camera.viewportWidth;
  const maxY = MAP_HEIGHT * TILE_SIZE - camera.viewportHeight;

  camera.targetX = Math.max(0, Math.min(maxX, targetX));
  camera.targetY = Math.max(0, Math.min(maxY, targetY));

  // Smooth lerp
  const lerp = 0.15;
  camera.x += (camera.targetX - camera.x) * lerp;
  camera.y += (camera.targetY - camera.y) * lerp;
}

export function getVisibleTileRange(camera: Camera): {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
} {
  const startX = Math.max(0, Math.floor(camera.x / TILE_SIZE) - 1);
  const startY = Math.max(0, Math.floor(camera.y / TILE_SIZE) - 1);
  const endX = Math.min(MAP_WIDTH, Math.ceil((camera.x + camera.viewportWidth) / TILE_SIZE) + 1);
  const endY = Math.min(MAP_HEIGHT, Math.ceil((camera.y + camera.viewportHeight) / TILE_SIZE) + 1);

  return { startX, startY, endX, endY };
}
