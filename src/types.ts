export type Terrain = 'grassland' | 'forest' | 'water' | 'wasteland' | 'crater' | 'mountain';

export type GodPower = 'meteor' | 'rain' | 'sun' | 'seed';

export interface Cell {
  terrain: Terrain;
  grass: number;
  water: number;
  nutrient: number;
  heat: number;
  ash: number;
}

export interface GridPosition {
  x: number;
  y: number;
}

export type CreatureKind = 'herbivore' | 'carnivore';

export interface Creature extends GridPosition {
  id: number;
  kind: CreatureKind;
  energy: number;
  age: number;
  moveCooldown: number;
  reproductionCooldown: number;
}

export interface CreatureEvent extends GridPosition {
  type: 'birth';
  kind: CreatureKind;
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
  stability: number;
}
