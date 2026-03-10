import { NextResponse } from 'next/server';
import { loadGameState } from '@/lib/engine/state';
import { processTimeTick } from '@/lib/engine/tick';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { gameId } = body as { gameId: string };

    if (!gameId) {
      return NextResponse.json({ success: false, error: 'Missing gameId' }, { status: 400 });
    }

    const state = await loadGameState(gameId);
    if (!state) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }

    const tickResult = await processTimeTick(state);

    return NextResponse.json({
      success: true,
      tickResult,
      gameState: state,
    });
  } catch (error) {
    console.error('Advance failed:', error);
    return NextResponse.json({ success: false, error: 'Advance failed' }, { status: 500 });
  }
}
