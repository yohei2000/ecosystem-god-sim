import * as Phaser from 'phaser';
import type { Corpse, Creature, CreatureEvent, CreatureKind, EcosystemStats, GridPosition } from '../types';
import { EnvironmentSystem } from './EnvironmentSystem';

const MAX_CREATURES = 220;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export class CreatureSystem {
  readonly creatures: Creature[] = [];
  readonly corpses: Corpse[] = [];
  private readonly events: CreatureEvent[] = [];
  private nextId = 1;

  constructor(private readonly environment: EnvironmentSystem) {
    this.spawnInitialPopulation();
  }

  update(deltaSeconds: number): void {
    const dt = Math.min(deltaSeconds, 0.25);
    this.updateCorpses(dt);

    for (const creature of [...this.creatures]) {
      creature.age += dt;
      creature.energy -= (creature.kind === 'herbivore' ? 0.035 : 0.05) * dt;
      creature.moveCooldown -= dt;
      creature.reproductionCooldown = Math.max(0, creature.reproductionCooldown - dt);

      const cell = this.environment.getCell(creature.x, creature.y);
      if (
        !cell ||
        cell.terrain === 'water' ||
        cell.terrain === 'crater' ||
        cell.terrain === 'mountain' ||
        cell.heat > 0.93
      ) {
        creature.energy -= 0.22 * dt;
      }

      if (creature.moveCooldown <= 0) {
        if (creature.kind === 'herbivore') {
          this.updateHerbivore(creature);
        } else {
          this.updateCarnivore(creature);
        }
        creature.moveCooldown = creature.kind === 'herbivore' ? 0.2 : 0.16;
      }

      this.tryReproduce(creature, dt);

      if (creature.energy <= 0) {
        this.killCreature(creature);
      }
    }
  }

  killCreaturesInRadius(center: GridPosition, radius: number): number {
    let killed = 0;
    for (const creature of [...this.creatures]) {
      if (Math.hypot(creature.x - center.x, creature.y - center.y) <= radius) {
        this.killCreature(creature);
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
    const herbivores = this.creatures.filter((creature) => creature.kind === 'herbivore').length;
    const carnivores = this.creatures.filter((creature) => creature.kind === 'carnivore').length;
    const targetGrass = this.environment.width * this.environment.height * 0.5;
    const targetHerbivores = Math.round(this.environment.width * this.environment.height * 0.019);
    const targetCarnivores = Math.max(10, Math.round(targetHerbivores * 0.28));
    const grassScore = clamp(grass / targetGrass, 0, 1);
    const herbivoreScore = clamp(1 - Math.abs(herbivores - targetHerbivores) / targetHerbivores, 0, 1);
    const carnivoreScore = clamp(1 - Math.abs(carnivores - targetCarnivores) / targetCarnivores, 0, 1);
    const ratioScore = herbivores === 0 ? 0 : clamp(1 - Math.abs(carnivores / herbivores - 0.28) / 0.4, 0, 1);

    return {
      grass,
      herbivores,
      carnivores,
      stability: Math.round((grassScore * 0.35 + herbivoreScore * 0.25 + carnivoreScore * 0.2 + ratioScore * 0.2) * 100),
    };
  }

  private updateHerbivore(creature: Creature): void {
    const target = this.findBestGrass(creature, 9);
    this.stepToward(creature, target);

    const cell = this.environment.getCell(creature.x, creature.y);
    if (cell && cell.grass > 0.08) {
      const eaten = Math.min(cell.grass, 0.24);
      cell.grass -= eaten;
      creature.energy = clamp(creature.energy + eaten * 1.25, 0, 1.5);
    }
  }

  private updateCarnivore(creature: Creature): void {
    const prey = this.findNearestCreature(creature, 'herbivore', 13);
    if (prey) {
      this.stepToward(creature, prey);
      const caught = this.findNearestCreature(creature, 'herbivore', 1.75);
      if (caught) {
        this.killCreature(caught);
        creature.energy = clamp(creature.energy + 0.85, 0, 1.8);
      }
      return;
    }

    this.stepToward(creature, {
      x: creature.x + Phaser.Math.Between(-1, 1),
      y: creature.y + Phaser.Math.Between(-1, 1),
    });
  }

  private updateCorpses(dt: number): void {
    for (const corpse of [...this.corpses]) {
      const released = Math.min(corpse.nutrientsLeft, 0.16 * dt);
      corpse.nutrientsLeft -= released;
      corpse.decay += dt;
      this.environment.forEachInRadius(corpse, 2, (cell, distance) => {
        cell.nutrient = clamp(cell.nutrient + (released / (distance + 1)) * 0.45, 0, 1);
      });

      if (corpse.nutrientsLeft <= 0.01 || corpse.decay > 18) {
        this.corpses.splice(this.corpses.indexOf(corpse), 1);
      }
    }
  }

  private tryReproduce(parent: Creature, dt: number): void {
    const energyThreshold = parent.kind === 'herbivore' ? 1.02 : 0.95;
    if (
      this.creatures.length >= MAX_CREATURES ||
      parent.age < 3 ||
      parent.reproductionCooldown > 0 ||
      parent.energy < energyThreshold ||
      !this.hasReproductionSupport(parent)
    ) {
      return;
    }

    const reproductionRate = parent.kind === 'herbivore' ? 0.18 : 0.24;
    const chance = 1 - Math.exp(-reproductionRate * dt);
    if (Math.random() > chance) {
      return;
    }

    const point = this.findNearbyWalkable(parent, 5);
    if (!point) {
      return;
    }

    const birthCost = parent.kind === 'herbivore' ? 0.38 : 0.36;
    parent.energy = clamp(parent.energy - birthCost, 0.25, 1.8);
    parent.reproductionCooldown = parent.kind === 'herbivore' ? 7 : 8.5;

    const child = this.addCreature(parent.kind, point.x, point.y, parent.kind === 'herbivore' ? 0.62 : 0.82);
    child.reproductionCooldown = parent.kind === 'herbivore' ? 8.5 : 9.5;
    this.events.push({ type: 'birth', kind: parent.kind, x: point.x, y: point.y });
  }

  private hasReproductionSupport(parent: Creature): boolean {
    if (parent.kind === 'herbivore') {
      let nearbyGrass = 0;
      this.environment.forEachInRadius(parent, 5, (cell, distance) => {
        nearbyGrass += cell.grass / (distance + 1);
      });
      return nearbyGrass > 0.85;
    }

    let nearbyPrey = 0;
    let nearbyPredators = 0;
    for (const creature of this.creatures) {
      const distance = Math.hypot(creature.x - parent.x, creature.y - parent.y);
      if (creature.kind === 'herbivore' && distance <= 12) {
        nearbyPrey += 1;
      }
      if (creature.kind === 'carnivore' && distance <= 7) {
        nearbyPredators += 1;
      }
    }
    return nearbyPrey >= Math.max(2, nearbyPredators);
  }

  private killCreature(creature: Creature): void {
    const index = this.creatures.indexOf(creature);
    if (index === -1) {
      return;
    }
    this.creatures.splice(index, 1);
    this.corpses.push({
      id: this.nextId++,
      x: creature.x,
      y: creature.y,
      nutrientsLeft: creature.kind === 'herbivore' ? 0.45 : 0.75,
      decay: 0,
    });
  }

  private stepToward(creature: Creature, target: GridPosition): void {
    const dx = Math.sign(target.x - creature.x);
    const dy = Math.sign(target.y - creature.y);
    const options = [
      { x: creature.x + dx, y: creature.y },
      { x: creature.x, y: creature.y + dy },
      { x: creature.x + Phaser.Math.Between(-1, 1), y: creature.y + Phaser.Math.Between(-1, 1) },
    ];

    const next = options.find((point) => this.isWalkable(point.x, point.y));
    if (next) {
      creature.x = next.x;
      creature.y = next.y;
    }
  }

  private findBestGrass(origin: GridPosition, radius: number): GridPosition {
    let best: GridPosition = origin;
    let bestScore = -Infinity;
    this.environment.forEachInRadius(origin, radius, (cell, distance, x, y) => {
      if (!this.isWalkable(x, y)) {
        return;
      }
      const score = cell.grass * 2 + cell.water * 0.2 + cell.nutrient * 0.15 - distance * 0.08 - cell.heat * 0.6;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    });
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

  private findNearbyWalkable(origin: GridPosition, radius: number): GridPosition | undefined {
    for (let attempt = 0; attempt < 18; attempt += 1) {
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
    return Boolean(cell && cell.terrain !== 'water' && cell.terrain !== 'crater' && cell.terrain !== 'mountain');
  }

  private spawnInitialPopulation(): void {
    for (let i = 0; i < 58; i += 1) {
      const point = this.randomWalkablePoint();
      this.addCreature('herbivore', point.x, point.y, Phaser.Math.FloatBetween(0.55, 1.02));
    }
    for (let i = 0; i < 15; i += 1) {
      const point = this.randomWalkablePoint();
      this.addCreature('carnivore', point.x, point.y, Phaser.Math.FloatBetween(0.85, 1.24));
    }
  }

  private randomWalkablePoint(): GridPosition {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const x = Phaser.Math.Between(0, this.environment.width - 1);
      const y = Phaser.Math.Between(0, this.environment.height - 1);
      if (this.isWalkable(x, y)) {
        return { x, y };
      }
    }
    return { x: 0, y: 0 };
  }

  private addCreature(kind: CreatureKind, x: number, y: number, energy: number): Creature {
    const creature: Creature = {
      id: this.nextId++,
      kind,
      x,
      y,
      energy,
      age: 0,
      moveCooldown: Phaser.Math.FloatBetween(0.05, 0.35),
      reproductionCooldown: Phaser.Math.FloatBetween(1.5, 4),
    };
    this.creatures.push(creature);
    return creature;
  }
}
