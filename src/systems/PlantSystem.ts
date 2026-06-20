import type { Cell, Terrain } from '../types';
import { EnvironmentSystem } from './EnvironmentSystem';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const seasonGrowth = {
  spring: 1.38,
  summer: 0.94,
  autumn: 0.72,
  winter: 0.34,
};

const weatherGrowth = {
  clear: 1,
  rain: 1.32,
  storm: 1.18,
  drought: 0.42,
  heatwave: 0.28,
  ashfall: 0.72,
};

export class PlantSystem {
  constructor(private readonly environment: EnvironmentSystem) {}

  update(deltaSeconds: number): void {
    const dt = Math.min(deltaSeconds, 0.25);
    const climate = this.environment.getClimate();

    for (let y = 0; y < this.environment.height; y += 1) {
      for (let x = 0; x < this.environment.width; x += 1) {
        const cell = this.environment.getCell(x, y);
        if (!cell) {
          continue;
        }
        this.updateCell(cell, x, y, dt, seasonGrowth[climate.season] * weatherGrowth[climate.weather]);
      }
    }
  }

  private updateCell(cell: Cell, x: number, y: number, dt: number, climateGrowth: number): void {
    if (cell.terrain === 'water') {
      cell.grass = clamp01(cell.grass - 0.22 * dt);
      return;
    }

    if (cell.terrain === 'crater') {
      cell.grass = clamp01(cell.grass - (0.2 + cell.toxicity * 0.25) * dt);
      this.tryTerrainRecovery(cell, x, y, dt);
      return;
    }

    const terrainBonus =
      cell.terrain === 'forest'
        ? 1.24
        : cell.terrain === 'wasteland'
          ? 0.48 + cell.fungus * 0.42
          : cell.terrain === 'mountain'
            ? 0.2
            : 1;
    const forestNeighbors = this.countTerrainAround(x, y, 2, 'forest');
    const shelterBonus = 1 + Math.min(0.22, forestNeighbors * 0.025);
    const growthPotential = cell.water * 0.46 + cell.nutrient * 0.42 + cell.fungus * 0.18;
    const heatStress = Math.max(0, cell.heat - 0.45);
    const toxicityStress = cell.toxicity * (cell.terrain === 'wasteland' ? 0.28 : 0.18);
    const growth = growthPotential * terrainBonus * climateGrowth * shelterBonus * 0.092 * dt;
    const decay = (heatStress * 0.34 + cell.ash * 0.045 + toxicityStress) * dt;

    cell.grass = clamp01(cell.grass + growth - decay);

    if (growth > decay) {
      cell.water = clamp01(cell.water - 0.018 * dt);
      cell.nutrient = clamp01(cell.nutrient - 0.012 * dt);
    }

    if (cell.terrain === 'forest') {
      cell.nutrient = clamp01(cell.nutrient + cell.fungus * 0.014 * dt);
      cell.heat = clamp01(cell.heat - 0.018 * dt);
    }

    this.tryTerrainRecovery(cell, x, y, dt);
    this.tryForestSuccession(cell, x, y, dt, forestNeighbors);
  }

  private tryTerrainRecovery(cell: Cell, _x: number, _y: number, dt: number): void {
    if (
      cell.terrain === 'crater' &&
      cell.ash < 0.28 &&
      cell.toxicity < 0.36 &&
      cell.water > 0.18 &&
      cell.nutrient > 0.26 &&
      Math.random() < 0.055 * dt
    ) {
      cell.terrain = 'wasteland';
      cell.grass = Math.max(cell.grass, 0.08);
      return;
    }

    if (
      cell.terrain === 'wasteland' &&
      cell.grass > 0.42 &&
      cell.water > 0.35 &&
      cell.nutrient > 0.32 &&
      cell.toxicity < 0.28 &&
      Math.random() < 0.07 * dt
    ) {
      cell.terrain = 'grassland';
      cell.grass = Math.max(cell.grass, 0.52);
    }
  }

  private tryForestSuccession(cell: Cell, x: number, y: number, dt: number, forestNeighbors: number): void {
    if (
      cell.terrain === 'grassland' &&
      forestNeighbors >= 3 &&
      cell.grass > 0.76 &&
      cell.water > 0.54 &&
      cell.nutrient > 0.52 &&
      cell.heat < 0.56 &&
      cell.toxicity < 0.22 &&
      Math.random() < 0.026 * dt
    ) {
      cell.terrain = 'forest';
      cell.fungus = clamp01(cell.fungus + 0.12);
      return;
    }

    if (
      cell.terrain === 'forest' &&
      (cell.heat > 0.86 || cell.water < 0.08 || cell.toxicity > 0.72) &&
      Math.random() < 0.08 * dt
    ) {
      cell.terrain = 'grassland';
      cell.grass = clamp01(cell.grass * 0.55);
      cell.ash = clamp01(cell.ash + 0.18);
    }
  }

  private countTerrainAround(originX: number, originY: number, radius: number, terrain: Terrain): number {
    let count = 0;
    for (let y = originY - radius; y <= originY + radius; y += 1) {
      for (let x = originX - radius; x <= originX + radius; x += 1) {
        if (x === originX && y === originY) {
          continue;
        }
        const cell = this.environment.getCell(x, y);
        if (cell?.terrain === terrain) {
          count += 1;
        }
      }
    }
    return count;
  }
}
