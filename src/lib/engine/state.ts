// ============================================
// Central game state management
// ============================================

import { supabase } from '@/lib/db/supabase';
import type { WorldMap, Position } from '../world/types';
import type { ItemStack } from '../farming/types';
import type { VillagerState, Quest } from '../villagers/types';
import { VILLAGER_DEFINITIONS } from '../villagers/types';
import type { ShopInventory } from '../economy/types';
import { getDefaultShopInventory } from '../economy/types';
import type { TimeOfDay, Season } from '../time/types';
import { generateWorldMap } from '../world/map-generator';

export interface GameState {
  id: string;
  // Time
  currentDay: number;
  currentSeason: Season;
  currentPhase: TimeOfDay;
  // Player
  playerPosition: Position;
  playerGold: number;
  playerEnergy: number;
  playerInventory: ItemStack[];
  playerTools: string[];
  playerName: string;
  // World
  worldMap: WorldMap;
  // Economy
  shopInventory: ShopInventory;
  // Villagers
  villagers: VillagerState[];
  // Quests
  activeQuests: Quest[];
  // Events
  recentEvents: string[];
}

export async function createNewGame(playerName: string = 'Farmer'): Promise<GameState> {
  const worldMap = generateWorldMap();
  const shopInventory = getDefaultShopInventory();

  // Create game record
  const { data: game, error } = await supabase
    .from('village_games')
    .insert({
      player_name: playerName,
      current_day: 1,
      current_season: 'spring',
      current_phase: 'morning',
      player_position: { x: 9, y: 14 },
      player_gold: 500,
      player_energy: 100,
      player_inventory: [],
      player_tools: ['hoe', 'watering_can'],
      world_map: worldMap,
      economy_state: shopInventory,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !game) {
    throw new Error(`Failed to create game: ${error?.message}`);
  }

  // Create villager records
  const villagerStates: VillagerState[] = VILLAGER_DEFINITIONS.map(def => ({
    id: def.id,
    name: def.name,
    emoji: def.emoji,
    position: { ...def.startPosition },
    inventory: [],
    gold: def.defaultGold,
    currentMood: 'calm',
    relationships: {
      player: 0,
      ...Object.fromEntries(
        VILLAGER_DEFINITIONS
          .filter(v => v.id !== def.id)
          .map(v => [v.id, 20 + Math.floor(Math.random() * 30)])
      ),
    },
  }));

  const villagerRows = villagerStates.map(v => ({
    id: v.id,
    game_id: game.id,
    name: v.name,
    position: v.position,
    inventory: v.inventory,
    gold: v.gold,
    current_mood: v.currentMood,
    relationships: v.relationships,
  }));

  await supabase.from('village_villagers').insert(villagerRows);

  // Store initial event
  await supabase.from('village_events').insert({
    game_id: game.id,
    day: 1,
    phase: 'morning',
    event_type: 'game_start',
    actor_id: 'system',
    description: `${playerName} arrived at Willowbrook village on a bright spring morning.`,
  });

  return {
    id: game.id,
    currentDay: 1,
    currentSeason: 'spring',
    currentPhase: 'morning',
    playerPosition: { x: 9, y: 14 },
    playerGold: 500,
    playerEnergy: 100,
    playerInventory: [],
    playerTools: ['hoe', 'watering_can'],
    playerName,
    worldMap,
    shopInventory,
    villagers: villagerStates,
    activeQuests: [],
    recentEvents: [`${playerName} arrived at Willowbrook village on a bright spring morning.`],
  };
}

export async function loadGameState(gameId: string): Promise<GameState | null> {
  const { data: game } = await supabase
    .from('village_games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (!game) return null;

  const { data: villagers } = await supabase
    .from('village_villagers')
    .select('*')
    .eq('game_id', gameId);

  const { data: quests } = await supabase
    .from('village_quests')
    .select('*')
    .eq('game_id', gameId)
    .eq('status', 'active');

  const { data: events } = await supabase
    .from('village_events')
    .select('description')
    .eq('game_id', gameId)
    .order('created_at', { ascending: false })
    .limit(10);

  const villagerDefs = Object.fromEntries(VILLAGER_DEFINITIONS.map(d => [d.id, d]));

  const villagerStates: VillagerState[] = (villagers || []).map(v => ({
    id: v.id,
    name: v.name,
    emoji: villagerDefs[v.id]?.emoji || '🧑',
    position: v.position as Position,
    inventory: v.inventory as ItemStack[],
    gold: v.gold,
    currentMood: v.current_mood,
    relationships: v.relationships as Record<string, number>,
  }));

  return {
    id: game.id,
    currentDay: game.current_day,
    currentSeason: game.current_season as Season,
    currentPhase: game.current_phase as TimeOfDay,
    playerPosition: game.player_position as Position,
    playerGold: game.player_gold,
    playerEnergy: game.player_energy,
    playerInventory: game.player_inventory as ItemStack[],
    playerTools: game.player_tools as string[],
    playerName: game.player_name,
    worldMap: game.world_map as WorldMap,
    shopInventory: game.economy_state as ShopInventory,
    villagers: villagerStates,
    activeQuests: (quests || []).map(q => ({
      id: q.id,
      gameId: q.game_id,
      villagerId: q.villager_id,
      title: q.title,
      description: q.description,
      objective: q.objective as Quest['objective'],
      reward: q.reward as Quest['reward'],
      status: q.status as Quest['status'],
      offeredDay: q.offered_day,
      deadlineDay: q.deadline_day,
    })),
    recentEvents: (events || []).map(e => e.description).reverse(),
  };
}

export async function saveGameState(state: GameState): Promise<void> {
  // Update game record
  await supabase
    .from('village_games')
    .update({
      current_day: state.currentDay,
      current_season: state.currentSeason,
      current_phase: state.currentPhase,
      player_position: state.playerPosition,
      player_gold: state.playerGold,
      player_energy: state.playerEnergy,
      player_inventory: state.playerInventory,
      player_tools: state.playerTools,
      world_map: state.worldMap,
      economy_state: state.shopInventory,
      updated_at: new Date().toISOString(),
    })
    .eq('id', state.id);

  // Update villager records
  for (const v of state.villagers) {
    await supabase
      .from('village_villagers')
      .update({
        position: v.position,
        inventory: v.inventory,
        gold: v.gold,
        current_mood: v.currentMood,
        relationships: v.relationships,
      })
      .eq('id', v.id)
      .eq('game_id', state.id);
  }
}
