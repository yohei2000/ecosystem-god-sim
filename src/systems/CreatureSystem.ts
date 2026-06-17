import * as Phaser from 'phaser';
import type { Corpse, Creature, CreatureKind, EcosystemStats, GridPosition } from '../types';
import { EnvironmentSystem } from './EnvironmentSystem';

const MAX_CREATURES = 120;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export class CreatureSystem {
  readonly creatures: Creature[] = [];
  readonly corpses: Corpse[] = [];
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

      const cell = this.environment.getCell(creature.x, creature.y);
      if (!cell || cell.terrain === 'water' || cell.terrain === 'crater' || cell.heat > 0.93) {
        creature.energy -= 0.22 * dt;
      }

      if (creature.moveCooldown <= 0) {
        if (creature.kind === 'herbivore') {
          this.updateHerbivore(creature);
        } else {
          this.updateCarnivore(creature);
        }
        creature.moveCooldown = creature.kind === 'herbivore' ? 0.28 : 0.22;
      }

      this.tryReproduce(creature);

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
      const point = this.findNearbyWalkable(center, 4);
      if (point) {
        this.addCreature('herbivore', point.x, point.y, 0.65);
      }
    }
  }

  getStats(): EcosystemStats {
    const grass = this.environment.cells.reduce((total, cell) => total + cell.grass, 0);
    const herbivores = this.creatures.filter((creature) => creature.kind === 'herbivore').length;
    const carnivores = this.creatures.filter((creature) => creature.kind === 'carnivore').length;
    const grassScore = clamp(grass / 760, 0, 1);
    const herbivoreScore = clamp(1 - Math.abs(herbivores - 38) / 38, 0, 1);
    const carnivoreScore = clamp(1 - Math.abs(carnivores - 12) / 12, 0, 1);
    const ratioScore = herbivores === 0 ? 0 : clamp(1 - Math.abs(carnivores / herbivores - 0.28) / 0.4, 0, 1);

    return {
      grass,
      herbivores,
      carnivores,
      stability: Math.round((grassScore * 0.35 + herbivoreScore * 0.25 + carnivoreScore * 0.2 + ratioScore * 0.2) * 100),
    };
  }

  private updateHerbivore(creature: Creature): void {
    const target = this.findBestGrass(creature, 6);
    this.stepToward(creature, target);

    const cell = this.environment.getCell(creature.x, creature.y);
    if (cell && cell.grass > 0.08) {
      const eaten = Math.min(cell.grass, 0.24);
      cell.grass -= eaten;
      creature.energy = clamp(creature.energy + eaten * 1.25, 0, 1.5);
    }
  }

  private updateCarnivore(creature: Creature): void {
    const prey = this.findNearestCreature(creature, 'herbivore', 9);
    if (prey) {
      this.stepToward(creature, prey);
      if (creature.x === prey.x && creature.y === prey.y) {
        this.killCreature(prey);
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

  private tryReproduce(parent: Creature): void {
    if (this.creatures.length >= MAX_CREATURES || parent.energy < (parent.kind === 'herbivore' ? 1.05 : 1.2)) {
      return;
    }

    const chance = parent.kind === 'herbivore' ? 0.025 : 0.014;
    if (Math.random() > chance) {
      return;
    }

    const point = this.findNearbyWalkable(parent, 2);
    if (!point) {
      return;
    }

    parent.energy *= 0.58;
    this.addCreature(parent.kind, point.x, point.y, parent.kind === 'herbivore' ? 0.55 : 0.7);
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
    return Boolean(cell && cell.terrain !== 'water' && cell.terrain !== 'crater');
  }

  private spawnInitialPopulation(): void {
    for (let i = 0; i < 34; i += 1) {
      const point = this.randomWalkablePoint();
      this.addCreature('herbivore', point.x, point.y, Phaser.Math.FloatBetween(0.45, 0.9));
    }
    for (let i = 0; i < 9; i += 1) {
      const point = this.randomWalkablePoint();
      this.addCreature('carnivore', point.x, point.y, Phaser.Math.FloatBetween(0.65, 1.1));
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

  private addCreature(kind: CreatureKind, x: number, y: number, energy: number): void {
    this.creatures.push({
      id: this.nextId++,
      kind,
      x,
      y,
      energy,
      age: 0,
      moveCooldown: Phaser.Math.FloatBetween(0.05, 0.35),
    });
  }
}
