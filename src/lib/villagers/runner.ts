// ============================================
// Villager AI runner - Claude Haiku calls
// ============================================

import Anthropic from '@anthropic-ai/sdk';
import { VILLAGER_PROMPTS, VILLAGER_RESPONSE_FORMAT, CONVERSATION_FORMAT } from './prompts';
import type { VillagerContext, VillagerDecision, VillagerMemory } from './types';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const MODEL = 'claude-haiku-4-5-20251001';

function buildVillagerContextString(ctx: VillagerContext): string {
  const lines: string[] = [
    `=== CURRENT SITUATION ===`,
    `Day ${ctx.currentDay} of ${ctx.season}, ${ctx.timeOfDay}`,
    `You are at position (${ctx.villager.position.x}, ${ctx.villager.position.y})`,
    `Your mood: ${ctx.villager.currentMood}`,
    `Your gold: ${ctx.villager.gold}`,
    `Your inventory: ${ctx.villager.inventory.length > 0 ? ctx.villager.inventory.map(i => `${i.name} x${i.quantity}`).join(', ') : 'empty'}`,
    ``,
  ];

  if (ctx.nearbyEntities.length > 0) {
    lines.push(`=== NEARBY ===`);
    for (const e of ctx.nearbyEntities) {
      lines.push(`- ${e.name} (${e.type}) is ${e.distance} tiles away`);
    }
    lines.push(``);
  }

  if (ctx.recentEvents.length > 0) {
    lines.push(`=== RECENT EVENTS ===`);
    for (const e of ctx.recentEvents) {
      lines.push(`- ${e}`);
    }
    lines.push(``);
  }

  if (ctx.memories.length > 0) {
    lines.push(`=== YOUR MEMORIES ===`);
    for (const m of ctx.memories.slice(-15)) {
      const sentimentLabel = m.sentiment > 0.3 ? '(positive)' : m.sentiment < -0.3 ? '(negative)' : '(neutral)';
      lines.push(`- Day ${m.day}: ${m.event} ${sentimentLabel}`);
    }
    lines.push(``);
  }

  lines.push(`Player relationship: ${ctx.playerRelationship}/100`);

  return lines.join('\n');
}

export async function runVillagerTick(
  villagerId: string,
  ctx: VillagerContext
): Promise<VillagerDecision> {
  const systemPrompt = VILLAGER_PROMPTS[villagerId];
  if (!systemPrompt) {
    return { action: { type: 'idle', reason: 'Unknown villager' }, mood: 'calm' };
  }

  const contextString = buildVillagerContextString(ctx);

  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 500,
      system: `${systemPrompt}\n\n${VILLAGER_RESPONSE_FORMAT}`,
      messages: [
        { role: 'user', content: `Here is your current situation. Decide what to do:\n\n${contextString}` },
      ],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    return parseVillagerResponse(text);
  } catch (error) {
    console.error(`Villager ${villagerId} AI error:`, error);
    return { action: { type: 'idle', reason: 'Thinking...' }, mood: 'calm' };
  }
}

export async function runVillagerConversation(
  villagerId: string,
  playerMessage: string,
  ctx: VillagerContext,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<string> {
  const systemPrompt = VILLAGER_PROMPTS[villagerId];
  if (!systemPrompt) return "...";

  const contextString = buildVillagerContextString(ctx);

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Add recent conversation history
  for (const msg of conversationHistory.slice(-6)) {
    messages.push({
      role: msg.role === 'player' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  // Add current player message
  messages.push({ role: 'user', content: playerMessage });

  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 300,
      system: `${systemPrompt}\n\n${CONVERSATION_FORMAT}\n\nCurrent context:\n${contextString}`,
      messages,
    });

    return response.content[0]?.type === 'text' ? response.content[0].text : '...';
  } catch (error) {
    console.error(`Villager ${villagerId} conversation error:`, error);
    return "Sorry, I got distracted for a moment. What were you saying?";
  }
}

function parseVillagerResponse(text: string): VillagerDecision {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { action: { type: 'idle', reason: 'Lost in thought' }, mood: 'calm' };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const decision: VillagerDecision = {
      action: parsed.action || { type: 'idle', reason: 'Thinking' },
      dialogue: parsed.dialogue || undefined,
      internalThought: parsed.internalThought || undefined,
      mood: parsed.mood || 'calm',
    };

    // Validate action type
    const validTypes = ['move', 'farm', 'talk', 'gift', 'quest_offer', 'idle'];
    if (!validTypes.includes(decision.action.type)) {
      decision.action = { type: 'idle', reason: 'Considering options' };
    }

    return decision;
  } catch {
    return { action: { type: 'idle', reason: 'Deep in thought' }, mood: 'calm' };
  }
}

export async function runGossipSession(
  villagerIds: string[],
  villagerNames: Record<string, string>,
  recentEvents: string[],
  day: number,
  season: string
): Promise<Array<{ villagerId: string; message: string; about?: string }>> {
  const villagerList = villagerIds.map(id => `${villagerNames[id]} (${id})`).join(', ');

  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 600,
      system: `You are the narrator of a village scene. Generate a short conversation between these villagers: ${villagerList}. They are chatting in the village square on Day ${day} of ${season}. Keep each line to 1 sentence. 3-5 exchanges total.`,
      messages: [
        {
          role: 'user',
          content: `Recent events in the village:\n${recentEvents.join('\n')}\n\nGenerate a natural conversation as JSON array:\n[{"villagerId": "elder_oak", "message": "...", "about": "player_or_villager_id"}]\n\nOnly output the JSON array, nothing else.`,
        },
      ],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Gossip session error:', error);
    return [];
  }
}

export async function generateQuest(
  villagerId: string,
  ctx: VillagerContext
): Promise<VillagerDecision['action'] | null> {
  const systemPrompt = VILLAGER_PROMPTS[villagerId];
  if (!systemPrompt) return null;

  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 400,
      system: `${systemPrompt}\n\nYou want to offer the player a quest. Generate a quest that fits your personality and current needs.`,
      messages: [
        {
          role: 'user',
          content: `Day ${ctx.currentDay} of ${ctx.season}. Player relationship: ${ctx.playerRelationship}/100.\n\nGenerate a quest offer as JSON:\n{"type": "quest_offer", "quest": {"title": "...", "description": "...", "objective": {"type": "deliver|harvest|forage", "itemId": "turnip|potato|strawberry|parsnip|wild_herb|mushroom", "quantity": N}, "reward": {"gold": N, "friendship": N}}}\n\nOnly output the JSON.`,
        },
      ],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.type === 'quest_offer') return parsed;
    return null;
  } catch {
    return null;
  }
}
