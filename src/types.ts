export type Terrain = 'grassland' | 'forest' | 'water' | 'wasteland' | 'crater' | 'mountain';

export type GodPower = 'meteor' | 'rain' | 'sun' | 'seed';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type Weather = 'clear' | 'rain' | 'storm' | 'drought' | 'heatwave' | 'ashfall';

export interface ClimateState {
  season: Season;
  weather: Weather;
  seasonProgress: number;
  weatherProgress: number;
  temperature: number;
  moisture: number;
}

export interface Cell {
  terrain: Terrain;
  grass: number;
  water: number;
  nutrient: number;
  heat: number;
  ash: number;
  fungus: number;
  toxicity: number;
}

export interface GridPosition {
  x: number;
  y: number;
}

export type CreatureKind = 'herbivore' | 'carnivore' | 'omnivore' | 'scavenger';

export type CreatureSpecies = 'hare' | 'deer' | 'boar' | 'wolf' | 'fox' | 'bear' | 'vulture';

export type CreatureState =
  | 'foraging'
  | 'grazing'
  | 'browsing'
  | 'rooting'
  | 'fleeing'
  | 'hunting'
  | 'scavenging'
  | 'mating'
  | 'starving'
  | 'sick';

export interface Creature extends GridPosition {
  id: number;
  kind: CreatureKind;
  species: CreatureSpecies;
  energy: number;
  age: number;
  moveCooldown: number;
  reproductionCooldown: number;
  stress: number;
  sickness: number;
  state: CreatureState;
  packId: number;
}

export interface CreatureTerritory extends GridPosition {
  packId: number;
  species: CreatureSpecies;
  radius: number;
  zocRadius: number;
  strength: number;
  pressure: number;
}

export interface CreatureEvent extends GridPosition {
  type: 'birth' | 'death' | 'hunt' | 'scavenge' | 'outbreak' | 'recovery';
  kind?: CreatureKind;
  species?: CreatureSpecies;
  detail?: string;
}

export interface Corpse extends GridPosition {
  id: number;
  nutrientsLeft: number;
  decay: number;
}

export interface EcosystemStats {
  grass: number;
  herbivores: number;
  carnivores: number;
  omnivores: number;
  scavengers: number;
  speciesDiversity: number;
  corpses: number;
  sick: number;
  pressure: number;
  fertility: number;
  season: Season;
  weather: Weather;
  stability: number;
}
