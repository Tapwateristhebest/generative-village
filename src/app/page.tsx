'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { GameState } from '@/lib/engine/state';
import type { GameInput } from '@/lib/renderer/input';
import { InputHandler, mapKeyToInput } from '@/lib/renderer/input';
import { createCamera, updateCamera } from '@/lib/renderer/camera';
import type { Camera } from '@/lib/renderer/camera';
import { renderFrame } from '@/lib/renderer/canvas';
import { TILE_SIZE } from '@/lib/renderer/sprites';
import { getPhaseEmoji, getSeasonEmoji } from '@/lib/time/types';
import { SPRING_CROPS, ALL_CROPS } from '@/lib/farming/types';
import type { ItemStack } from '@/lib/farming/types';
import type { Quest } from '@/lib/villagers/types';

// ============================================
// Game Page - Main component
// ============================================

type Screen = 'title' | 'playing' | 'loading';
type Panel = 'none' | 'inventory' | 'shop' | 'quest' | 'dialogue';

export default function VillagePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera | null>(null);
  const inputRef = useRef<InputHandler | null>(null);
  const gameLoopRef = useRef<number>(0);
  const lastInputTime = useRef<number>(0);

  const [screen, setScreen] = useState<Screen>('title');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activePanel, setActivePanel] = useState<Panel>('none');
  const [selectedTool, setSelectedTool] = useState(0);
  const [facingDir, setFacingDir] = useState('down');
  const [message, setMessage] = useState('');
  const [messageTimer, setMessageTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [eventLog, setEventLog] = useState<string[]>([]);

  // Dialogue state
  const [dialogueVillager, setDialogueVillager] = useState<string | null>(null);
  const [dialogueVillagerName, setDialogueVillagerName] = useState('');
  const [dialogueVillagerEmoji, setDialogueVillagerEmoji] = useState('');
  const [dialogueResponse, setDialogueResponse] = useState('');
  const [dialogueInput, setDialogueInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Planting state
  const [showPlantMenu, setShowPlantMenu] = useState(false);

  const tools = gameState?.playerTools || ['hoe', 'watering_can'];
  const toolEmojis: Record<string, string> = { hoe: '⛏️', watering_can: '💧', axe: '🪓', pickaxe: '⛏️' };
  const toolNames: Record<string, string> = { hoe: 'Hoe', watering_can: 'Water', axe: 'Axe', pickaxe: 'Pick' };

  // Show a temporary message
  const showMessage = useCallback((msg: string, duration = 2000) => {
    if (messageTimer) clearTimeout(messageTimer);
    setMessage(msg);
    const timer = setTimeout(() => setMessage(''), duration);
    setMessageTimer(timer);
  }, [messageTimer]);

  // API calls
  const apiCall = useCallback(async (endpoint: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/game/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }, []);

  // Start new game
  const startNewGame = useCallback(async () => {
    setScreen('loading');
    try {
      const data = await apiCall('new-game', { playerName: 'Farmer' });
      if (data.success) {
        setGameState(data.gameState);
        setScreen('playing');
        setEventLog(['Welcome to Willowbrook Village! Use WASD to move, E to interact, Space for tools.']);
        showMessage('Welcome to Willowbrook Village!', 3000);
      } else {
        showMessage('Failed to create game');
        setScreen('title');
      }
    } catch {
      showMessage('Error creating game');
      setScreen('title');
    }
  }, [apiCall, showMessage]);

  // Send player action
  const sendAction = useCallback(async (action: Record<string, unknown>) => {
    if (!gameState || isProcessing) return;
    setIsProcessing(true);
    try {
      const data = await apiCall('action', { gameId: gameState.id, action });
      if (data.success && data.gameState) {
        setGameState(data.gameState);
        if (data.message) showMessage(data.message);
        if (data.interactionTarget) {
          if (data.interactionTarget.type === 'villager') {
            const v = data.gameState.villagers.find((v: { id: string }) => v.id === data.interactionTarget.id);
            setDialogueVillager(data.interactionTarget.id);
            setDialogueVillagerName(v?.name || 'Villager');
            setDialogueVillagerEmoji(v?.emoji || '🧑');
            setDialogueResponse(`Hello! What brings you here today?`);
            setActivePanel('dialogue');
          } else if (data.interactionTarget.type === 'shop') {
            setActivePanel('shop');
          }
        }
      } else if (data.message) {
        showMessage(data.message);
      }
    } catch { showMessage('Action failed'); }
    setIsProcessing(false);
  }, [gameState, isProcessing, apiCall, showMessage]);

  // Advance time
  const advanceTime = useCallback(async () => {
    if (!gameState || isProcessing) return;
    setIsProcessing(true);
    showMessage('Time passes...', 1500);
    try {
      const data = await apiCall('advance', { gameId: gameState.id });
      if (data.success && data.gameState) {
        setGameState(data.gameState);
        const tr = data.tickResult;
        const newEvents: string[] = [];
        if (tr.newDay) newEvents.push(`☀️ Day ${data.gameState.currentDay} begins!`);
        if (tr.newSeason) newEvents.push(`🌸 New season: ${data.gameState.currentSeason}!`);
        if (tr.cropsGrown > 0) newEvents.push(`🌱 ${tr.cropsGrown} crops grew!`);
        if (tr.cropsDied > 0) newEvents.push(`💀 ${tr.cropsDied} crops withered!`);
        for (const va of tr.villagerActions) {
          if (va.dialogue) newEvents.push(`${va.villagerId}: "${va.dialogue}"`);
        }
        for (const ev of tr.events) newEvents.push(ev);
        setEventLog(prev => [...prev, ...newEvents].slice(-30));
      }
    } catch { showMessage('Failed to advance time'); }
    setIsProcessing(false);
  }, [gameState, isProcessing, apiCall, showMessage]);

  // Talk to villager
  const sendChat = useCallback(async () => {
    if (!gameState || !dialogueVillager || !dialogueInput.trim() || isAiThinking) return;
    setIsAiThinking(true);
    const msg = dialogueInput.trim();
    setDialogueInput('');
    setDialogueResponse('...');
    try {
      const data = await apiCall('talk', { gameId: gameState.id, villagerId: dialogueVillager, message: msg });
      if (data.success) {
        setDialogueResponse(data.response);
      } else {
        setDialogueResponse('*looks confused*');
      }
    } catch {
      setDialogueResponse('*gets distracted*');
    }
    setIsAiThinking(false);
  }, [gameState, dialogueVillager, dialogueInput, isAiThinking, apiCall]);

  // Buy from shop
  const buyItem = useCallback(async (itemId: string) => {
    if (!gameState) return;
    try {
      const data = await apiCall('shop', { gameId: gameState.id, type: 'buy', itemId, quantity: 1 });
      if (data.success && data.gameState) {
        setGameState(data.gameState);
        showMessage(data.message);
      } else {
        showMessage(data.message || 'Cannot buy');
      }
    } catch { showMessage('Transaction failed'); }
  }, [gameState, apiCall, showMessage]);

  // Sell item
  const sellItem = useCallback(async (itemId: string) => {
    if (!gameState) return;
    try {
      const data = await apiCall('shop', { gameId: gameState.id, type: 'sell', itemId, quantity: 1 });
      if (data.success && data.gameState) {
        setGameState(data.gameState);
        showMessage(data.message);
      } else {
        showMessage(data.message || 'Cannot sell');
      }
    } catch { showMessage('Transaction failed'); }
  }, [gameState, apiCall, showMessage]);

  // Plant a crop
  const plantCrop = useCallback(async (cropId: string) => {
    setShowPlantMenu(false);
    await sendAction({ type: 'plant', cropId });
  }, [sendAction]);

  // Process game input
  const processInput = useCallback((input: GameInput) => {
    if (activePanel !== 'none' && input.type !== 'toggle_inventory' && input.type !== 'toggle_quests') return;

    switch (input.type) {
      case 'move':
        setFacingDir(input.direction);
        sendAction({ type: 'move', direction: input.direction });
        break;
      case 'interact':
        sendAction({ type: 'interact' });
        break;
      case 'use_tool': {
        const tool = tools[selectedTool];
        if (tool === 'hoe' || tool === 'watering_can') {
          sendAction({ type: 'use_tool', tool });
        }
        break;
      }
      case 'select_tool':
        if (input.index < tools.length) setSelectedTool(input.index);
        break;
      case 'toggle_inventory':
        setActivePanel(p => p === 'inventory' ? 'none' : 'inventory');
        break;
      case 'toggle_quests':
        setActivePanel(p => p === 'quest' ? 'none' : 'quest');
        break;
      case 'sleep':
        sendAction({ type: 'sleep' });
        break;
      case 'advance_time':
        advanceTime();
        break;
    }
  }, [activePanel, tools, selectedTool, sendAction, advanceTime]);

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (cameraRef.current) {
        cameraRef.current.viewportWidth = canvas.width;
        cameraRef.current.viewportHeight = canvas.height;
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [screen]);

  // Game loop
  useEffect(() => {
    if (screen !== 'playing' || !gameState) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!cameraRef.current) {
      cameraRef.current = createCamera(canvas.width, canvas.height);
    }

    if (!inputRef.current) {
      inputRef.current = new InputHandler();
      inputRef.current.attach();
    }

    const loop = () => {
      // Process input (with rate limiting for movement)
      const now = Date.now();
      const input = inputRef.current?.pollInput();
      if (input && now - lastInputTime.current > 120) {
        lastInputTime.current = now;
        processInput(input);
      }

      // Update camera
      if (cameraRef.current && gameState) {
        updateCamera(cameraRef.current, gameState.playerPosition.x, gameState.playerPosition.y);
      }

      // Render
      if (ctx && gameState && cameraRef.current) {
        renderFrame(ctx, gameState, cameraRef.current, tools[selectedTool], facingDir);
      }

      gameLoopRef.current = requestAnimationFrame(loop);
    };

    gameLoopRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(gameLoopRef.current);
    };
  }, [screen, gameState, processInput, tools, selectedTool, facingDir]);

  // Cleanup input handler
  useEffect(() => {
    return () => {
      inputRef.current?.detach();
    };
  }, []);

  // ============================================
  // TITLE SCREEN
  // ============================================
  if (screen === 'title') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', gap: 24, background: 'linear-gradient(180deg, #1a3a1e 0%, #1a1a2e 100%)',
      }}>
        <div style={{ fontSize: 64, marginBottom: -10 }}>🏡</div>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: '#7dcea0', margin: 0 }}>Generative Village</h1>
        <p style={{ color: '#888', fontSize: 14, margin: 0, maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
          A farming simulator where every villager is an AI agent with memories, personality, and autonomy.
        </p>
        <button
          onClick={startNewGame}
          style={{
            marginTop: 20, padding: '14px 40px', fontSize: 16, fontWeight: 600,
            background: '#3a7a2e', color: '#fff', border: 'none', borderRadius: 8,
            cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 1,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#4a9a3e')}
          onMouseLeave={e => (e.currentTarget.style.background = '#3a7a2e')}
        >
          New Game
        </button>
        <div style={{ marginTop: 30, color: '#555', fontSize: 11, textAlign: 'center', lineHeight: 1.8 }}>
          <div>WASD - Move | E - Interact | Space - Use Tool | T - Advance Time</div>
          <div>1-4 - Select Tool | I - Inventory | Q - Quests | P - Plant</div>
        </div>
      </div>
    );
  }

  // ============================================
  // LOADING SCREEN
  // ============================================
  if (screen === 'loading') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', gap: 16, background: '#1a1a2e',
      }}>
        <div style={{ fontSize: 48, animation: 'spin 1s linear infinite' }}>🌱</div>
        <p style={{ color: '#7dcea0', fontSize: 16 }}>Growing your village...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ============================================
  // GAME SCREEN
  // ============================================
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

      {/* HUD - Top Bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 16px', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        fontSize: 13, zIndex: 10,
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span>{getSeasonEmoji(gameState?.currentSeason || 'spring')} {gameState?.currentSeason} Day {gameState?.currentDay}</span>
          <span>{getPhaseEmoji(gameState?.currentPhase || 'morning')} {gameState?.currentPhase}</span>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span>💰 {gameState?.playerGold}g</span>
          <span>⚡ {gameState?.playerEnergy}/100</span>
        </div>
      </div>

      {/* Tool Bar - Bottom */}
      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 4, padding: '6px 10px', background: 'rgba(0,0,0,0.75)',
        borderRadius: 8, backdropFilter: 'blur(4px)', zIndex: 10,
      }}>
        {tools.map((tool, i) => (
          <button
            key={tool}
            onClick={() => setSelectedTool(i)}
            style={{
              width: 44, height: 44, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2,
              background: i === selectedTool ? 'rgba(58, 122, 46, 0.8)' : 'rgba(255,255,255,0.1)',
              border: i === selectedTool ? '2px solid #7dcea0' : '2px solid transparent',
              borderRadius: 6, cursor: 'pointer', fontSize: 18,
              color: '#fff', fontFamily: 'inherit',
            }}
          >
            <span>{toolEmojis[tool] || '🔨'}</span>
            <span style={{ fontSize: 8 }}>{i + 1}</span>
          </button>
        ))}
        <div style={{ width: 1, background: 'rgba(255,255,255,0.2)', margin: '4px 4px' }} />
        <button
          onClick={() => setShowPlantMenu(!showPlantMenu)}
          style={{
            width: 44, height: 44, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 2,
            background: showPlantMenu ? 'rgba(58, 122, 46, 0.8)' : 'rgba(255,255,255,0.1)',
            border: '2px solid transparent', borderRadius: 6, cursor: 'pointer', fontSize: 18,
            color: '#fff', fontFamily: 'inherit',
          }}
          title="Plant (P)"
        >
          <span>🌱</span>
          <span style={{ fontSize: 8 }}>P</span>
        </button>
        <button
          onClick={advanceTime}
          disabled={isProcessing}
          style={{
            width: 44, height: 44, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 2,
            background: 'rgba(255,255,255,0.1)',
            border: '2px solid transparent', borderRadius: 6, cursor: 'pointer', fontSize: 18,
            color: '#fff', fontFamily: 'inherit', opacity: isProcessing ? 0.5 : 1,
          }}
          title="Advance Time (T)"
        >
          <span>⏩</span>
          <span style={{ fontSize: 8 }}>T</span>
        </button>
      </div>

      {/* Plant Menu */}
      {showPlantMenu && (
        <div style={{
          position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 8, padding: 12, background: 'rgba(0,0,0,0.85)',
          borderRadius: 8, backdropFilter: 'blur(4px)', zIndex: 20,
        }}>
          {SPRING_CROPS.map(crop => {
            const seedId = `${crop.id}_seed`;
            const hasSeed = gameState?.playerInventory.find(i => i.itemId === seedId);
            return (
              <button
                key={crop.id}
                onClick={() => plantCrop(crop.id)}
                disabled={!hasSeed || (hasSeed.quantity || 0) <= 0}
                style={{
                  padding: '8px 12px', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6,
                  cursor: hasSeed ? 'pointer' : 'not-allowed', color: '#fff',
                  fontFamily: 'inherit', fontSize: 12, opacity: hasSeed ? 1 : 0.4,
                }}
              >
                <span style={{ fontSize: 22 }}>{crop.stages[crop.stages.length - 1]}</span>
                <span>{crop.name}</span>
                <span style={{ fontSize: 10, color: '#aaa' }}>x{hasSeed?.quantity || 0}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Message Toast */}
      {message && (
        <div style={{
          position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 20px', background: 'rgba(0,0,0,0.8)', borderRadius: 6,
          fontSize: 14, color: '#7dcea0', zIndex: 30, whiteSpace: 'nowrap',
        }}>
          {message}
        </div>
      )}

      {/* Event Log - Right Side */}
      <div style={{
        position: 'absolute', top: 44, right: 8, width: 280,
        maxHeight: 300, overflowY: 'auto', padding: 8,
        background: 'rgba(0,0,0,0.5)', borderRadius: 6,
        fontSize: 11, lineHeight: 1.5, zIndex: 10,
      }}>
        {eventLog.slice(-8).map((ev, i) => (
          <div key={i} style={{ color: i === eventLog.length - 1 ? '#7dcea0' : '#888', marginBottom: 2 }}>
            {ev}
          </div>
        ))}
      </div>

      {/* Controls hint - bottom left */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        padding: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 6,
        fontSize: 10, color: '#666', lineHeight: 1.6, zIndex: 10,
      }}>
        <div>WASD Move | E Interact</div>
        <div>Space Tool | T Time</div>
        <div>I Inventory | Q Quests</div>
      </div>

      {/* ======== PANELS ======== */}

      {/* Dialogue Panel */}
      {activePanel === 'dialogue' && dialogueVillager && (
        <div style={{
          position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          width: 500, maxWidth: '90vw', padding: 16, background: 'rgba(10,10,30,0.95)',
          border: '2px solid #3a5a3e', borderRadius: 10, zIndex: 50,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 28 }}>{dialogueVillagerEmoji}</span>
              <span style={{ fontWeight: 600, color: '#7dcea0' }}>{dialogueVillagerName}</span>
            </div>
            <button
              onClick={() => { setActivePanel('none'); setDialogueVillager(null); }}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}
            >✕</button>
          </div>
          <div style={{
            padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 6,
            minHeight: 60, marginBottom: 10, fontSize: 14, lineHeight: 1.6,
            color: isAiThinking ? '#888' : '#e0e0e0',
          }}>
            {dialogueResponse}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={dialogueInput}
              onChange={e => setDialogueInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendChat(); }}
              placeholder="Say something..."
              disabled={isAiThinking}
              style={{
                flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
                color: '#fff', fontFamily: 'inherit', fontSize: 13, outline: 'none',
              }}
            />
            <button
              onClick={sendChat}
              disabled={isAiThinking || !dialogueInput.trim()}
              style={{
                padding: '8px 16px', background: '#3a7a2e', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                opacity: isAiThinking ? 0.5 : 1,
              }}
            >
              {isAiThinking ? '...' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {/* Inventory Panel */}
      {activePanel === 'inventory' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 400, maxWidth: '90vw', padding: 20, background: 'rgba(10,10,30,0.95)',
          border: '2px solid #5a5a3e', borderRadius: 10, zIndex: 50,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: '#daa520' }}>🎒 Inventory</h3>
            <button
              onClick={() => setActivePanel('none')}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}
            >✕</button>
          </div>
          {(!gameState?.playerInventory || gameState.playerInventory.length === 0) ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>Your bag is empty.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {gameState.playerInventory.map(item => (
                <div key={item.itemId} style={{
                  padding: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 6,
                  textAlign: 'center', fontSize: 12,
                }}>
                  <div style={{ fontSize: 22 }}>
                    {getCropEmoji(item.itemId)}
                  </div>
                  <div style={{ marginTop: 4, color: '#ccc' }}>{item.name}</div>
                  <div style={{ color: '#888' }}>x{item.quantity}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Shop Panel */}
      {activePanel === 'shop' && gameState && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 500, maxWidth: '90vw', padding: 20, background: 'rgba(10,10,30,0.95)',
          border: '2px solid #daa520', borderRadius: 10, zIndex: 50,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: '#daa520' }}>🏪 Mae&apos;s General Store</h3>
            <button
              onClick={() => setActivePanel('none')}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}
            >✕</button>
          </div>
          <p style={{ color: '#888', fontSize: 12, margin: '0 0 12px' }}>💰 Your gold: {gameState.playerGold}g</p>

          <h4 style={{ color: '#7dcea0', margin: '12px 0 8px', fontSize: 13 }}>Buy</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {gameState.shopInventory.items.filter(i => i.stock !== 0).map(item => (
              <button
                key={item.itemId}
                onClick={() => buyItem(item.itemId)}
                disabled={gameState.playerGold < item.price}
                style={{
                  padding: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, color: '#ccc', cursor: 'pointer', fontFamily: 'inherit',
                  textAlign: 'left', fontSize: 12, display: 'flex', justifyContent: 'space-between',
                  opacity: gameState.playerGold < item.price ? 0.4 : 1,
                }}
              >
                <span>{item.name}</span>
                <span style={{ color: '#daa520' }}>{item.price}g</span>
              </button>
            ))}
          </div>

          {gameState.playerInventory.length > 0 && (
            <>
              <h4 style={{ color: '#e07070', margin: '16px 0 8px', fontSize: 13 }}>Sell</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {gameState.playerInventory.filter(i => i.category !== 'tool').map(item => (
                  <button
                    key={item.itemId}
                    onClick={() => sellItem(item.itemId)}
                    style={{
                      padding: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6, color: '#ccc', cursor: 'pointer', fontFamily: 'inherit',
                      textAlign: 'left', fontSize: 12, display: 'flex', justifyContent: 'space-between',
                    }}
                  >
                    <span>{item.name} x{item.quantity}</span>
                    <span style={{ color: '#e07070' }}>Sell</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Quest Panel */}
      {activePanel === 'quest' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 400, maxWidth: '90vw', padding: 20, background: 'rgba(10,10,30,0.95)',
          border: '2px solid #6a5acd', borderRadius: 10, zIndex: 50,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: '#9b8ec4' }}>📜 Quests</h3>
            <button
              onClick={() => setActivePanel('none')}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}
            >✕</button>
          </div>
          {(!gameState?.activeQuests || gameState.activeQuests.length === 0) ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No active quests. Talk to villagers!</p>
          ) : (
            gameState.activeQuests.map(quest => (
              <div key={quest.id} style={{
                padding: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 6,
                marginBottom: 8, fontSize: 12,
              }}>
                <div style={{ fontWeight: 600, color: '#9b8ec4', marginBottom: 4 }}>{quest.title}</div>
                <div style={{ color: '#aaa', marginBottom: 4 }}>{quest.description}</div>
                <div style={{ color: '#666', fontSize: 11 }}>
                  From: {quest.villagerId.replace(/_/g, ' ')} | Reward: {quest.reward.gold}g
                  {quest.reward.friendship ? ` +${quest.reward.friendship} friendship` : ''}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function getCropEmoji(itemId: string): string {
  const emojiMap: Record<string, string> = {
    turnip: '🥕', potato: '🥔', strawberry: '🍓', parsnip: '🥬',
    turnip_seed: '🌱', potato_seed: '🌱', strawberry_seed: '🌱', parsnip_seed: '🌱',
    wild_herb: '🌿', wild_berry: '🫐', mushroom: '🍄', moonflower: '🌸',
    hoe: '⛏️', watering_can: '💧', axe: '🪓',
  };
  return emojiMap[itemId] || '📦';
}
