import { NextResponse } from 'next/server';
import { createNewGame } from '@/lib/engine/state';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const playerName = body.playerName || 'Farmer';

    const state = await createNewGame(playerName);

    return NextResponse.json({ success: true, gameState: state });
  } catch (error) {
    console.error('Failed to create new game:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create game' },
      { status: 500 }
    );
  }
}
