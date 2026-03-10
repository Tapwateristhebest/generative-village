-- ============================================
-- Village Game Database Schema
-- ============================================

-- 1. Game sessions
CREATE TABLE IF NOT EXISTS village_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  player_name TEXT NOT NULL DEFAULT 'Farmer',
  current_day INTEGER NOT NULL DEFAULT 1,
  current_season TEXT NOT NULL DEFAULT 'spring',
  current_phase TEXT NOT NULL DEFAULT 'morning',
  player_position JSONB NOT NULL DEFAULT '{"x":9,"y":14}'::jsonb,
  player_gold INTEGER NOT NULL DEFAULT 500,
  player_energy INTEGER NOT NULL DEFAULT 100,
  player_inventory JSONB NOT NULL DEFAULT '[]'::jsonb,
  player_tools JSONB NOT NULL DEFAULT '["hoe","watering_can"]'::jsonb,
  world_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  economy_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- 2. Villager state (per game)
CREATE TABLE IF NOT EXISTS village_villagers (
  id TEXT NOT NULL,
  game_id UUID NOT NULL REFERENCES village_games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position JSONB NOT NULL DEFAULT '{"x":0,"y":0}'::jsonb,
  inventory JSONB NOT NULL DEFAULT '[]'::jsonb,
  gold INTEGER NOT NULL DEFAULT 200,
  current_mood TEXT NOT NULL DEFAULT 'calm',
  relationships JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (id, game_id)
);

-- 3. Villager memories
CREATE TABLE IF NOT EXISTS village_memories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES village_games(id) ON DELETE CASCADE,
  villager_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  event TEXT NOT NULL,
  sentiment NUMERIC NOT NULL DEFAULT 0,
  about TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_village_memories_lookup
  ON village_memories (game_id, villager_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_village_memories_about
  ON village_memories (game_id, villager_id, about);

-- 4. Player-villager conversations
CREATE TABLE IF NOT EXISTS village_conversations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES village_games(id) ON DELETE CASCADE,
  villager_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_village_conversations_lookup
  ON village_conversations (game_id, villager_id, created_at DESC);

-- 5. Village events
CREATE TABLE IF NOT EXISTS village_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES village_games(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  phase TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  target_id TEXT,
  description TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_village_events_game_day
  ON village_events (game_id, day DESC, created_at DESC);

-- 6. Quests
CREATE TABLE IF NOT EXISTS village_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES village_games(id) ON DELETE CASCADE,
  villager_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  objective JSONB NOT NULL,
  reward JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  offered_day INTEGER NOT NULL,
  deadline_day INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_village_quests_active
  ON village_quests (game_id, status) WHERE status = 'active';
