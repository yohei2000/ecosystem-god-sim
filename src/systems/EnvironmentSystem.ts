import type { Cell, GridPosition, Terrain } from '../types';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export class EnvironmentSystem {
  readonly width: number;
  readonly height: number;
  readonly cells: Cell[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = Array.from({ length: width * height }, (_, index) => {
      const x = index % width;
      const y = Math.floor(index / width);
      return this.createCell(x, y);
    });
  }

  getCell(x: number, y: number): Cell | undefined {
    if (!this.inBounds(x, y)) {
      return undefined;
    }
    return this.cells[this.index(x, y)];
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  update(deltaSeconds: number): void {
    const dt = Math.min(deltaSeconds, 0.25);
    for (const cell of this.cells) {
      if (cell.ash > 0) {
        const converted = Math.min(cell.ash, 0.045 * dt);
        cell.ash -= converted;
        cell.nutrient = clamp01(cell.nutrient + converted * 0.8);
      }

      const waterRetention =
        cell.terrain === 'forest'
          ? 0.007
          : cell.terrain === 'water'
            ? -0.05
            : cell.terrain === 'mountain'
              ? 0.012
              : 0.018;
      const heatLoss = cell.terrain === 'water' ? 0.08 : cell.terrain === 'mountain' ? 0.058 : 0.045;

      cell.water = clamp01(cell.water - waterRetention * dt);
      cell.heat = clamp01(cell.heat - heatLoss * dt);

      if (cell.terrain === 'water') {
        cell.water = clamp01(cell.water + 0.035 * dt);
      }
      if (cell.terrain === 'wasteland') {
        cell.nutrient = clamp01(cell.nutrient - 0.01 * dt);
      }
    }
  }

  addWater(center: GridPosition, radius: number, amount: number): void {
    this.forEachInRadius(center, radius, (cell, distance) => {
      const falloff = 1 - distance / (radius + 1);
      cell.water = clamp01(cell.water + amount * falloff);
      cell.heat = clamp01(cell.heat - amount * 0.35 * falloff);
    });
  }

  addHeat(center: GridPosition, radius: number, amount: number): void {
    this.forEachInRadius(center, radius, (cell, distance) => {
      const falloff = 1 - distance / (radius + 1);
      cell.heat = clamp01(cell.heat + amount * falloff);
      cell.water = clamp01(cell.water - amount * 0.22 * falloff);
    });
  }

  addSeeds(center: GridPosition, radius: number): void {
    this.forEachInRadius(center, radius, (cell, distance) => {
      if (cell.terrain !== 'water' && cell.terrain !== 'crater' && cell.terrain !== 'mountain') {
        const falloff = 1 - distance / (radius + 1);
        cell.grass = clamp01(cell.grass + 0.38 * falloff);
        cell.nutrient = clamp01(cell.nutrient - 0.08 * falloff);
      }
    });
  }

  applyMeteor(center: GridPosition, radius: number): void {
    this.forEachInRadius(center, radius + 3, (cell, distance) => {
      if (distance <= radius) {
        cell.terrain = 'crater';
        cell.grass = 0;
        cell.water = 0;
        cell.nutrient = clamp01(cell.nutrient * 0.35);
        cell.heat = 1;
        cell.ash = 1;
        return;
      }

      const falloff = 1 - (distance - radius) / 4;
      cell.grass = clamp01(cell.grass - 0.95 * falloff);
      cell.water = clamp01(cell.water - 0.45 * falloff);
      cell.heat = clamp01(cell.heat + 0.75 * falloff);
      cell.ash = clamp01(cell.ash + 0.65 * falloff);
    });
  }

  forEachInRadius(
    center: GridPosition,
    radius: number,
    callback: (cell: Cell, distance: number, x: number, y: number) => void,
  ): void {
    const minX = Math.max(0, center.x - radius);
    const maxX = Math.min(this.width - 1, center.x + radius);
    const minY = Math.max(0, center.y - radius);
    const maxY = Math.min(this.height - 1, center.y + radius);

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const distance = Math.hypot(center.x - x, center.y - y);
        if (distance <= radius) {
          callback(this.cells[this.index(x, y)], distance, x, y);
        }
      }
    }
  }

  private index(x: number, y: number): number {
    return y * this.width + x;
  }

  private createCell(x: number, y: number): Cell {
    const nx = x / this.width;
    const ny = y / this.height;
    const lake = Math.hypot(nx - 0.72, ny - 0.32) < 0.15 || Math.hypot(nx - 0.25, ny - 0.72) < 0.1;
    const crater = Math.hypot(nx - 0.52, ny - 0.55) < 0.09;
    const forestBand = Math.sin(x * 0.55) + Math.cos(y * 0.44) > 0.95;
    const mountainRidge =
      (nx > 0.56 && ny > 0.58 && Math.abs(ny - (0.7 + Math.sin(x * 0.3) * 0.08)) < 0.085) ||
      (nx > 0.78 && ny < 0.24 && Math.abs(ny - (0.14 + Math.cos(x * 0.35) * 0.05)) < 0.06);
    const wasteland = nx < 0.22 && ny < 0.36;

    let terrain: Terrain = 'grassland';
    if (lake) terrain = 'water';
    else if (crater) terrain = 'crater';
    else if (mountainRidge) terrain = 'mountain';
    else if (wasteland) terrain = 'wasteland';
    else if (forestBand) terrain = 'forest';

    const templates: Record<Terrain, Cell> = {
      grassland: { terrain, grass: 0.55, water: 0.52, nutrient: 0.55, heat: 0.25, ash: 0.02 },
      forest: { terrain, grass: 0.82, water: 0.66, nutrient: 0.72, heat: 0.18, ash: 0.01 },
      water: { terrain, grass: 0.04, water: 1, nutrient: 0.38, heat: 0.08, ash: 0 },
      wasteland: { terrain, grass: 0.14, water: 0.15, nutrient: 0.2, heat: 0.52, ash: 0.05 },
      crater: { terrain, grass: 0, water: 0.05, nutrient: 0.16, heat: 0.64, ash: 0.45 },
      mountain: { terrain, grass: 0.08, water: 0.24, nutrient: 0.32, heat: 0.16, ash: 0.01 },
    };

    return { ...templates[terrain] };
  }
}
