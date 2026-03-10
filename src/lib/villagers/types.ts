// ============================================
// Villager AI types
// ============================================

import type { Position } from '../world/types';
import type { ItemStack } from '../farming/types';

export interface VillagerDefinition {
  id: string;
  name: string;
  emoji: string;
  role: string;
  homeId: string;
  startPosition: Position;
  defaultGold: number;
}

export const VILLAGER_DEFINITIONS: VillagerDefinition[] = [
  { id: 'elder_oak', name: 'Elder Oak', emoji: '👴', role: 'Master Farmer', homeId: 'elder_oak_home', startPosition: { x: 11, y: 9 }, defaultGold: 300 },
  { id: 'merchant_mae', name: 'Merchant Mae', emoji: '👩‍💼', role: 'Shopkeeper', homeId: 'mae_shop', startPosition: { x: 19, y: 10 }, defaultGold: 500 },
  { id: 'tinkerer_gus', name: 'Tinkerer Gus', emoji: '🔧', role: 'Inventor', homeId: 'gus_workshop', startPosition: { x: 24, y: 9 }, defaultGold: 200 },
  { id: 'luna_forager', name: 'Luna', emoji: '🧝‍♀️', role: 'Forager & Herbalist', homeId: 'luna_cabin', startPosition: { x: 6, y: 9 }, defaultGold: 150 },
  { id: 'rusty_miner', name: 'Rusty', emoji: '⛏️', role: 'Miner & Adventurer', homeId: 'rusty_shack', startPosition: { x: 25, y: 10 }, defaultGold: 100 },
];

export interface VillagerState {
  id: string;
  name: string;
  emoji: string;
  position: Position;
  inventory: ItemStack[];
  gold: number;
  currentMood: string;
  relationships: Record<string, number>; // entity_id -> affinity (-100 to 100)
}

export type VillagerActionType =
  | { type: 'move'; target: Position }
  | { type: 'farm'; subtype: 'till' | 'plant' | 'water' | 'harvest'; position: Position; cropId?: string }
  | { type: 'talk'; to: string; message: string }
  | { type: 'gift'; to: string; itemId: string }
  | { type: 'quest_offer'; quest: QuestOffer }
  | { type: 'idle'; reason: string };

export interface VillagerDecision {
  action: VillagerActionType;
  dialogue?: string;
  internalThought?: string;
  mood?: string;
}

export interface VillagerMemory {
  id?: number;
  villagerId: string;
  day: number;
  event: string;
  sentiment: number; // -1 to 1
  about?: string;
}

export interface VillagerContext {
  villager: VillagerState;
  timeOfDay: string;
  currentDay: number;
  season: string;
  nearbyEntities: Array<{ id: string; name: string; type: 'player' | 'villager'; distance: number }>;
  recentEvents: string[];
  memories: VillagerMemory[];
  playerRelationship: number;
}

export interface QuestOffer {
  title: string;
  description: string;
  objective: {
    type: 'deliver' | 'harvest' | 'forage' | 'talk';
    itemId?: string;
    quantity?: number;
    targetId?: string;
  };
  reward: {
    gold?: number;
    items?: ItemStack[];
    friendship?: number;
  };
}

export interface Quest {
  id: string;
  gameId: string;
  villagerId: string;
  title: string;
  description: string;
  objective: QuestOffer['objective'];
  reward: QuestOffer['reward'];
  status: 'active' | 'completed' | 'expired';
  offeredDay: number;
  deadlineDay?: number;
}

export const MOOD_LIST = [
  'joyful', 'content', 'calm', 'curious', 'amused',
  'worried', 'frustrated', 'sad', 'excited', 'thoughtful',
] as const;
