// ============================================
// Villager memory management
// ============================================

import { supabase } from '@/lib/db/supabase';
import type { VillagerMemory } from './types';

export async function storeMemory(
  gameId: string,
  memory: VillagerMemory
): Promise<void> {
  await supabase.from('village_memories').insert({
    game_id: gameId,
    villager_id: memory.villagerId,
    day: memory.day,
    event: memory.event,
    sentiment: memory.sentiment,
    about: memory.about || null,
  });
}

export async function getMemories(
  gameId: string,
  villagerId: string,
  limit: number = 20
): Promise<VillagerMemory[]> {
  const { data } = await supabase
    .from('village_memories')
    .select('*')
    .eq('game_id', gameId)
    .eq('villager_id', villagerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data) return [];

  return data.map(row => ({
    id: row.id,
    villagerId: row.villager_id,
    day: row.day,
    event: row.event,
    sentiment: Number(row.sentiment),
    about: row.about,
  }));
}

export async function getMemoriesAbout(
  gameId: string,
  villagerId: string,
  aboutId: string,
  limit: number = 10
): Promise<VillagerMemory[]> {
  const { data } = await supabase
    .from('village_memories')
    .select('*')
    .eq('game_id', gameId)
    .eq('villager_id', villagerId)
    .eq('about', aboutId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data) return [];

  return data.map(row => ({
    id: row.id,
    villagerId: row.villager_id,
    day: row.day,
    event: row.event,
    sentiment: Number(row.sentiment),
    about: row.about,
  }));
}

export async function storeConversation(
  gameId: string,
  villagerId: string,
  day: number,
  role: 'player' | 'villager',
  content: string
): Promise<void> {
  await supabase.from('village_conversations').insert({
    game_id: gameId,
    villager_id: villagerId,
    day,
    role,
    content,
  });
}

export async function getConversationHistory(
  gameId: string,
  villagerId: string,
  limit: number = 10
): Promise<Array<{ role: string; content: string }>> {
  const { data } = await supabase
    .from('village_conversations')
    .select('role, content')
    .eq('game_id', gameId)
    .eq('villager_id', villagerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data) return [];
  return data.reverse();
}
