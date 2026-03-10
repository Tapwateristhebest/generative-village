// ============================================
// Emoji sprite definitions and tile colors
// ============================================

import type { TileType } from '../world/types';

export const TILE_SIZE = 32;

export interface TileVisual {
  char: string;
  bg: string;
  fg?: string;
}

export const TILE_VISUALS: Record<TileType, TileVisual> = {
  grass:       { char: '',   bg: '#3a7a2e' },
  dirt:        { char: '',   bg: '#8B7355' },
  tilled:      { char: '≈',  bg: '#6B5B3A', fg: '#554530' },
  watered:     { char: '≈',  bg: '#5B6B4A', fg: '#4a5a3a' },
  path:        { char: '',   bg: '#b8a88a' },
  water:       { char: '~',  bg: '#2563eb', fg: '#60a5fa' },
  tree:        { char: '🌳', bg: '#2d6a1e' },
  rock:        { char: '🪨', bg: '#666666' },
  building:    { char: '',   bg: '#5a4738' },
  door:        { char: '🚪', bg: '#4a3728' },
  fence:       { char: '╋',  bg: '#3a7a2e', fg: '#8B6914' },
  bridge:      { char: '═',  bg: '#8B7355', fg: '#6B5B3A' },
  planted:     { char: '🌱', bg: '#6B5B3A' },
  crop_stage1: { char: '🌿', bg: '#6B5B3A' },
  crop_stage2: { char: '🌾', bg: '#6B5B3A' },
  crop_ready:  { char: '✨', bg: '#6B5B3A' }, // replaced with crop emoji at render time
  wall:        { char: '',   bg: '#4a3728' },
  floor:       { char: '',   bg: '#7a6a5a' },
};

// Crop-specific ready emojis
export const CROP_READY_EMOJIS: Record<string, string> = {
  turnip: '🥕',
  potato: '🥔',
  strawberry: '🍓',
  parsnip: '🥬',
};

// Villager emojis (already in villager defs but duplicated here for renderer)
export const ENTITY_VISUALS = {
  player: { char: '👨‍🌾', label: 'You' },
  elder_oak: { char: '👴', label: 'Elder Oak' },
  merchant_mae: { char: '👩‍💼', label: 'Mae' },
  tinkerer_gus: { char: '🔧', label: 'Gus' },
  luna_forager: { char: '🧝‍♀️', label: 'Luna' },
  rusty_miner: { char: '⛏️', label: 'Rusty' },
} as Record<string, { char: string; label: string }>;

// Forageable item emojis
export const FORAGE_EMOJIS: Record<string, string> = {
  wild_herb: '🌿',
  wild_berry: '🫐',
  mushroom: '🍄',
  moonflower: '🌸',
};

// Phase sky colors (for background tinting)
export const PHASE_COLORS = {
  morning: { sky: '#87CEEB', overlay: 'rgba(255, 200, 100, 0.05)' },
  afternoon: { sky: '#4da6ff', overlay: 'rgba(255, 255, 200, 0.03)' },
  evening: { sky: '#ff7b54', overlay: 'rgba(255, 120, 50, 0.12)' },
  night: { sky: '#1a1a3e', overlay: 'rgba(0, 0, 40, 0.35)' },
};
