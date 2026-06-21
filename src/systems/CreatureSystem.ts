import * as Phaser from 'phaser';
import type {
  Corpse,
  Creature,
  CreatureEvent,
  CreatureKind,
  CreatureSpecies,
  CreatureState,
  CreatureTerritory,
  EcosystemStats,
  GridPosition,
} from '../types';
import { EnvironmentSystem } from './EnvironmentSystem';

const MAX_CREATURES = 420;
const SPECIES_COUNT = 7;
const TERRITORY_ZOC_BUFFER = 3.5;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => clamp(value, 0, 1);

type FeedingStyle = 'grazer' | 'browser' | 'rooter' | 'hunter' | 'omnivore' | 'scavenger';

interface SpeciesProfile {
  kind: CreatureKind;
  feeding: FeedingStyle;
  metabolism: number;
  moveCooldown: number;
  reproductionRate: number;
  reproductionCooldown: number;
  energyThreshold: number;
  birthCost: number;
  childEnergy: number;
  maxEnergy: number;
  bite: number;
  plantGain: number;
  huntGain: number;
  corpseBite: number;
  corpseGain: number;
  corpseNutrients: number;
  stressResistance: number;
  diseaseResistance: number;
  groupRadius: number;
  territoryRadius?: number;
  prey: CreatureSpecies[];
}

const speciesProfiles: Record<CreatureSpecies, SpeciesProfile> = {
  hare: {
    kind: 'herbivore',
    feeding: 'grazer',
    metabolism: 0.048,
    moveCooldown: 0.12,
    reproductionRate: 0.48,
    reproductionCooldown: 5.4,
    energyThreshold: 0.86,
    birthCost: 0.25,
    childEnergy: 0.52,
    maxEnergy: 1.28,
    bite: 0.13,
    plantGain: 1.45,
    huntGain: 0,
    corpseBite: 0,
    corpseGain: 0,
    corpseNutrients: 0.28,
    stressResistance: 0.84,
    diseaseResistance: 0.9,
    groupRadius: 4.5,
    prey: [],
  },
  deer: {
    kind: 'herbivore',
    feeding: 'browser',
    metabolism: 0.034,
    moveCooldown: 0.19,
    reproductionRate: 0.2,
    reproductionCooldown: 8.4,
    energyThreshold: 1.02,
    birthCost: 0.38,
    childEnergy: 0.64,
    maxEnergy: 1.58,
    bite: 0.24,
    plantGain: 1.2,
    huntGain: 0,
    corpseBite: 0,
    corpseGain: 0,
    corpseNutrients: 0.52,
    stressResistance: 1.0,
    diseaseResistance: 1.0,
    groupRadius: 7,
    prey: [],
  },
  boar: {
    kind: 'omnivore',
    feeding: 'rooter',
    metabolism: 0.042,
    moveCooldown: 0.2,
    reproductionRate: 0.22,
    reproductionCooldown: 8.2,
    energyThreshold: 0.98,
    birthCost: 0.36,
    childEnergy: 0.66,
    maxEnergy: 1.62,
    bite: 0.18,
    plantGain: 1.12,
    huntGain: 0,
    corpseBite: 0.13,
    corpseGain: 0.82,
    corpseNutrients: 0.62,
    stressResistance: 1.22,
    diseaseResistance: 1.08,
    groupRadius: 5.5,
    prey: [],
  },
  wolf: {
    kind: 'carnivore',
    feeding: 'hunter',
    metabolism: 0.056,
    moveCooldown: 0.14,
    reproductionRate: 0.12,
    reproductionCooldown: 11.2,
    energyThreshold: 1.08,
    birthCost: 0.43,
    childEnergy: 0.82,
    maxEnergy: 1.92,
    bite: 0,
    plantGain: 0,
    huntGain: 0.82,
    corpseBite: 0.24,
    corpseGain: 1.26,
    corpseNutrients: 0.72,
    stressResistance: 1.08,
    diseaseResistance: 1.02,
    groupRadius: 8,
    territoryRadius: 14,
    prey: ['hare', 'deer', 'boar', 'fox', 'vulture'],
  },
  fox: {
    kind: 'carnivore',
    feeding: 'hunter',
    metabolism: 0.044,
    moveCooldown: 0.12,
    reproductionRate: 0.18,
    reproductionCooldown: 8.8,
    energyThreshold: 0.94,
    birthCost: 0.32,
    childEnergy: 0.68,
    maxEnergy: 1.55,
    bite: 0,
    plantGain: 0,
    huntGain: 0.56,
    corpseBite: 0.16,
    corpseGain: 1.12,
    corpseNutrients: 0.38,
    stressResistance: 0.96,
    diseaseResistance: 0.96,
    groupRadius: 4.5,
    territoryRadius: 10,
    prey: ['hare', 'vulture'],
  },
  bear: {
    kind: 'omnivore',
    feeding: 'omnivore',
    metabolism: 0.062,
    moveCooldown: 0.23,
    reproductionRate: 0.07,
    reproductionCooldown: 15.5,
    energyThreshold: 1.22,
    birthCost: 0.52,
    childEnergy: 0.92,
    maxEnergy: 2.05,
    bite: 0.16,
    plantGain: 0.82,
    huntGain: 0.92,
    corpseBite: 0.32,
    corpseGain: 1.34,
    corpseNutrients: 0.94,
    stressResistance: 1.32,
    diseaseResistance: 1.18,
    groupRadius: 5,
    prey: ['hare', 'deer', 'boar', 'fox', 'wolf'],
  },
  vulture: {
    kind: 'scavenger',
    feeding: 'scavenger',
    metabolism: 0.032,
    moveCooldown: 0.16,
    reproductionRate: 0.12,
    reproductionCooldown: 10.5,
    energyThreshold: 0.92,
    birthCost: 0.31,
    childEnergy: 0.58,
    maxEnergy: 1.42,
    bite: 0,
    plantGain: 0,
    huntGain: 0,
    corpseBite: 0.2,
    corpseGain: 1.18,
    corpseNutrients: 0.24,
    stressResistance: 1.1,
    diseaseResistance: 1.34,
    groupRadius: 6,
    prey: [],
  },
};

export class CreatureSystem {
  readonly creatures: Creature[] = [];
  readonly corpses: Corpse[] = [];
  private readonly events: CreatureEvent[] = [];
  private readonly territories = new Map<CreatureSpecies, CreatureTerritory>();
  private nextId = 1;
  private nextPackId = 1;

  constructor(private readonly environment: EnvironmentSystem) {
    this.spawnInitialPopulation();
  }

  update(deltaSeconds: number): void {
    const dt = Math.min(deltaSeconds, 0.25);
    this.updateCorpses(dt);
    this.updateTerritories(dt);
    const climate = this.environment.getClimate();

    for (const creature of [...this.creatures]) {
      const profile = speciesProfiles[creature.species];
      creature.kind = profile.kind;
      creature.age += dt;
      creature.moveCooldown -= dt;
      creature.reproductionCooldown = Math.max(0, creature.reproductionCooldown - dt);

      const cell = this.environment.getCell(creature.x, creature.y);
      const terrainStress =
        !cell || cell.terrain === 'water' || cell.terrain === 'crater' || cell.terrain === 'mountain'
          ? 0.34
          : Math.max(0, cell.heat - 0.66) * 0.42 + cell.toxicity * 0.2 + Math.max(0, 0.16 - cell.water) * 0.18;
      const weatherStress =
        climate.weather === 'storm'
          ? 0.035
          : climate.weather === 'heatwave'
            ? 0.085
            : climate.weather === 'drought'
              ? 0.06
              : 0;
      creature.stress = clamp01(creature.stress + ((terrainStress + weatherStress) / profile.stressResistance) * dt - 0.05 * dt);
      this.applyTerritoryStress(creature, profile, dt);
      creature.sickness = clamp01(
        creature.sickness + (this.sicknessPressure(creature) / profile.diseaseResistance) * dt - this.recoveryRate(creature) * dt,
      );

      creature.energy -= (profile.metabolism + creature.stress * 0.048 + creature.sickness * 0.075) * dt;
      if (creature.sickness > 0.72 && Math.random() < 0.01 * dt) {
        this.events.push({ type: 'outbreak', kind: creature.kind, species: creature.species, x: creature.x, y: creature.y });
      }

      if (creature.moveCooldown <= 0) {
        this.updateCreatureBehavior(creature);
        creature.moveCooldown = profile.moveCooldown + creature.stress * 0.08 + creature.sickness * 0.08;
      }

      this.tryReproduce(creature, dt);

      if (creature.energy <= 0) {
        this.killCreature(creature, creature.sickness > 0.6 ? 'outbreak' : 'death');
      }
    }
  }

  killCreaturesInRadius(center: GridPosition, radius: number): number {
    let killed = 0;
    for (const creature of [...this.creatures]) {
      if (Math.hypot(creature.x - center.x, creature.y - center.y) <= radius) {
        this.killCreature(creature, 'death');
        killed += 1;
      }
    }
    return killed;
  }

  addHerbivores(center: GridPosition, count: number): void {
    const seedSpecies: CreatureSpecies[] = ['hare', 'hare', 'deer', 'deer', 'boar'];
    for (let i = 0; i < count; i += 1) {
      const point = this.findNearbyWalkable(center, 6);
      if (point) {
        this.addCreature(Phaser.Math.RND.pick(seedSpecies), point.x, point.y, 0.65);
      }
    }
  }

  consumeEvents(): CreatureEvent[] {
    return this.events.splice(0);
  }

  getPredatorTerritories(): CreatureTerritory[] {
    return [...this.territories.values()];
  }

  getStats(): EcosystemStats {
    const grass = this.environment.cells.reduce((total, cell) => total + cell.grass, 0);
    const fertilitySum = this.environment.cells.reduce(
      (total, cell) => total + cell.nutrient * 0.42 + cell.water * 0.28 + cell.fungus * 0.2 - cell.toxicity * 0.32,
      0,
    );
    const herbivores = this.countKind('herbivore');
    const carnivores = this.countKind('carnivore');
    const omnivores = this.countKind('omnivore');
    const scavengers = this.countKind('scavenger');
    const sick = this.creatures.filter((creature) => creature.sickness > 0.38).length;
    const activeSpecies = new Set(this.creatures.map((creature) => creature.species)).size;
    const speciesDiversity = activeSpecies / SPECIES_COUNT;
    const targetGrass = this.environment.width * this.environment.height * 0.52;
    const targetHerbivores = Math.round(this.environment.width * this.environment.height * 0.021);
    const targetCarnivores = Math.max(14, Math.round(targetHerbivores * 0.23));
    const targetOmnivores = Math.max(10, Math.round(targetHerbivores * 0.16));
    const targetScavengers = Math.max(5, Math.round(targetHerbivores * 0.07));
    const preyBase = herbivores + omnivores * 0.45;
    const predatorLoad = carnivores + this.creatures.filter((creature) => creature.species === 'bear').length * 0.7;
    const pressure = preyBase === 0 ? 1 : clamp(predatorLoad / Math.max(1, preyBase), 0, 1);
    const grassScore = clamp(grass / targetGrass, 0, 1);
    const herbivoreScore = clamp(1 - Math.abs(herbivores - targetHerbivores) / targetHerbivores, 0, 1);
    const carnivoreScore = clamp(1 - Math.abs(carnivores - targetCarnivores) / targetCarnivores, 0, 1);
    const omnivoreScore = clamp(1 - Math.abs(omnivores - targetOmnivores) / targetOmnivores, 0, 1);
    const scavengerScore = clamp(1 - Math.abs(scavengers - targetScavengers) / targetScavengers, 0, 1);
    const ratioScore = preyBase === 0 ? 0 : clamp(1 - Math.abs(predatorLoad / preyBase - 0.22) / 0.34, 0, 1);
    const diseasePenalty = clamp(sick / Math.max(1, this.creatures.length), 0, 1);
    const carrionPenalty = clamp(this.corpses.length / 32, 0, 1);
    const fertility = clamp01(fertilitySum / this.environment.cells.length);
    const climate = this.environment.getClimate();

    return {
      grass,
      herbivores,
      carnivores,
      omnivores,
      scavengers,
      speciesDiversity,
      corpses: this.corpses.length,
      sick,
      pressure,
      fertility,
      season: climate.season,
      weather: climate.weather,
      stability: Math.round(
        (grassScore * 0.2 +
          herbivoreScore * 0.15 +
          carnivoreScore * 0.12 +
          omnivoreScore * 0.09 +
          scavengerScore * 0.06 +
          ratioScore * 0.14 +
          fertility * 0.12 +
          speciesDiversity * 0.18 -
          diseasePenalty * 0.12 -
          carrionPenalty * 0.08) *
          100,
      ),
    };
  }

  private updateCreatureBehavior(creature: Creature): void {
    const profile = speciesProfiles[creature.species];
    const threat = this.findNearestThreat(creature, creature.species === 'bear' ? 0 : 7.5);
    if (threat) {
      creature.state = 'fleeing';
      creature.stress = clamp01(creature.stress + 0.18);
      this.stepAway(creature, threat);
      return;
    }

    if (profile.feeding === 'hunter') {
      this.updateHunter(creature);
      return;
    }
    if (profile.feeding === 'omnivore') {
      this.updateOmnivore(creature);
      return;
    }
    if (profile.feeding === 'rooter') {
      this.updateRooter(creature);
      return;
    }
    if (profile.feeding === 'scavenger') {
      this.updateScavenger(creature);
      return;
    }
    this.updatePlantEater(creature);
  }

  private updateTerritories(dt: number): void {
    for (const [species, territory] of [...this.territories]) {
      const members = this.creatures.filter((creature) => creature.species === species);
      if (members.length === 0 || speciesProfiles[territory.species].kind !== 'carnivore') {
        this.territories.delete(species);
        continue;
      }

      const desiredCenter = this.resolveTerritoryZoc(species, this.averagePosition(members), territory.radius);
      const pressure = this.rivalCarnivorePressure(territory, species);
      const averageEnergy = members.reduce((sum, member) => sum + member.energy, 0) / members.length;
      territory.x = Phaser.Math.Linear(territory.x, desiredCenter.x, Math.min(1, dt * 0.12));
      territory.y = Phaser.Math.Linear(territory.y, desiredCenter.y, Math.min(1, dt * 0.12));
      territory.radius = speciesProfiles[territory.species].territoryRadius ?? territory.radius;
      territory.zocRadius = territory.radius + TERRITORY_ZOC_BUFFER;
      const separated = this.resolveTerritoryZoc(species, territory, territory.radius);
      territory.x = separated.x;
      territory.y = separated.y;
      territory.pressure = Phaser.Math.Linear(territory.pressure, pressure, Math.min(1, dt * 0.7));
      territory.strength = clamp01(0.32 + members.length * 0.12 + averageEnergy * 0.18 - territory.pressure * 0.1);
    }
  }

  private applyTerritoryStress(creature: Creature, profile: SpeciesProfile, dt: number): void {
    if (!this.isTerritorial(profile)) {
      return;
    }
    const territory = this.territories.get(creature.species);
    if (!territory) {
      return;
    }
    const distanceFromHome = Math.hypot(creature.x - territory.x, creature.y - territory.y);
    const outside = Math.max(0, distanceFromHome - territory.radius);
    const rivalPressure = this.rivalTerritoryPressureAt(creature, creature.species);
    creature.stress = clamp01(creature.stress + (outside * 0.012 + rivalPressure * 0.035) * dt);
    if (outside > territory.radius * 0.35) {
      creature.energy = clamp(creature.energy - outside * 0.0018 * dt, 0, profile.maxEnergy);
    }
  }

  private updatePlantEater(creature: Creature): void {
    const target = this.findBestPlantFood(creature, 10);
    this.stepToward(creature, target);

    if (this.eatPlantFood(creature)) {
      return;
    }

    const herd = this.findHerdCenter(creature, speciesProfiles[creature.species].groupRadius);
    if (herd && Math.random() < 0.35) {
      creature.state = 'foraging';
      this.stepToward(creature, herd);
    } else {
      creature.state = creature.energy < 0.38 ? 'starving' : 'foraging';
    }
  }

  private updateRooter(creature: Creature): void {
    if (creature.energy < 0.55) {
      const corpse = this.findNearestCorpse(creature, 5);
      if (corpse) {
        this.seekAndEatCorpse(creature, corpse, 0.55);
        return;
      }
    }
    this.updatePlantEater(creature);
  }

  private updateOmnivore(creature: Creature): void {
    if (creature.energy < 1.0) {
      const corpse = this.findNearestCorpse(creature, 8);
      if (corpse) {
        this.seekAndEatCorpse(creature, corpse, 1);
        return;
      }
    }

    if (creature.energy < 0.86) {
      const prey = this.findBestPrey(creature, 10);
      if (prey) {
        this.seekAndHunt(creature, prey, 1);
        return;
      }
    }

    this.updatePlantEater(creature);
  }

  private updateHunter(creature: Creature): void {
    const territory = this.territories.get(creature.species);
    if (territory && this.distanceFromTerritory(creature, territory) > territory.radius * 1.18 && creature.energy > 0.36) {
      creature.state = 'hunting';
      this.stepToward(creature, territory);
      return;
    }

    const corpse =
      creature.energy < 0.78
        ? this.findNearestCorpse(creature, creature.species === 'fox' ? 7 : 8, territory, creature.energy < 0.42 ? 1.28 : 1.06)
        : undefined;
    if (corpse) {
      this.seekAndEatCorpse(creature, corpse, creature.species === 'fox' ? 0.75 : 1);
      return;
    }

    const prey = this.findBestPrey(creature, creature.species === 'fox' ? 11 : 15, territory);
    if (prey) {
      this.seekAndHunt(creature, prey, creature.species === 'fox' ? 0.72 : 1);
      return;
    }

    const pack = this.findPackCenter(creature, speciesProfiles[creature.species].groupRadius);
    if (pack && Math.random() < 0.32) {
      creature.state = 'hunting';
      this.stepToward(creature, pack);
      return;
    }

    creature.state = creature.energy < 0.35 ? 'starving' : 'foraging';
    this.stepToward(creature, territory ? this.findTerritoryPatrolPoint(creature, territory) : {
      x: creature.x + Phaser.Math.Between(-1, 1),
      y: creature.y + Phaser.Math.Between(-1, 1),
    });
  }

  private updateScavenger(creature: Creature): void {
    const corpse = this.findNearestCorpse(creature, 18);
    if (corpse) {
      this.seekAndEatCorpse(creature, corpse, 1.15);
      return;
    }

    const target = this.findCarrionWatchPoint(creature, 12);
    creature.state = creature.energy < 0.35 ? 'starving' : 'foraging';
    this.stepToward(creature, target);
  }

  private seekAndHunt(creature: Creature, prey: Creature, efficiency: number): void {
    const profile = speciesProfiles[creature.species];
    const territory = this.territories.get(creature.species);
    creature.state = 'hunting';
    this.stepToward(creature, prey);
    const caught = this.findBestPrey(creature, creature.species === 'fox' ? 1.45 : 1.75, territory);
    if (!caught) {
      return;
    }
    this.killCreature(caught, 'hunt');
    creature.energy = clamp(creature.energy + (profile.huntGain + speciesProfiles[caught.species].corpseNutrients * 0.24) * efficiency, 0, profile.maxEnergy);
    creature.stress = clamp01(creature.stress - 0.08);
    this.events.push({ type: 'hunt', kind: creature.kind, species: creature.species, x: creature.x, y: creature.y, detail: caught.species });
  }

  private seekAndEatCorpse(creature: Creature, corpse: Corpse, efficiency: number): void {
    const profile = speciesProfiles[creature.species];
    creature.state = 'scavenging';
    this.stepToward(creature, corpse);
    if (Math.hypot(corpse.x - creature.x, corpse.y - creature.y) > 1.65) {
      return;
    }

    const eaten = Math.min(corpse.nutrientsLeft, profile.corpseBite * efficiency);
    corpse.nutrientsLeft -= eaten;
    creature.energy = clamp(creature.energy + eaten * profile.corpseGain, 0, profile.maxEnergy);
    creature.sickness = clamp01(creature.sickness + (corpse.decay > 8 ? 0.035 : 0.01) / profile.diseaseResistance);
    if (profile.kind === 'scavenger') {
      corpse.decay = Math.max(0, corpse.decay - 0.2);
      this.environment.forEachInRadius(corpse, 2.2, (cell, distance) => {
        cell.toxicity = clamp01(cell.toxicity - 0.015 / (distance + 1));
      });
    }
    this.events.push({ type: 'scavenge', kind: creature.kind, species: creature.species, x: creature.x, y: creature.y });
  }

  private eatPlantFood(creature: Creature): boolean {
    const profile = speciesProfiles[creature.species];
    const cell = this.environment.getCell(creature.x, creature.y);
    if (!cell) {
      return false;
    }

    let eaten = 0;
    if (cell.grass > 0.05) {
      const terrainBonus = profile.feeding === 'browser' && cell.terrain === 'forest' ? 1.26 : profile.feeding === 'grazer' && cell.terrain === 'grassland' ? 1.15 : 1;
      eaten += Math.min(cell.grass, profile.bite * terrainBonus);
      cell.grass = clamp01(cell.grass - eaten);
    }

    if ((profile.feeding === 'rooter' || profile.feeding === 'omnivore') && cell.fungus > 0.04) {
      const fungusEaten = Math.min(cell.fungus, 0.09);
      cell.fungus = clamp01(cell.fungus - fungusEaten);
      eaten += fungusEaten * 0.8;
    }

    if (eaten <= 0.01) {
      return false;
    }

    cell.nutrient = clamp01(cell.nutrient + eaten * (profile.feeding === 'rooter' ? 0.04 : 0.022));
    creature.energy = clamp(creature.energy + eaten * profile.plantGain, 0, profile.maxEnergy);
    creature.stress = clamp01(creature.stress - 0.05);
    creature.state = profile.feeding === 'browser' ? 'browsing' : profile.feeding === 'rooter' ? 'rooting' : 'grazing';
    return true;
  }

  private updateCorpses(dt: number): void {
    for (const corpse of [...this.corpses]) {
      const released = Math.min(corpse.nutrientsLeft, (0.12 + corpse.decay * 0.003) * dt);
      corpse.nutrientsLeft -= released;
      corpse.decay += dt;
      this.environment.forEachInRadius(corpse, 2.6, (cell, distance) => {
        const falloff = 1 / (distance + 1);
        cell.nutrient = clamp01(cell.nutrient + released * 0.52 * falloff);
        cell.fungus = clamp01(cell.fungus + released * 0.36 * falloff);
        if (corpse.decay > 7) {
          cell.toxicity = clamp01(cell.toxicity + released * 0.14 * falloff);
        }
      });

      if (corpse.nutrientsLeft <= 0.01 || corpse.decay > 24) {
        this.corpses.splice(this.corpses.indexOf(corpse), 1);
      }
    }
  }

  private tryReproduce(parent: Creature, dt: number): void {
    const profile = speciesProfiles[parent.species];
    const climate = this.environment.getClimate();
    const seasonMultiplier = climate.season === 'spring' ? 1.38 : climate.season === 'summer' ? 1.08 : climate.season === 'winter' ? 0.34 : 0.74;
    if (
      this.creatures.length >= MAX_CREATURES ||
      parent.age < 3.5 ||
      parent.reproductionCooldown > 0 ||
      parent.energy < profile.energyThreshold ||
      parent.sickness > 0.28 ||
      parent.stress > 0.62 ||
      !this.hasReproductionSupport(parent)
    ) {
      return;
    }

    const chance = 1 - Math.exp(-profile.reproductionRate * seasonMultiplier * dt);
    if (Math.random() > chance) {
      return;
    }

    const point = this.findNearbyWalkable(parent, 5);
    if (!point) {
      return;
    }

    parent.energy = clamp(parent.energy - profile.birthCost, 0.25, profile.maxEnergy);
    parent.reproductionCooldown = profile.reproductionCooldown;
    parent.state = 'mating';

    const child = this.addCreature(parent.species, point.x, point.y, profile.childEnergy, parent.packId);
    child.reproductionCooldown = profile.reproductionCooldown + Phaser.Math.FloatBetween(0.8, 3.2);
    this.events.push({ type: 'birth', kind: parent.kind, species: parent.species, x: point.x, y: point.y });
  }

  private hasReproductionSupport(parent: Creature): boolean {
    const profile = speciesProfiles[parent.species];
    let nearbySameSpecies = 0;
    for (const creature of this.creatures) {
      if (creature !== parent && creature.species === parent.species && Math.hypot(creature.x - parent.x, creature.y - parent.y) <= profile.groupRadius + 2) {
        nearbySameSpecies += 1;
      }
    }
    if (nearbySameSpecies < 1 && parent.species !== 'bear') {
      return false;
    }

    if (profile.kind === 'herbivore' || profile.feeding === 'rooter') {
      let nearbyFood = 0;
      this.environment.forEachInRadius(parent, 5, (cell, distance) => {
        nearbyFood += (cell.grass + cell.fungus * 0.45) / (distance + 1);
      });
      return nearbyFood > (parent.species === 'hare' ? 0.7 : 0.95);
    }

    if (profile.kind === 'scavenger') {
      return this.corpses.some((corpse) => Math.hypot(corpse.x - parent.x, corpse.y - parent.y) <= 15);
    }

    const territory = this.isTerritorial(profile) ? this.territories.get(parent.species) : undefined;
    let nearbyPrey = 0;
    for (const creature of this.creatures) {
      const distance = Math.hypot(creature.x - parent.x, creature.y - parent.y);
      const inTerritory = territory ? this.distanceFromTerritory(creature, territory) <= territory.radius : true;
      if (profile.prey.includes(creature.species) && distance <= 14 && inTerritory) {
        nearbyPrey += 1;
      }
    }
    if (profile.kind === 'omnivore') {
      let nearbyFood = 0;
      this.environment.forEachInRadius(parent, 5, (cell, distance) => {
        nearbyFood += (cell.grass * 0.6 + cell.fungus * 0.7) / (distance + 1);
      });
      return nearbyFood > 0.55 || nearbyPrey >= 2 || this.findNearestCorpse(parent, 9) !== undefined;
    }
    if (territory && (territory.strength < 0.48 || territory.pressure > 2.2)) {
      return false;
    }
    return nearbyPrey >= (parent.species === 'fox' ? 2 : 4);
  }

  private sicknessPressure(creature: Creature): number {
    const profile = speciesProfiles[creature.species];
    const cell = this.environment.getCell(creature.x, creature.y);
    let pressure = cell ? cell.toxicity * 0.04 + Math.max(0, cell.heat - 0.78) * 0.035 : 0.05;
    for (const corpse of this.corpses) {
      const distance = Math.hypot(corpse.x - creature.x, corpse.y - creature.y);
      if (distance <= 3.5 && corpse.decay > 5) {
        pressure += (0.035 / (distance + 1)) * (profile.kind === 'carnivore' ? 1.2 : profile.kind === 'scavenger' ? 0.62 : 1);
      }
    }
    for (const other of this.creatures) {
      if (other === creature || other.sickness < 0.45) {
        continue;
      }
      const distance = Math.hypot(other.x - creature.x, other.y - creature.y);
      if (distance <= 2.2) {
        pressure += 0.014 / (distance + 1);
      }
    }
    return pressure;
  }

  private recoveryRate(creature: Creature): number {
    const cell = this.environment.getCell(creature.x, creature.y);
    if (!cell) {
      return 0;
    }
    return 0.018 + cell.water * 0.018 + cell.fungus * 0.012 - cell.toxicity * 0.012;
  }

  private killCreature(creature: Creature, reason: 'death' | 'hunt' | 'outbreak'): void {
    const index = this.creatures.indexOf(creature);
    if (index === -1) {
      return;
    }
    const profile = speciesProfiles[creature.species];
    this.creatures.splice(index, 1);
    this.corpses.push({
      id: this.nextId++,
      x: creature.x,
      y: creature.y,
      nutrientsLeft: profile.corpseNutrients,
      decay: 0,
    });
    if (reason === 'outbreak') {
      this.events.push({ type: 'outbreak', kind: creature.kind, species: creature.species, x: creature.x, y: creature.y });
    } else if (reason === 'death' && Math.random() < 0.08) {
      this.events.push({ type: 'death', kind: creature.kind, species: creature.species, x: creature.x, y: creature.y });
    }
  }

  private stepToward(creature: Creature, target: GridPosition): void {
    const candidates = this.neighborCandidates(creature);
    let best: GridPosition = { x: creature.x, y: creature.y };
    let bestScore = this.moveScore(creature, creature, target);
    for (const candidate of candidates) {
      const score = this.moveScore(creature, candidate, target);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    creature.x = best.x;
    creature.y = best.y;
  }

  private stepAway(creature: Creature, threat: GridPosition): void {
    const candidates = this.neighborCandidates(creature);
    let best: GridPosition = { x: creature.x, y: creature.y };
    let bestScore = Math.hypot(creature.x - threat.x, creature.y - threat.y);
    for (const candidate of candidates) {
      const cell = this.environment.getCell(candidate.x, candidate.y);
      const score = Math.hypot(candidate.x - threat.x, candidate.y - threat.y) + (cell?.grass ?? 0) * 0.16 - (cell?.heat ?? 0) * 0.42;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    creature.x = best.x;
    creature.y = best.y;
  }

  private moveScore(creature: Creature, point: GridPosition, target: GridPosition): number {
    const cell = this.environment.getCell(point.x, point.y);
    if (!cell) {
      return -Infinity;
    }
    const profile = speciesProfiles[creature.species];
    const distance = Math.hypot(point.x - target.x, point.y - target.y);
    const forestComfort = cell.terrain === 'forest' && (creature.species === 'deer' || creature.species === 'fox') ? 0.18 : 0;
    const openComfort = cell.terrain === 'grassland' && (creature.species === 'hare' || creature.species === 'wolf') ? 0.14 : 0;
    const carrionComfort = profile.kind === 'scavenger' ? this.carrionPressureAt(point, 10) * 0.36 : 0;
    const plantComfort =
      profile.kind === 'herbivore' || profile.kind === 'omnivore'
        ? cell.grass * (profile.kind === 'herbivore' ? 0.42 : 0.18) + cell.fungus * (profile.feeding === 'rooter' ? 0.22 : 0.08)
        : 0;
    const danger = cell.heat * 0.28 + cell.toxicity * 0.5 + (cell.terrain === 'wasteland' ? 0.08 : 0);
    const predatorPressure = this.findNearestThreat(creature, 5) ? 0.9 : 0;
    const territoryScore = this.territoryMoveScore(creature, profile, point);
    return -distance + plantComfort + forestComfort + openComfort + carrionComfort + territoryScore - danger - predatorPressure;
  }

  private neighborCandidates(origin: GridPosition): GridPosition[] {
    const candidates: GridPosition[] = [];
    for (let y = -1; y <= 1; y += 1) {
      for (let x = -1; x <= 1; x += 1) {
        if (x === 0 && y === 0) {
          continue;
        }
        const point = { x: origin.x + x, y: origin.y + y };
        if (this.isWalkable(point.x, point.y)) {
          candidates.push(point);
        }
      }
    }
    return candidates;
  }

  private findBestPlantFood(origin: Creature, radius: number): GridPosition {
    const profile = speciesProfiles[origin.species];
    let best: GridPosition = origin;
    let bestScore = -Infinity;
    this.environment.forEachInRadius(origin, radius, (cell, distance, x, y) => {
      if (!this.isWalkable(x, y)) {
        return;
      }
      const herd = this.herdDensityAt({ x, y }, origin.packId, profile.groupRadius);
      const forestBonus = origin.species === 'deer' && cell.terrain === 'forest' ? 0.34 : 0;
      const rooterBonus = profile.feeding === 'rooter' ? cell.fungus * 0.62 + cell.nutrient * 0.18 : 0;
      const score =
        cell.grass * (profile.feeding === 'browser' ? 1.7 : 2.1) +
        rooterBonus +
        cell.water * 0.34 +
        cell.nutrient * 0.14 +
        cell.fungus * 0.08 +
        forestBonus +
        herd * 0.06 -
        distance * 0.08 -
        cell.heat * 0.62 -
        cell.toxicity * 0.8 -
        this.predatorPressureAt({ x, y }, 7) * 1.2;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    });
    return best;
  }

  private findBestPrey(origin: Creature, radius: number, territory?: CreatureTerritory): Creature | undefined {
    const profile = speciesProfiles[origin.species];
    if (profile.prey.length === 0) {
      return undefined;
    }

    let best: Creature | undefined;
    let bestScore = -Infinity;
    for (const prey of this.creatures) {
      if (prey === origin || !profile.prey.includes(prey.species)) {
        continue;
      }
      const distance = Math.hypot(prey.x - origin.x, prey.y - origin.y);
      if (distance > radius) {
        continue;
      }
      const territoryDistance = territory ? this.distanceFromTerritory(prey, territory) : 0;
      if (territory && territoryDistance > territory.radius * (origin.energy < 0.44 ? 1.34 : 1.08)) {
        continue;
      }
      const herdDensity = this.herdDensityAt(prey, prey.packId, speciesProfiles[prey.species].groupRadius);
      const preyValue = speciesProfiles[prey.species].corpseNutrients;
      const homeBonus = territory ? clamp01(1 - territoryDistance / Math.max(1, territory.radius)) * 0.62 : 0;
      const rivalPenalty = this.rivalTerritoryPressureAt(prey, origin.species) * 0.7;
      const score =
        preyValue +
        (1.2 - prey.energy) * 1.2 +
        prey.sickness * 0.8 +
        prey.stress * 0.4 +
        homeBonus -
        distance * 0.12 -
        herdDensity * 0.08 -
        rivalPenalty;
      if (score > bestScore) {
        bestScore = score;
        best = prey;
      }
    }
    return best;
  }

  private findNearestThreat(origin: Creature, radius: number): Creature | undefined {
    if (radius <= 0) {
      return undefined;
    }
    let nearest: Creature | undefined;
    let nearestDistance = Infinity;
    for (const creature of this.creatures) {
      if (creature === origin) {
        continue;
      }
      const profile = speciesProfiles[creature.species];
      if (!profile.prey.includes(origin.species)) {
        continue;
      }
      const distance = Math.hypot(creature.x - origin.x, creature.y - origin.y);
      if (distance < nearestDistance && distance <= radius) {
        nearestDistance = distance;
        nearest = creature;
      }
    }
    return nearest;
  }

  private findNearestCorpse(origin: GridPosition, radius: number, territory?: CreatureTerritory, territoryLeeway = 1): Corpse | undefined {
    let nearest: Corpse | undefined;
    let nearestDistance = Infinity;
    for (const corpse of this.corpses) {
      const distance = Math.hypot(corpse.x - origin.x, corpse.y - origin.y);
      if (territory && this.distanceFromTerritory(corpse, territory) > territory.radius * territoryLeeway) {
        continue;
      }
      if (distance < nearestDistance && distance <= radius) {
        nearestDistance = distance;
        nearest = corpse;
      }
    }
    return nearest;
  }

  private findCarrionWatchPoint(origin: Creature, radius: number): GridPosition {
    let best: GridPosition = origin;
    let bestScore = -Infinity;
    this.environment.forEachInRadius(origin, radius, (cell, distance, x, y) => {
      if (!this.isWalkable(x, y)) {
        return;
      }
      const score = cell.heat * 0.12 + cell.ash * 0.2 + this.carrionPressureAt({ x, y }, 10) - distance * 0.04 - cell.toxicity * 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    });
    return best;
  }

  private findHerdCenter(origin: Creature, radius: number): GridPosition | undefined {
    let count = 0;
    let x = 0;
    let y = 0;
    for (const creature of this.creatures) {
      if (creature === origin || creature.species !== origin.species || creature.packId !== origin.packId) {
        continue;
      }
      if (Math.hypot(creature.x - origin.x, creature.y - origin.y) <= radius) {
        count += 1;
        x += creature.x;
        y += creature.y;
      }
    }
    return count > 0 ? { x: Math.round(x / count), y: Math.round(y / count) } : undefined;
  }

  private findPackCenter(origin: Creature, radius: number): GridPosition | undefined {
    return this.findHerdCenter(origin, radius);
  }

  private predatorPressureAt(point: GridPosition, radius: number): number {
    let pressure = 0;
    for (const creature of this.creatures) {
      if (speciesProfiles[creature.species].prey.length === 0) {
        continue;
      }
      const distance = Math.hypot(creature.x - point.x, creature.y - point.y);
      if (distance <= radius) {
        pressure += 1 / (distance + 1);
      }
    }
    for (const territory of this.territories.values()) {
      const distance = this.distanceFromTerritory(point, territory);
      if (distance <= Math.min(radius, territory.radius)) {
        pressure += territory.strength * 0.16 * (1 - distance / Math.max(1, territory.radius));
      }
    }
    return pressure;
  }

  private carrionPressureAt(point: GridPosition, radius: number): number {
    let pressure = 0;
    for (const corpse of this.corpses) {
      const distance = Math.hypot(corpse.x - point.x, corpse.y - point.y);
      if (distance <= radius) {
        pressure += 1 / (distance + 1);
      }
    }
    return pressure;
  }

  private herdDensityAt(point: GridPosition, packId: number, radius: number): number {
    let density = 0;
    for (const creature of this.creatures) {
      if (creature.packId !== packId) {
        continue;
      }
      const distance = Math.hypot(creature.x - point.x, creature.y - point.y);
      if (distance <= radius) {
        density += 1 / (distance + 1);
      }
    }
    return density;
  }

  private ensureTerritoryForSpecies(species: CreatureSpecies, preferredCenter?: GridPosition): CreatureTerritory | undefined {
    const existing = this.territories.get(species);
    if (existing) {
      return existing;
    }
    const profile = speciesProfiles[species];
    if (!this.isTerritorial(profile)) {
      return undefined;
    }

    const radius = profile.territoryRadius ?? profile.groupRadius * 1.8;
    const zocRadius = radius + TERRITORY_ZOC_BUFFER;
    const center = preferredCenter
      ? this.resolveTerritoryZoc(species, preferredCenter, radius)
      : this.findTerritoryAnchor(species, radius, zocRadius);
    const territory: CreatureTerritory = {
      packId: this.nextPackId++,
      species,
      x: center.x,
      y: center.y,
      radius,
      zocRadius,
      strength: 0.56,
      pressure: 0,
    };
    this.territories.set(species, territory);
    return territory;
  }

  private isTerritorial(profile: SpeciesProfile): boolean {
    return profile.kind === 'carnivore' && Boolean(profile.territoryRadius);
  }

  private averagePosition(creatures: Creature[]): GridPosition {
    const total = creatures.reduce(
      (sum, creature) => ({
        x: sum.x + creature.x,
        y: sum.y + creature.y,
      }),
      { x: 0, y: 0 },
    );
    return {
      x: total.x / creatures.length,
      y: total.y / creatures.length,
    };
  }

  private distanceFromTerritory(point: GridPosition, territory: CreatureTerritory): number {
    return Math.hypot(point.x - territory.x, point.y - territory.y);
  }

  private rivalCarnivorePressure(territory: CreatureTerritory, ownSpecies: CreatureSpecies): number {
    let pressure = 0;
    for (const creature of this.creatures) {
      const profile = speciesProfiles[creature.species];
      if (creature.species === ownSpecies || profile.kind !== 'carnivore') {
        continue;
      }
      const distance = this.distanceFromTerritory(creature, territory);
      if (distance <= territory.zocRadius) {
        const speciesWeight = creature.species === territory.species ? 1.18 : 0.82;
        pressure += (1 - distance / Math.max(1, territory.zocRadius)) * speciesWeight;
      }
    }
    return pressure;
  }

  private rivalTerritoryPressureAt(point: GridPosition, ownSpecies?: CreatureSpecies): number {
    let pressure = 0;
    for (const territory of this.territories.values()) {
      if (ownSpecies && territory.species === ownSpecies) {
        continue;
      }
      const distance = this.distanceFromTerritory(point, territory);
      if (distance <= territory.zocRadius) {
        const insideCore = distance <= territory.radius;
        const falloff = 1 - distance / Math.max(1, territory.zocRadius);
        pressure += falloff * territory.strength * (insideCore ? 1.0 : 0.46);
      }
    }
    return pressure;
  }

  private territoryMoveScore(creature: Creature, profile: SpeciesProfile, point: GridPosition): number {
    const rivalPenalty = this.rivalTerritoryPressureAt(point, creature.species) * (profile.kind === 'carnivore' ? 0.58 : 0.16);
    if (!this.isTerritorial(profile)) {
      return -rivalPenalty;
    }

    const territory = this.territories.get(creature.species);
    if (!territory) {
      return -rivalPenalty;
    }

    const distance = this.distanceFromTerritory(point, territory);
    const homeScore = distance <= territory.radius
      ? clamp01(1 - distance / Math.max(1, territory.radius)) * 0.48
      : -(distance - territory.radius) * 0.28;
    return homeScore - rivalPenalty;
  }

  private findTerritoryPatrolPoint(origin: Creature, territory: CreatureTerritory): GridPosition {
    const profile = speciesProfiles[origin.species];
    let best: GridPosition = territory;
    let bestScore = -Infinity;
    this.environment.forEachInRadius(territory, territory.radius, (cell, distance, x, y) => {
      if (!this.isWalkable(x, y)) {
        return;
      }
      const point = { x, y };
      const preyPressure = this.preyPressureAt(point, profile.prey, 6);
      const edgePatrol = 1 - Math.abs(distance - territory.radius * 0.58) / Math.max(1, territory.radius);
      const rivalPressure = this.rivalTerritoryPressureAt(point, origin.species);
      const score =
        preyPressure * 0.8 +
        edgePatrol * 0.22 +
        cell.water * 0.08 -
        cell.heat * 0.32 -
        cell.toxicity * 0.42 -
        rivalPressure * 0.36 -
        Math.hypot(origin.x - x, origin.y - y) * 0.025;
      if (score > bestScore) {
        bestScore = score;
        best = point;
      }
    });
    return best;
  }

  private preyPressureAt(point: GridPosition, preySpecies: CreatureSpecies[], radius: number): number {
    let pressure = 0;
    for (const creature of this.creatures) {
      if (!preySpecies.includes(creature.species)) {
        continue;
      }
      const distance = Math.hypot(creature.x - point.x, creature.y - point.y);
      if (distance <= radius) {
        pressure += 1 / (distance + 1);
      }
    }
    return pressure;
  }

  private findTerritoryAnchor(species: CreatureSpecies, radius: number, zocRadius: number): GridPosition {
    let best = this.randomWalkablePointInsideZoc(zocRadius);
    let bestScore = -Infinity;

    for (let attempt = 0; attempt < 180; attempt += 1) {
      const candidate = this.randomWalkablePointInsideZoc(zocRadius);
      const separated = this.resolveTerritoryZoc(species, candidate, radius);
      const sx = Math.round(separated.x);
      const sy = Math.round(separated.y);
      const cell = this.environment.getCell(sx, sy);
      if (!cell || !this.isWalkable(sx, sy)) {
        continue;
      }
      let clearance = Infinity;
      for (const territory of this.territories.values()) {
        const distance = this.distanceFromTerritory(separated, territory);
        clearance = Math.min(clearance, distance - (radius + TERRITORY_ZOC_BUFFER + territory.zocRadius));
      }
      const habitatScore = cell.terrain === 'forest' && species === 'fox' ? 0.8 : cell.terrain === 'grassland' && species === 'wolf' ? 0.7 : 0;
      const score = (Number.isFinite(clearance) ? clearance : 20) + habitatScore + cell.grass * 0.3 - cell.heat * 0.5 - cell.toxicity * 0.7;
      if (score > bestScore) {
        bestScore = score;
        best = separated;
      }
    }

    return this.resolveTerritoryZoc(species, best, radius);
  }

  private resolveTerritoryZoc(species: CreatureSpecies, point: GridPosition, radius: number): GridPosition {
    const zocRadius = radius + TERRITORY_ZOC_BUFFER;
    const resolved = this.keepTerritoryInsideMap(point, zocRadius);
    for (let pass = 0; pass < 4; pass += 1) {
      for (const territory of this.territories.values()) {
        if (territory.species === species) {
          continue;
        }
        const minDistance = zocRadius + territory.zocRadius;
        const dx = resolved.x - territory.x;
        const dy = resolved.y - territory.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= minDistance) {
          continue;
        }
        const angle = distance > 0.001 ? Math.atan2(dy, dx) : Phaser.Math.FloatBetween(0, Math.PI * 2);
        const push = minDistance - distance;
        resolved.x += Math.cos(angle) * push;
        resolved.y += Math.sin(angle) * push;
        const clamped = this.keepTerritoryInsideMap(resolved, zocRadius);
        resolved.x = clamped.x;
        resolved.y = clamped.y;
      }
    }
    return resolved;
  }

  private keepTerritoryInsideMap(point: GridPosition, zocRadius: number): GridPosition {
    return {
      x: clamp(point.x, zocRadius, Math.max(zocRadius, this.environment.width - 1 - zocRadius)),
      y: clamp(point.y, zocRadius, Math.max(zocRadius, this.environment.height - 1 - zocRadius)),
    };
  }

  private randomWalkablePointInsideZoc(zocRadius: number): GridPosition {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const x = Phaser.Math.Between(Math.ceil(zocRadius), Math.floor(this.environment.width - 1 - zocRadius));
      const y = Phaser.Math.Between(Math.ceil(zocRadius), Math.floor(this.environment.height - 1 - zocRadius));
      if (this.isWalkable(x, y)) {
        return { x, y };
      }
    }
    return {
      x: clamp(this.environment.width / 2, zocRadius, this.environment.width - 1 - zocRadius),
      y: clamp(this.environment.height / 2, zocRadius, this.environment.height - 1 - zocRadius),
    };
  }

  private findWalkableInTerritory(territory: CreatureTerritory, innerScale: number): GridPosition | undefined {
    const radius = Math.max(2, territory.radius * innerScale);
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Math.sqrt(Math.random()) * radius;
      const x = Math.round(territory.x + Math.cos(angle) * distance);
      const y = Math.round(territory.y + Math.sin(angle) * distance);
      if (this.isWalkable(x, y) && this.distanceFromTerritory({ x, y }, territory) <= territory.radius) {
        return { x, y };
      }
    }
    return this.isWalkable(Math.round(territory.x), Math.round(territory.y))
      ? { x: Math.round(territory.x), y: Math.round(territory.y) }
      : undefined;
  }

  private findNearbyWalkable(origin: GridPosition, radius: number): GridPosition | undefined {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const x = clamp(origin.x + Phaser.Math.Between(-radius, radius), 0, this.environment.width - 1);
      const y = clamp(origin.y + Phaser.Math.Between(-radius, radius), 0, this.environment.height - 1);
      if (this.isWalkable(x, y)) {
        return { x, y };
      }
    }
    return undefined;
  }

  private isWalkable(x: number, y: number): boolean {
    const cell = this.environment.getCell(x, y);
    return Boolean(cell && cell.terrain !== 'water' && cell.terrain !== 'crater' && cell.terrain !== 'mountain' && cell.heat < 0.98);
  }

  private spawnInitialPopulation(): void {
    this.spawnCluster('hare', 10, 5, 0.54, 0.95);
    this.spawnCluster('deer', 7, 6, 0.62, 1.05);
    this.spawnCluster('boar', 5, 4, 0.72, 1.12);
    this.spawnCluster('wolf', 5, 3, 0.86, 1.24);
    this.spawnCluster('fox', 6, 3, 0.74, 1.12);
    this.spawnCluster('bear', 5, 1, 0.9, 1.28);
    this.spawnCluster('vulture', 5, 2, 0.62, 1.0);
  }

  private spawnCluster(species: CreatureSpecies, groups: number, perGroup: number, minEnergy: number, maxEnergy: number): void {
    const profile = speciesProfiles[species];
    if (this.isTerritorial(profile)) {
      this.spawnTerritorialSpecies(species, groups * perGroup, minEnergy, maxEnergy);
      return;
    }

    for (let group = 0; group < groups; group += 1) {
      const center = this.randomWalkablePoint();
      const packId = this.nextPackId++;
      for (let i = 0; i < perGroup; i += 1) {
        const point = this.findNearbyWalkable(center, profile.kind === 'carnivore' ? 8 : 6) ?? center;
        this.addCreature(species, point.x, point.y, Phaser.Math.FloatBetween(minEnergy, maxEnergy), packId);
      }
    }
  }

  private spawnTerritorialSpecies(species: CreatureSpecies, count: number, minEnergy: number, maxEnergy: number): void {
    const territory = this.ensureTerritoryForSpecies(species);
    if (!territory) {
      return;
    }

    for (let i = 0; i < count; i += 1) {
      const point = this.findWalkableInTerritory(territory, 0.74) ?? this.findNearbyWalkable(territory, Math.floor(territory.radius * 0.65)) ?? territory;
      this.addCreature(species, point.x, point.y, Phaser.Math.FloatBetween(minEnergy, maxEnergy), territory.packId);
    }
  }

  private randomWalkablePoint(): GridPosition {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const x = Phaser.Math.Between(0, this.environment.width - 1);
      const y = Phaser.Math.Between(0, this.environment.height - 1);
      if (this.isWalkable(x, y)) {
        return { x, y };
      }
    }
    return { x: 0, y: 0 };
  }

  private addCreature(species: CreatureSpecies, x: number, y: number, energy: number, packId?: number): Creature {
    const profile = speciesProfiles[species];
    const state: CreatureState = profile.kind === 'carnivore' ? 'hunting' : profile.kind === 'scavenger' ? 'scavenging' : 'foraging';
    const territory = this.ensureTerritoryForSpecies(species, { x, y });
    const resolvedPackId = territory?.packId ?? packId ?? this.nextPackId++;
    const creature: Creature = {
      id: this.nextId++,
      kind: profile.kind,
      species,
      x,
      y,
      energy,
      age: 0,
      moveCooldown: Phaser.Math.FloatBetween(0.05, 0.35),
      reproductionCooldown: Phaser.Math.FloatBetween(1.5, 4),
      stress: Phaser.Math.FloatBetween(0.04, 0.18),
      sickness: 0,
      state,
      packId: resolvedPackId,
    };
    this.creatures.push(creature);
    return creature;
  }

  private countKind(kind: CreatureKind): number {
    return this.creatures.filter((creature) => creature.kind === kind).length;
  }
}
