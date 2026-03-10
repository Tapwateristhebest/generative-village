// ============================================
// Time system types
// ============================================

export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export const PHASES: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];
export const SEASON_LENGTH = 10; // days per season

export interface GameTime {
  day: number;
  season: Season;
  phase: TimeOfDay;
  totalDaysPlayed: number;
}

export function getNextPhase(current: TimeOfDay): { phase: TimeOfDay; newDay: boolean } {
  const idx = PHASES.indexOf(current);
  if (idx === PHASES.length - 1) {
    return { phase: 'morning', newDay: true };
  }
  return { phase: PHASES[idx + 1], newDay: false };
}

export function getNextSeason(current: Season): Season {
  const seasons: Season[] = ['spring', 'summer', 'fall', 'winter'];
  const idx = seasons.indexOf(current);
  return seasons[(idx + 1) % seasons.length];
}

export function getPhaseEmoji(phase: TimeOfDay): string {
  switch (phase) {
    case 'morning': return '🌅';
    case 'afternoon': return '☀️';
    case 'evening': return '🌆';
    case 'night': return '🌙';
  }
}

export function getSeasonEmoji(season: Season): string {
  switch (season) {
    case 'spring': return '🌸';
    case 'summer': return '☀️';
    case 'fall': return '🍂';
    case 'winter': return '❄️';
  }
}
