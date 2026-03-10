// ============================================
// A* pathfinding for villager movement
// ============================================

import type { Position, Tile } from './types';
import { MAP_WIDTH, MAP_HEIGHT } from './types';

interface Node {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

function heuristic(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

const DIRECTIONS = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

export function findPath(
  tiles: Tile[][],
  start: Position,
  goal: Position,
  maxSteps: number = 100
): Position[] {
  if (start.x === goal.x && start.y === goal.y) return [];

  const open: Node[] = [{ x: start.x, y: start.y, g: 0, h: heuristic(start, goal), f: heuristic(start, goal), parent: null }];
  const closed = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;

  let iterations = 0;

  while (open.length > 0 && iterations < maxSteps * 10) {
    iterations++;

    // Find node with lowest f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];

    if (current.x === goal.x && current.y === goal.y) {
      // Reconstruct path
      const path: Position[] = [];
      let node: Node | null = current;
      while (node && !(node.x === start.x && node.y === start.y)) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path.slice(0, maxSteps);
    }

    closed.add(key(current.x, current.y));

    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;

      if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
      if (!tiles[ny][nx].walkable) continue;
      if (closed.has(key(nx, ny))) continue;

      const g = current.g + 1;
      const h = heuristic({ x: nx, y: ny }, goal);
      const f = g + h;

      const existing = open.find(n => n.x === nx && n.y === ny);
      if (existing && existing.g <= g) continue;

      if (existing) {
        existing.g = g;
        existing.h = h;
        existing.f = f;
        existing.parent = current;
      } else {
        open.push({ x: nx, y: ny, g, h, f, parent: current });
      }
    }
  }

  // No path found - return partial path towards goal
  return [];
}

export function getNextStep(tiles: Tile[][], from: Position, to: Position): Position | null {
  const path = findPath(tiles, from, to, 20);
  return path.length > 0 ? path[0] : null;
}
