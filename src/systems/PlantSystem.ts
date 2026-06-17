import { EnvironmentSystem } from './EnvironmentSystem';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export class PlantSystem {
  constructor(private readonly environment: EnvironmentSystem) {}

  update(deltaSeconds: number): void {
    const dt = Math.min(deltaSeconds, 0.25);
    for (const cell of this.environment.cells) {
      if (cell.terrain === 'water' || cell.terrain === 'crater') {
        cell.grass = clamp01(cell.grass - 0.2 * dt);
        continue;
      }

      const growthPotential = cell.water * 0.5 + cell.nutrient * 0.5;
      const terrainBonus = cell.terrain === 'forest' ? 1.25 : cell.terrain === 'wasteland' ? 0.45 : 1;
      const heatStress = Math.max(0, cell.heat - 0.45);
      const growth = growthPotential * terrainBonus * 0.105 * dt;
      const decay = (heatStress * 0.34 + cell.ash * 0.045) * dt;

      cell.grass = clamp01(cell.grass + growth - decay);

      if (growth > decay) {
        cell.water = clamp01(cell.water - 0.018 * dt);
        cell.nutrient = clamp01(cell.nutrient - 0.014 * dt);
      }
    }
  }
}
