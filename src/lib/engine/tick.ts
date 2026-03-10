// ============================================
// Time advancement + villager AI tick
// ============================================

import type { GameState } from './state';
import { saveGameState } from './state';
import { getNextPhase, SEASON_LENGTH } from '../time/types';
import type { Season } from '../time/types';
import { advanceCrops } from '../farming/engine';
import { runVillagerTick, runGossipSession } from '../villagers/runner';
import { getMemories, storeMemory } from '../villagers/memory';
import { VILLAGER_DEFINITIONS } from '../villagers/types';
import type { VillagerContext, VillagerMemory } from '../villagers/types';
import { getNextStep } from '../world/pathfinding';
import { supabase } from '@/lib/db/supabase';

export interface TickResult {
  newDay: boolean;
  newSeason: boolean;
  cropsGrown: number;
  cropsDied: number;
  villagerActions: Array<{ villagerId: string; description: string; dialogue?: string }>;
  events: string[];
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

async function buildVillagerContext(state: GameState, villagerId: string): Promise<VillagerContext> {
  const villager = state.villagers.find(v => v.id === villagerId)!;
  const memories = await getMemories(state.id, villagerId, 20);

  const nearbyEntities: VillagerContext['nearbyEntities'] = [];

  // Check player proximity
  const playerDist = distance(villager.position, state.playerPosition);
  if (playerDist <= 8) {
    nearbyEntities.push({ id: 'player', name: state.playerName, type: 'player', distance: playerDist });
  }

  // Check other villager proximity
  for (const other of state.villagers) {
    if (other.id === villagerId) continue;
    const d = distance(villager.position, other.position);
    if (d <= 8) {
      nearbyEntities.push({ id: other.id, name: other.name, type: 'villager', distance: d });
    }
  }

  return {
    villager: { ...villager },
    timeOfDay: state.currentPhase,
    currentDay: state.currentDay,
    season: state.currentSeason,
    nearbyEntities,
    recentEvents: state.recentEvents.slice(-5),
    memories,
    playerRelationship: villager.relationships.player || 0,
  };
}

export async function processTimeTick(state: GameState): Promise<TickResult> {
  const result: TickResult = {
    newDay: false,
    newSeason: false,
    cropsGrown: 0,
    cropsDied: 0,
    villagerActions: [],
    events: [],
  };

  // Advance time phase
  const { phase: nextPhase, newDay } = getNextPhase(state.currentPhase);
  state.currentPhase = nextPhase;
  result.newDay = newDay;

  if (newDay) {
    state.currentDay += 1;
    state.playerEnergy = 100; // Reset energy

    // Check for season change
    if (state.currentDay > SEASON_LENGTH) {
      state.currentDay = 1;
      const seasons: Season[] = ['spring', 'summer', 'fall', 'winter'];
      const idx = seasons.indexOf(state.currentSeason);
      state.currentSeason = seasons[(idx + 1) % seasons.length];
      result.newSeason = true;
      result.events.push(`A new season begins: ${state.currentSeason}!`);
    }

    // Advance crop growth
    const cropResult = advanceCrops(state.worldMap.tiles);
    result.cropsGrown = cropResult.grownCount;
    result.cropsDied = cropResult.diedCount;

    if (cropResult.grownCount > 0) {
      result.events.push(`${cropResult.grownCount} crops grew overnight.`);
    }
    if (cropResult.diedCount > 0) {
      result.events.push(`${cropResult.diedCount} crops withered from lack of water!`);
    }

    // Replenish some forageable items in the forest
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < state.worldMap.width; x++) {
        const tile = state.worldMap.tiles[y][x];
        if (tile.type === 'grass' && !tile.forageable && Math.random() < 0.05) {
          const items = ['wild_herb', 'wild_berry', 'mushroom'];
          tile.forageable = items[Math.floor(Math.random() * items.length)];
          tile.interactable = true;
        }
      }
    }
  }

  // Run villager AI ticks (one decision per villager per phase)
  const villagerPromises = state.villagers.map(async (villager) => {
    try {
      const ctx = await buildVillagerContext(state, villager.id);
      const decision = await runVillagerTick(villager.id, ctx);

      let description = '';

      // Process the decision
      switch (decision.action.type) {
        case 'move': {
          const target = decision.action.target;
          const nextPos = getNextStep(state.worldMap.tiles, villager.position, target);
          if (nextPos) {
            // Check no other entity at that position
            const occupied = state.villagers.some(v => v.id !== villager.id && v.position.x === nextPos.x && v.position.y === nextPos.y) ||
              (state.playerPosition.x === nextPos.x && state.playerPosition.y === nextPos.y);
            if (!occupied) {
              villager.position = nextPos;
            }
          }
          description = `${villager.name} is walking around the village.`;
          break;
        }
        case 'talk': {
          const talkAction = decision.action as { type: 'talk'; to: string; message: string };
          description = `${villager.name} said to ${talkAction.to}: "${talkAction.message}"`;
          // Store as memory for the target
          const targetVillager = state.villagers.find(v => v.id === talkAction.to || v.name.toLowerCase() === talkAction.to.toLowerCase());
          if (targetVillager) {
            await storeMemory(state.id, {
              villagerId: targetVillager.id,
              day: state.currentDay,
              event: `${villager.name} said: "${talkAction.message}"`,
              sentiment: 0.1,
              about: villager.id,
            });
          }
          break;
        }
        case 'quest_offer': {
          if (decision.action.quest) {
            const quest = decision.action.quest;
            await supabase.from('village_quests').insert({
              game_id: state.id,
              villager_id: villager.id,
              title: quest.title,
              description: quest.description,
              objective: quest.objective,
              reward: quest.reward,
              status: 'active',
              offered_day: state.currentDay,
            });
            description = `${villager.name} has a new quest: "${quest.title}"`;
            result.events.push(description);
          }
          break;
        }
        case 'idle': {
          description = `${villager.name} is ${decision.action.reason.toLowerCase()}.`;
          break;
        }
        default: {
          description = `${villager.name} is going about their day.`;
        }
      }

      // Update mood
      if (decision.mood) {
        villager.currentMood = decision.mood;
      }

      return {
        villagerId: villager.id,
        description,
        dialogue: decision.dialogue,
      };
    } catch (error) {
      console.error(`Villager ${villager.id} tick error:`, error);
      return {
        villagerId: villager.id,
        description: `${villager.name} is quietly going about their day.`,
      };
    }
  });

  result.villagerActions = await Promise.all(villagerPromises);

  // Run gossip session once per day (at evening)
  if (state.currentPhase === 'evening') {
    try {
      const villagerNames = Object.fromEntries(state.villagers.map(v => [v.id, v.name]));
      const gossip = await runGossipSession(
        state.villagers.map(v => v.id),
        villagerNames,
        state.recentEvents.slice(-5),
        state.currentDay,
        state.currentSeason
      );

      for (const g of gossip) {
        await storeMemory(state.id, {
          villagerId: g.villagerId,
          day: state.currentDay,
          event: `In village gossip, I said: "${g.message}"`,
          sentiment: 0,
          about: g.about,
        });
        result.events.push(`${villagerNames[g.villagerId] || g.villagerId}: "${g.message}"`);
      }
    } catch (error) {
      console.error('Gossip session error:', error);
    }
  }

  // Store events
  for (const event of result.events) {
    await supabase.from('village_events').insert({
      game_id: state.id,
      day: state.currentDay,
      phase: state.currentPhase,
      event_type: 'tick',
      actor_id: 'system',
      description: event,
    });
  }

  // Update recent events in state
  state.recentEvents = [...state.recentEvents, ...result.events].slice(-20);

  // Save state
  await saveGameState(state);

  return result;
}
