// ============================================
// Main canvas render loop
// ============================================

import type { GameState } from '../engine/state';
import type { Camera } from './camera';
import { getVisibleTileRange } from './camera';
import { TILE_SIZE, TILE_VISUALS, CROP_READY_EMOJIS, ENTITY_VISUALS, FORAGE_EMOJIS, PHASE_COLORS } from './sprites';
import { ALL_CROPS } from '../farming/types';

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camera: Camera,
  selectedTool: string,
  facingDir: string
): void {
  const { width, height } = ctx.canvas;

  // Clear
  ctx.clearRect(0, 0, width, height);

  // Sky background based on time of day
  const phaseColor = PHASE_COLORS[state.currentPhase as keyof typeof PHASE_COLORS] || PHASE_COLORS.morning;
  ctx.fillStyle = phaseColor.sky;
  ctx.fillRect(0, 0, width, height);

  const { startX, startY, endX, endY } = getVisibleTileRange(camera);

  // Render tiles
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      if (y >= state.worldMap.height || x >= state.worldMap.width) continue;

      const tile = state.worldMap.tiles[y][x];
      const visual = TILE_VISUALS[tile.type];
      if (!visual) continue;

      const screenX = Math.floor(x * TILE_SIZE - camera.x);
      const screenY = Math.floor(y * TILE_SIZE - camera.y);

      // Draw tile background
      ctx.fillStyle = visual.bg;
      ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

      // Draw tile grid lines (subtle)
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

      // Draw tile character/emoji
      let charToDraw = visual.char;

      // Special handling for crop_ready - show the crop's specific emoji
      if (tile.type === 'crop_ready' && tile.crop) {
        charToDraw = CROP_READY_EMOJIS[tile.crop.cropId] || '✨';
      }

      // Show crop stage emojis
      if (tile.crop && tile.type !== 'crop_ready') {
        const def = ALL_CROPS[tile.crop.cropId];
        if (def && def.stages[tile.crop.currentStage]) {
          charToDraw = def.stages[tile.crop.currentStage];
        }
      }

      // Show forageable items
      if (tile.forageable) {
        charToDraw = FORAGE_EMOJIS[tile.forageable] || '🌿';
      }

      if (charToDraw) {
        ctx.font = `${TILE_SIZE - 6}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (visual.fg) {
          ctx.fillStyle = visual.fg;
        }
        ctx.fillText(charToDraw, screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2);
      }
    }
  }

  // Render villagers
  for (const villager of state.villagers) {
    const screenX = Math.floor(villager.position.x * TILE_SIZE - camera.x);
    const screenY = Math.floor(villager.position.y * TILE_SIZE - camera.y);

    // Only render if on screen
    if (screenX < -TILE_SIZE || screenX > width + TILE_SIZE || screenY < -TILE_SIZE || screenY > height + TILE_SIZE) continue;

    const entityVisual = ENTITY_VISUALS[villager.id];
    if (!entityVisual) continue;

    // Draw villager shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(screenX + TILE_SIZE / 2, screenY + TILE_SIZE - 2, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw villager emoji
    ctx.font = `${TILE_SIZE - 4}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entityVisual.char, screenX + TILE_SIZE / 2, screenY + TILE_SIZE / 2);

    // Draw name label
    ctx.font = '10px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.textAlign = 'center';
    ctx.strokeText(entityVisual.label, screenX + TILE_SIZE / 2, screenY - 4);
    ctx.fillText(entityVisual.label, screenX + TILE_SIZE / 2, screenY - 4);
  }

  // Render player
  const playerScreenX = Math.floor(state.playerPosition.x * TILE_SIZE - camera.x);
  const playerScreenY = Math.floor(state.playerPosition.y * TILE_SIZE - camera.y);

  // Player shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(playerScreenX + TILE_SIZE / 2, playerScreenY + TILE_SIZE - 2, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Player emoji
  ctx.font = `${TILE_SIZE - 2}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('👨‍🌾', playerScreenX + TILE_SIZE / 2, playerScreenY + TILE_SIZE / 2);

  // Player highlight ring
  ctx.strokeStyle = 'rgba(255, 255, 100, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(playerScreenX + 2, playerScreenY + 2, TILE_SIZE - 4, TILE_SIZE - 4);

  // Draw facing direction indicator (tool target)
  const facingDelta = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[facingDir] || { x: 0, y: 1 };
  const targetScreenX = Math.floor((state.playerPosition.x + facingDelta.x) * TILE_SIZE - camera.x);
  const targetScreenY = Math.floor((state.playerPosition.y + facingDelta.y) * TILE_SIZE - camera.y);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(targetScreenX + 1, targetScreenY + 1, TILE_SIZE - 2, TILE_SIZE - 2);
  ctx.setLineDash([]);

  // Time-of-day overlay
  ctx.fillStyle = phaseColor.overlay;
  ctx.fillRect(0, 0, width, height);
}
