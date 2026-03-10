import { NextResponse } from 'next/server';
import { loadGameState } from '@/lib/engine/state';
import { runVillagerConversation } from '@/lib/villagers/runner';
import { getMemories, storeMemory, storeConversation, getConversationHistory } from '@/lib/villagers/memory';
import type { VillagerContext } from '@/lib/villagers/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { gameId, villagerId, message } = body as {
      gameId: string;
      villagerId: string;
      message: string;
    };

    if (!gameId || !villagerId || !message) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const state = await loadGameState(gameId);
    if (!state) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }

    const villager = state.villagers.find(v => v.id === villagerId);
    if (!villager) {
      return NextResponse.json({ success: false, error: 'Villager not found' }, { status: 404 });
    }

    // Build context for the villager
    const memories = await getMemories(gameId, villagerId, 20);
    const conversationHistory = await getConversationHistory(gameId, villagerId, 10);

    const ctx: VillagerContext = {
      villager: { ...villager },
      timeOfDay: state.currentPhase,
      currentDay: state.currentDay,
      season: state.currentSeason,
      nearbyEntities: [{ id: 'player', name: state.playerName, type: 'player', distance: 1 }],
      recentEvents: state.recentEvents.slice(-5),
      memories,
      playerRelationship: villager.relationships.player || 0,
    };

    // Get AI response
    const response = await runVillagerConversation(villagerId, message, ctx, conversationHistory);

    // Store conversation
    await storeConversation(gameId, villagerId, state.currentDay, 'player', message);
    await storeConversation(gameId, villagerId, state.currentDay, 'villager', response);

    // Store as memory for the villager
    await storeMemory(gameId, {
      villagerId,
      day: state.currentDay,
      event: `Player said: "${message.slice(0, 100)}". I replied: "${response.slice(0, 100)}"`,
      sentiment: 0.1, // conversations are slightly positive
      about: 'player',
    });

    // Slightly increase relationship
    villager.relationships.player = Math.min(100, (villager.relationships.player || 0) + 1);

    return NextResponse.json({
      success: true,
      response,
      villagerMood: villager.currentMood,
    });
  } catch (error) {
    console.error('Talk failed:', error);
    return NextResponse.json({ success: false, error: 'Conversation failed' }, { status: 500 });
  }
}
