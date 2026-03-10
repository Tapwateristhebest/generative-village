// ============================================
// Farming types and crop definitions
// ============================================

export interface CropDefinition {
  id: string;
  name: string;
  season: 'spring' | 'summer' | 'fall' | 'any';
  growthDays: number;
  stages: string[];  // emoji per stage
  seedPrice: number;
  sellPrice: number;
}

export interface ItemStack {
  itemId: string;
  name: string;
  quantity: number;
  category: 'crop' | 'seed' | 'foraged' | 'material' | 'tool' | 'cooked';
}

export const SPRING_CROPS: CropDefinition[] = [
  {
    id: 'turnip',
    name: 'Turnip',
    season: 'spring',
    growthDays: 3,
    stages: ['🌱', '🌿', '🥕'],
    seedPrice: 20,
    sellPrice: 60,
  },
  {
    id: 'potato',
    name: 'Potato',
    season: 'spring',
    growthDays: 5,
    stages: ['🌱', '🌿', '🌾', '🥔'],
    seedPrice: 40,
    sellPrice: 120,
  },
  {
    id: 'strawberry',
    name: 'Strawberry',
    season: 'spring',
    growthDays: 7,
    stages: ['🌱', '🌿', '🌸', '🍓'],
    seedPrice: 80,
    sellPrice: 250,
  },
  {
    id: 'parsnip',
    name: 'Parsnip',
    season: 'spring',
    growthDays: 4,
    stages: ['🌱', '🌿', '🌾', '🥬'],
    seedPrice: 30,
    sellPrice: 90,
  },
];

export const ALL_CROPS: Record<string, CropDefinition> = Object.fromEntries(
  SPRING_CROPS.map(c => [c.id, c])
);

export const FORAGE_ITEMS: Record<string, { name: string; sellPrice: number }> = {
  wild_herb: { name: 'Wild Herb', sellPrice: 25 },
  wild_berry: { name: 'Wild Berry', sellPrice: 15 },
  mushroom: { name: 'Forest Mushroom', sellPrice: 35 },
  moonflower: { name: 'Moonflower', sellPrice: 100 },
};

// Energy costs
export const ENERGY_COSTS = {
  till: 8,
  plant: 4,
  water: 5,
  harvest: 6,
  forage: 4,
  mine_rock: 10,
} as const;
