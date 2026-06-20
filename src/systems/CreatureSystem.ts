import * as Phaser from 'phaser';
import type { Corpse, Creature, CreatureEvent, CreatureKind, CreatureState, EcosystemStats, GridPosition } from '../types';
import { EnvironmentSystem } from './EnvironmentSystem';

const MAX_CREATURES = 340;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => clamp(value, 0, 1);

export class CreatureSystem {
  readonly creatures: Creature[] = [];
  readonly corpses: Corpse[] = [];
  private readonly events: CreatureEvent[] = [];
  private nextId = 1;
  private nextPackId = 1;

  constructor(private readonly environment: EnvironmentSystem) {
    this.spawnInitialPopulation();
  }

  update(deltaSeconds: number): void {
    const dt = Math.min(deltaSeconds, 0.25);
    this.updateCorpses(dt);
    const climate = this.environment.getClimate();

    for (const creature of [...this.creatures]) {
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
      creature.stress = clamp01(creature.stress + (terrainStress + weatherStress) * dt - 0.05 * dt);
      creature.sickness = clamp01(creature.sickness + this.sicknessPressure(creature) * dt - this.recoveryRate(creature) * dt);

      const metabolism = creature.kind === 'herbivore' ? 0.033 : 0.052;
      creature.energy -= (metabolism + creature.stress * 0.048 + creature.sickness * 0.075) * dt;
      if (creature.sickness > 0.72 && Math.random() < 0.01 * dt) {
        this.events.push({ type: 'outbreak', kind: creature.kind, x: creature.x, y: creature.y });
      }

      if (creature.moveCooldown <= 0) {
        if (creature.kind === 'herbivore') {
          this.updateHerbivore(creature);
        } else {
          this.updateCarnivore(creature);
        }
        const baseCooldown = creature.kind === 'herbivore' ? 0.19 : 0.145;
        creature.moveCooldown = baseCooldown + creature.stress * 0.08 + creature.sickness * 0.08;
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
    for (let i = 0; i < count; i += 1) {
      const point = this.findNearbyWalkable(center, 6);
      if (point) {
        this.addCreature('herbivore', point.x, point.y, 0.65);
      }
    }
  }

  consumeEvents(): CreatureEvent[] {
    return this.events.splice(0);
  }

  getStats(): EcosystemStats {
    const grass = this.environment.cells.reduce((total, cell) => total + cell.grass, 0);
    const fertilitySum = this.environment.cells.reduce(
      (total, cell) => total + cell.nutrient * 0.42 + cell.water * 0.28 + cell.fungus * 0.2 - cell.toxicity * 0.32,
      0,
    );
    const herbivores = this.creatures.filter((creature) => creature.kind === 'herbivore').length;
    const carnivores = this.creatures.filter((creature) => creature.kind === 'carnivore').length;
    const sick = this.creatures.filter((creature) => creature.sickness > 0.38).length;
    const targetGrass = this.environment.width * this.environment.height * 0.52;
    const targetHerbivores = Math.round(this.environment.width * this.environment.height * 0.02);
    const targetCarnivores = Math.max(12, Math.round(targetHerbivores * 0.24));
    const pressure = herbivores === 0 ? 1 : clamp(carnivores / Math.max(1, herbivores), 0, 1);
    const grassScore = clamp(grass / targetGrass, 0, 1);
    const herbivoreScore = clamp(1 - Math.abs(herbivores - targetHerbivores) / targetHerbivores, 0, 1);
    const carnivoreScore = clamp(1 - Math.abs(carnivores - targetCarnivores) / targetCarnivores, 0, 1);
    const ratioScore = herbivores === 0 ? 0 : clamp(1 - Math.abs(carnivores / herbivores - 0.24) / 0.36, 0, 1);
    const diseasePenalty = clamp(sick / Math.max(1, this.creatures.length), 0, 1);
    const carrionPenalty = clamp(this.corpses.length / 28, 0, 1);
    const fertility = clamp01(fertilitySum / this.environment.cells.length);
    const climate = this.environment.getClimate();

    return {
      grass,
      herbivores,
      carnivores,
      corpses: this.corpses.length,
      sick,
      pressure,
      fertility,
      season: climate.season,
      weather: climate.weather,
      stability: Math.round(
        (grassScore * 0.26 +
          herbivoreScore * 0.2 +
          carnivoreScore * 0.16 +
          ratioScore * 0.18 +
          fertility * 0.16 -
          diseasePenalty * 0.12 -
          carrionPenalty * 0.08) *
          100,
      ),
    };
  }

  private updateHerbivore(creature: Creature): void {
    const predator = this.findNearestCreature(creature, 'carnivore', 7.5);
    if (predator) {
      creature.state = 'fleeing';
      creature.stress = clamp01(creature.stress + 0.18);
      this.stepAway(creature, predator);
      return;
    }

    const target = this.findBestGrass(creature, 10);
    this.stepToward(creature, target);

    const cell = this.environment.getCell(creature.x, creature.y);
    if (cell && cell.grass > 0.08) {
      const eaten = Math.min(cell.grass, 0.22 + (creature.energy < 0.35 ? 0.08 : 0));
      cell.grass -= eaten;
      cell.nutrient = clamp01(cell.nutrient + eaten * 0.022);
      creature.energy = clamp(creature.energy + eaten * 1.22, 0, 1.55);
      creature.stress = clamp01(creature.stress - 0.05);
      creature.state = creature.energy < 0.42 ? 'starving' : 'grazing';
      return;
    }

    const herd = this.findHerdCenter(creature, 7);
    if (herd && Math.random() < 0.35) {
      creature.state = 'foraging';
      this.stepToward(creature, herd);
    } else {
      creature.state = creature.energy < 0.38 ? 'starving' : 'foraging';
    }
  }

  private updateCarnivore(creature: Creature): void {
    const corpse = creature.energy < 0.78 ? this.findNearestCorpse(creature, 8) : undefined;
    if (corpse) {
      creature.state = 'scavenging';
      this.stepToward(creature, corpse);
      if (Math.hypot(corpse.x - creature.x, corpse.y - creature.y) <= 1.65) {
        const eaten = Math.min(corpse.nutrientsLeft, 0.3);
        corpse.nutrientsLeft -= eaten;
        creature.energy = clamp(creature.energy + eaten * 1.45, 0, 1.85);
        creature.sickness = clamp01(creature.sickness + (corpse.decay > 8 ? 0.035 : 0.01));
        this.events.push({ type: 'scavenge', kind: 'carnivore', x: creature.x, y: creature.y });
      }
      return;
    }

    const prey = this.findBestPrey(creature, 14);
    if (prey) {
      creature.state = 'hunting';
      this.stepToward(creature, prey);
      const caught = this.findBestPrey(creature, 1.75);
      if (caught) {
        this.killCreature(caught, 'hunt');
        creature.energy = clamp(creature.energy + 0.78 + caught.sickness * 0.12, 0, 1.9);
        creature.stress = clamp01(creature.stress - 0.08);
        this.events.push({ type: 'hunt', kind: 'carnivore', x: creature.x, y: creature.y });
      }
      return;
    }

    const pack = this.findPackCenter(creature, 8);
    if (pack && Math.random() < 0.32) {
      creature.state = 'hunting';
      this.stepToward(creature, pack);
      return;
    }

    creature.state = creature.energy < 0.35 ? 'starving' : 'foraging';
    this.stepToward(creature, {
      x: creature.x + Phaser.Math.Between(-1, 1),
      y: creature.y + Phaser.Math.Between(-1, 1),
    });
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
    const climate = this.environment.getClimate();
    const seasonMultiplier = climate.season === 'spring' ? 1.38 : climate.season === 'summer' ? 1.08 : climate.season === 'winter' ? 0.34 : 0.74;
    const energyThreshold = parent.kind === 'herbivore' ? 1.0 : 1.08;
    if (
      this.creatures.length >= MAX_CREATURES ||
      parent.age < 3.5 ||
      parent.reproductionCooldown > 0 ||
      parent.energy < energyThreshold ||
      parent.sickness > 0.28 ||
      parent.stress > 0.62 ||
      !this.hasReproductionSupport(parent)
    ) {
      return;
    }

    const reproductionRate = (parent.kind === 'herbivore' ? 0.2 : 0.11) * seasonMultiplier;
    const chance = 1 - Math.exp(-reproductionRate * dt);
    if (Math.random() > chance) {
      return;
    }

    const point = this.findNearbyWalkable(parent, 5);
    if (!point) {
      return;
    }

    const birthCost = parent.kind === 'herbivore' ? 0.38 : 0.42;
    parent.energy = clamp(parent.energy - birthCost, 0.25, 1.8);
    parent.reproductionCooldown = parent.kind === 'herbivore' ? 7.5 : 10.5;
    parent.state = 'mating';

    const child = this.addCreature(parent.kind, point.x, point.y, parent.kind === 'herbivore' ? 0.62 : 0.82, parent.packId);
    child.reproductionCooldown = parent.kind === 'herbivore' ? 8.5 : 12;
    this.events.push({ type: 'birth', kind: parent.kind, x: point.x, y: point.y });
  }

  private hasReproductionSupport(parent: Creature): boolean {
    if (parent.kind === 'herbivore') {
      let nearbyGrass = 0;
      let nearbyFriends = 0;
      this.environment.forEachInRadius(parent, 5, (cell, distance) => {
        nearbyGrass += cell.grass / (distance + 1);
      });
      for (const creature of this.creatures) {
        if (creature.kind === 'herbivore' && creature !== parent && Math.hypot(creature.x - parent.x, creature.y - parent.y) <= 6) {
          nearbyFriends += 1;
        }
      }
      return nearbyGrass > 0.95 && nearbyFriends >= 1;
    }

    let nearbyPrey = 0;
    let nearbyPredators = 0;
    for (const creature of this.creatures) {
      const distance = Math.hypot(creature.x - parent.x, creature.y - parent.y);
      if (creature.kind === 'herbivore' && distance <= 13) {
        nearbyPrey += 1;
      }
      if (creature.kind === 'carnivore' && distance <= 8) {
        nearbyPredators += 1;
      }
    }
    return nearbyPrey >= Math.max(3, nearbyPredators * 2);
  }

  private sicknessPressure(creature: Creature): number {
    const cell = this.environment.getCell(creature.x, creature.y);
    let pressure = cell ? cell.toxicity * 0.04 + Math.max(0, cell.heat - 0.78) * 0.035 : 0.05;
    for (const corpse of this.corpses) {
      const distance = Math.hypot(corpse.x - creature.x, corpse.y - creature.y);
      if (distance <= 3.5 && corpse.decay > 5) {
        pressure += (0.035 / (distance + 1)) * (creature.kind === 'carnivore' ? 1.2 : 1);
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
    this.creatures.splice(index, 1);
    this.corpses.push({
      id: this.nextId++,
      x: creature.x,
      y: creature.y,
      nutrientsLeft: creature.kind === 'herbivore' ? 0.45 : 0.78,
      decay: 0,
    });
    if (reason === 'outbreak') {
      this.events.push({ type: 'outbreak', kind: creature.kind, x: creature.x, y: creature.y });
    } else if (reason === 'death' && Math.random() < 0.08) {
      this.events.push({ type: 'death', kind: creature.kind, x: creature.x, y: creature.y });
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
    const distance = Math.hypot(point.x - target.x, point.y - target.y);
    const terrainComfort = cell.grass * (creature.kind === 'herbivore' ? 0.42 : 0.08) + cell.water * 0.08 + cell.fungus * 0.04;
    const danger = cell.heat * 0.28 + cell.toxicity * 0.5 + (cell.terrain === 'wasteland' ? 0.08 : 0);
    const predatorPressure = creature.kind === 'herbivore' ? this.predatorPressureAt(point, 5) * 0.9 : 0;
    return -distance + terrainComfort - danger - predatorPressure;
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

  private findBestGrass(origin: Creature, radius: number): GridPosition {
    let best: GridPosition = origin;
    let bestScore = -Infinity;
    this.environment.forEachInRadius(origin, radius, (cell, distance, x, y) => {
      if (!this.isWalkable(x, y)) {
        return;
      }
      const herd = this.herdDensityAt({ x, y }, origin.packId, 5);
      const score =
        cell.grass * 2.1 +
        cell.water * 0.34 +
        cell.nutrient * 0.14 +
        cell.fungus * 0.08 +
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

  private findBestPrey(origin: Creature, radius: number): Creature | undefined {
    let best: Creature | undefined;
    let bestScore = -Infinity;
    for (const prey of this.creatures) {
      if (prey.kind !== 'herbivore') {
        continue;
      }
      const distance = Math.hypot(prey.x - origin.x, prey.y - origin.y);
      if (distance > radius) {
        continue;
      }
      const herdDensity = this.herdDensityAt(prey, prey.packId, 5);
      const score = (1.2 - prey.energy) * 1.2 + prey.sickness * 0.8 + prey.stress * 0.4 - distance * 0.12 - herdDensity * 0.08;
      if (score > bestScore) {
        bestScore = score;
        best = prey;
      }
    }
    return best;
  }

  private findNearestCreature(origin: GridPosition, kind: CreatureKind, radius: number): Creature | undefined {
    let nearest: Creature | undefined;
    let nearestDistance = Infinity;
    for (const creature of this.creatures) {
      if (creature.kind !== kind) {
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

  private findNearestCorpse(origin: GridPosition, radius: number): Corpse | undefined {
    let nearest: Corpse | undefined;
    let nearestDistance = Infinity;
    for (const corpse of this.corpses) {
      const distance = Math.hypot(corpse.x - origin.x, corpse.y - origin.y);
      if (distance < nearestDistance && distance <= radius) {
        nearestDistance = distance;
        nearest = corpse;
      }
    }
    return nearest;
  }

  private findHerdCenter(origin: Creature, radius: number): GridPosition | undefined {
    let count = 0;
    let x = 0;
    let y = 0;
    for (const creature of this.creatures) {
      if (creature === origin || creature.kind !== origin.kind || creature.packId !== origin.packId) {
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
      if (creature.kind !== 'carnivore') {
        continue;
      }
      const distance = Math.hypot(creature.x - point.x, creature.y - point.y);
      if (distance <= radius) {
        pressure += 1 / (distance + 1);
      }
    }
    return pressure;
  }

  private herdDensityAt(point: GridPosition, packId: number, radius: number): number {
    let density = 0;
    for (const creature of this.creatures) {
      if (creature.kind !== 'herbivore' || creature.packId !== packId) {
        continue;
      }
      const distance = Math.hypot(creature.x - point.x, creature.y - point.y);
      if (distance <= radius) {
        density += 1 / (distance + 1);
      }
    }
    return density;
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
    for (let i = 0; i < 72; i += 1) {
      const point = this.randomWalkablePoint();
      this.addCreature('herbivore', point.x, point.y, Phaser.Math.FloatBetween(0.55, 1.02));
    }
    for (let i = 0; i < 18; i += 1) {
      const point = this.randomWalkablePoint();
      this.addCreature('carnivore', point.x, point.y, Phaser.Math.FloatBetween(0.85, 1.24));
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

  private addCreature(kind: CreatureKind, x: number, y: number, energy: number, packId?: number): Creature {
    const state: CreatureState = kind === 'herbivore' ? 'foraging' : 'hunting';
    const creature: Creature = {
      id: this.nextId++,
      kind,
      x,
      y,
      energy,
      age: 0,
      moveCooldown: Phaser.Math.FloatBetween(0.05, 0.35),
      reproductionCooldown: Phaser.Math.FloatBetween(1.5, 4),
      stress: Phaser.Math.FloatBetween(0.04, 0.18),
      sickness: 0,
      state,
      packId: packId ?? this.nextPackId++,
    };
    this.creatures.push(creature);
    return creature;
  }
}
