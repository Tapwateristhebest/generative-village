import { NextResponse } from 'next/server';
import { loadGameState } from '@/lib/engine/state';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get('gameId');

  if (!gameId) {
    return NextResponse.json({ success: false, error: 'Missing gameId' }, { status: 400 });
  }

  try {
    const state = await loadGameState(gameId);
    if (!state) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, gameState: state });
  } catch (error) {
    console.error('Failed to load game state:', error);
    return NextResponse.json({ success: false, error: 'Failed to load game' }, { status: 500 });
  }
}
