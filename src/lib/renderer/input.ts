// ============================================
// Keyboard input handler
// ============================================

export type GameInput =
  | { type: 'move'; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'interact' }
  | { type: 'use_tool' }
  | { type: 'toggle_inventory' }
  | { type: 'toggle_quests' }
  | { type: 'select_tool'; index: number }
  | { type: 'sleep' }
  | { type: 'advance_time' }
  | { type: 'none' };

const KEY_MAP: Record<string, GameInput> = {
  'ArrowUp':    { type: 'move', direction: 'up' },
  'ArrowDown':  { type: 'move', direction: 'down' },
  'ArrowLeft':  { type: 'move', direction: 'left' },
  'ArrowRight': { type: 'move', direction: 'right' },
  'w':          { type: 'move', direction: 'up' },
  'W':          { type: 'move', direction: 'up' },
  's':          { type: 'move', direction: 'down' },
  'S':          { type: 'move', direction: 'down' },
  'a':          { type: 'move', direction: 'left' },
  'A':          { type: 'move', direction: 'left' },
  'd':          { type: 'move', direction: 'right' },
  'D':          { type: 'move', direction: 'right' },
  'e':          { type: 'interact' },
  'E':          { type: 'interact' },
  ' ':          { type: 'use_tool' },
  'i':          { type: 'toggle_inventory' },
  'I':          { type: 'toggle_inventory' },
  'q':          { type: 'toggle_quests' },
  'Q':          { type: 'toggle_quests' },
  '1':          { type: 'select_tool', index: 0 },
  '2':          { type: 'select_tool', index: 1 },
  '3':          { type: 'select_tool', index: 2 },
  '4':          { type: 'select_tool', index: 3 },
  'z':          { type: 'sleep' },
  'Z':          { type: 'sleep' },
  't':          { type: 'advance_time' },
  'T':          { type: 'advance_time' },
};

export function mapKeyToInput(key: string): GameInput {
  return KEY_MAP[key] || { type: 'none' };
}

export class InputHandler {
  private pressedKeys = new Set<string>();
  private inputQueue: GameInput[] = [];

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
  }

  attach() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  detach() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown(e: KeyboardEvent) {
    // Don't capture input when typing in text fields
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const input = mapKeyToInput(e.key);
    if (input.type !== 'none') {
      e.preventDefault();
      if (!this.pressedKeys.has(e.key)) {
        this.pressedKeys.add(e.key);
        this.inputQueue.push(input);
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.pressedKeys.delete(e.key);
  }

  pollInput(): GameInput | null {
    return this.inputQueue.shift() || null;
  }

  isKeyPressed(key: string): boolean {
    return this.pressedKeys.has(key);
  }
}
