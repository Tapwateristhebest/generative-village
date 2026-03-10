import { NextResponse } from 'next/server';
import { loadGameState, saveGameState } from '@/lib/engine/state';
import { processAction } from '@/lib/engine/actions';
import type { PlayerAction } from '@/lib/engine/actions';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { gameId, action } = body as { gameId: string; action: PlayerAction };

    if (!gameId || !action) {
      return NextResponse.json({ success: false, error: 'Missing gameId or action' }, { status: 400 });
    }

    const state = await loadGameState(gameId);
    if (!state) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }

    const result = processAction(state, action);

    if (result.stateUpdated) {
      await saveGameState(state);
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      interactionTarget: result.interactionTarget,
      gameState: state,
    });
  } catch (error) {
    console.error('Action failed:', error);
    return NextResponse.json({ success: false, error: 'Action failed' }, { status: 500 });
  }
}
