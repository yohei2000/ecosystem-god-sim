import type { Cell, ClimateState, GridPosition, Season, Terrain, Weather } from '../types';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const SEASON_DURATION = 58;
const WEATHER_MIN_DURATION = 12;
const WEATHER_MAX_DURATION = 24;

const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];

const seasonTemperature: Record<Season, number> = {
  spring: 0.45,
  summer: 0.67,
  autumn: 0.4,
  winter: 0.22,
};

const seasonMoisture: Record<Season, number> = {
  spring: 0.66,
  summer: 0.44,
  autumn: 0.55,
  winter: 0.36,
};

const weatherTemperature: Record<Weather, number> = {
  clear: 0,
  rain: -0.08,
  storm: -0.12,
  drought: 0.16,
  heatwave: 0.27,
  ashfall: 0.05,
};

const weatherMoisture: Record<Weather, number> = {
  clear: 0,
  rain: 0.28,
  storm: 0.36,
  drought: -0.24,
  heatwave: -0.18,
  ashfall: -0.05,
};

export class EnvironmentSystem {
  readonly width: number;
  readonly height: number;
  readonly cells: Cell[];
  private elapsed = 0;
  private weatherElapsed = 0;
  private weatherDuration = 16;
  private weather: Weather = 'clear';
  private season: Season = 'spring';
  private seasonProgress = 0;

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

  getClimate(): ClimateState {
    return {
      season: this.season,
      weather: this.weather,
      seasonProgress: this.seasonProgress,
      weatherProgress: clamp01(this.weatherElapsed / this.weatherDuration),
      temperature: clamp01(seasonTemperature[this.season] + weatherTemperature[this.weather]),
      moisture: clamp01(seasonMoisture[this.season] + weatherMoisture[this.weather]),
    };
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  update(deltaSeconds: number): void {
    const dt = Math.min(deltaSeconds, 0.25);
    this.updateClimate(dt);
    const climate = this.getClimate();

    for (const cell of this.cells) {
      const rainGain = this.weather === 'rain' ? 0.034 : this.weather === 'storm' ? 0.054 : 0;
      const droughtDrain = this.weather === 'drought' ? 0.05 : this.weather === 'heatwave' ? 0.062 : 0;
      const ashfall = this.weather === 'ashfall' ? 0.018 : 0;
      const forestBuffer = cell.terrain === 'forest' ? 0.52 : cell.terrain === 'grassland' ? 0.16 : 0;

      if (cell.ash > 0) {
        const conversionSpeed = (0.034 + cell.fungus * 0.055 + climate.moisture * 0.025) * dt;
        const converted = Math.min(cell.ash, conversionSpeed);
        cell.ash = clamp01(cell.ash - converted);
        cell.nutrient = clamp01(cell.nutrient + converted * (0.64 + cell.fungus * 0.26));
      }

      const waterRetention =
        cell.terrain === 'forest'
          ? 0.005
          : cell.terrain === 'water'
            ? -0.055
            : cell.terrain === 'mountain'
              ? 0.012
              : cell.terrain === 'wasteland'
                ? 0.026
                : 0.018;
      const heatLoss = cell.terrain === 'water' ? 0.105 : cell.terrain === 'mountain' ? 0.065 : 0.045 + forestBuffer * 0.025;

      cell.water = clamp01(cell.water - waterRetention * dt + rainGain * dt - droughtDrain * dt);
      cell.heat = clamp01(cell.heat + (climate.temperature - 0.48) * 0.05 * dt - heatLoss * dt + droughtDrain * 0.42 * dt);
      cell.ash = clamp01(cell.ash + ashfall * dt);

      if (cell.terrain === 'water') {
        cell.water = clamp01(cell.water + 0.044 * dt);
        cell.heat = clamp01(cell.heat - 0.08 * dt);
      }
      if (cell.terrain === 'wasteland') {
        cell.nutrient = clamp01(cell.nutrient - 0.008 * dt + cell.ash * 0.01 * dt);
      }
      if (cell.terrain === 'forest' && this.season === 'autumn') {
        cell.nutrient = clamp01(cell.nutrient + 0.012 * dt);
      }

      const fungusTarget =
        cell.terrain === 'water' || cell.terrain === 'mountain'
          ? 0
          : clamp01(cell.nutrient * 0.48 + cell.water * 0.34 + cell.ash * 0.16 - cell.heat * 0.22);
      cell.fungus = clamp01(cell.fungus + (fungusTarget - cell.fungus) * (0.032 + climate.moisture * 0.045) * dt);
      cell.toxicity = clamp01(cell.toxicity + (cell.ash * 0.018 + Math.max(0, cell.heat - 0.72) * 0.03) * dt - (0.018 + cell.fungus * 0.045) * dt);
    }
  }

  addWater(center: GridPosition, radius: number, amount: number): void {
    this.weather = 'rain';
    this.weatherElapsed = 0;
    this.weatherDuration = Math.max(this.weatherDuration, 10);
    this.forEachInRadius(center, radius, (cell, distance) => {
      const falloff = 1 - distance / (radius + 1);
      cell.water = clamp01(cell.water + amount * falloff);
      cell.heat = clamp01(cell.heat - amount * 0.35 * falloff);
      cell.toxicity = clamp01(cell.toxicity - amount * 0.18 * falloff);
    });
  }

  addHeat(center: GridPosition, radius: number, amount: number): void {
    this.weather = 'heatwave';
    this.weatherElapsed = 0;
    this.weatherDuration = Math.max(this.weatherDuration, 9);
    this.forEachInRadius(center, radius, (cell, distance) => {
      const falloff = 1 - distance / (radius + 1);
      cell.heat = clamp01(cell.heat + amount * falloff);
      cell.water = clamp01(cell.water - amount * 0.24 * falloff);
      cell.toxicity = clamp01(cell.toxicity + amount * 0.08 * falloff);
    });
  }

  addSeeds(center: GridPosition, radius: number): void {
    this.forEachInRadius(center, radius, (cell, distance) => {
      if (cell.terrain !== 'water' && cell.terrain !== 'crater' && cell.terrain !== 'mountain') {
        const falloff = 1 - distance / (radius + 1);
        cell.grass = clamp01(cell.grass + 0.38 * falloff);
        cell.nutrient = clamp01(cell.nutrient - 0.08 * falloff);
        cell.fungus = clamp01(cell.fungus + 0.12 * falloff);
      }
    });
  }

  applyMeteor(center: GridPosition, radius: number): void {
    this.weather = 'ashfall';
    this.weatherElapsed = 0;
    this.weatherDuration = 15;
    this.forEachInRadius(center, radius + 3, (cell, distance) => {
      if (distance <= radius) {
        cell.terrain = 'crater';
        cell.grass = 0;
        cell.water = 0;
        cell.nutrient = clamp01(cell.nutrient * 0.35);
        cell.heat = 1;
        cell.ash = 1;
        cell.fungus = 0;
        cell.toxicity = 1;
        return;
      }

      const falloff = 1 - (distance - radius) / 4;
      cell.grass = clamp01(cell.grass - 0.95 * falloff);
      cell.water = clamp01(cell.water - 0.45 * falloff);
      cell.heat = clamp01(cell.heat + 0.75 * falloff);
      cell.ash = clamp01(cell.ash + 0.65 * falloff);
      cell.toxicity = clamp01(cell.toxicity + 0.52 * falloff);
    });
  }

  forEachInRadius(
    center: GridPosition,
    radius: number,
    callback: (cell: Cell, distance: number, x: number, y: number) => void,
  ): void {
    const minX = Math.max(0, Math.floor(center.x - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(center.x + radius));
    const minY = Math.max(0, Math.floor(center.y - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(center.y + radius));

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const distance = Math.hypot(center.x - x, center.y - y);
        if (distance <= radius) {
          callback(this.cells[this.index(x, y)], distance, x, y);
        }
      }
    }
  }

  private updateClimate(dt: number): void {
    this.elapsed += dt;
    this.seasonProgress = (this.elapsed % SEASON_DURATION) / SEASON_DURATION;
    this.season = seasons[Math.floor(this.elapsed / SEASON_DURATION) % seasons.length];
    this.weatherElapsed += dt;

    if (this.weatherElapsed >= this.weatherDuration) {
      this.weather = this.pickNextWeather();
      this.weatherElapsed = 0;
      this.weatherDuration = WEATHER_MIN_DURATION + Math.random() * (WEATHER_MAX_DURATION - WEATHER_MIN_DURATION);
    }
  }

  private pickNextWeather(): Weather {
    const table: Array<[Weather, number]> =
      this.season === 'spring'
        ? [
            ['clear', 4],
            ['rain', 4],
            ['storm', 2],
            ['drought', 1],
            ['heatwave', 0.4],
            ['ashfall', 0.4],
          ]
        : this.season === 'summer'
          ? [
              ['clear', 3],
              ['rain', 1.4],
              ['storm', 1.4],
              ['drought', 2.6],
              ['heatwave', 2.1],
              ['ashfall', 0.4],
            ]
          : this.season === 'autumn'
            ? [
                ['clear', 3],
                ['rain', 2.4],
                ['storm', 1.2],
                ['drought', 1.1],
                ['heatwave', 0.5],
                ['ashfall', 0.8],
              ]
            : [
                ['clear', 5],
                ['rain', 1.2],
                ['storm', 0.8],
                ['drought', 1.5],
                ['heatwave', 0.2],
                ['ashfall', 0.5],
              ];

    const total = table.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * total;
    for (const [weather, weight] of table) {
      roll -= weight;
      if (roll <= 0) {
        return weather;
      }
    }
    return 'clear';
  }

  private index(x: number, y: number): number {
    return y * this.width + x;
  }

  private createCell(x: number, y: number): Cell {
    const nx = x / this.width;
    const ny = y / this.height;
    const lake = Math.hypot(nx - 0.72, ny - 0.32) < 0.15 || Math.hypot(nx - 0.25, ny - 0.72) < 0.1;
    const crater = Math.hypot(nx - 0.52, ny - 0.55) < 0.09;
    const forestBand = Math.sin(nx * 18) + Math.cos(ny * 16) + Math.sin((nx + ny) * 22) > 1.35;
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
      grassland: { terrain, grass: 0.55, water: 0.52, nutrient: 0.55, heat: 0.25, ash: 0.02, fungus: 0.16, toxicity: 0.02 },
      forest: { terrain, grass: 0.82, water: 0.66, nutrient: 0.72, heat: 0.18, ash: 0.01, fungus: 0.28, toxicity: 0.01 },
      water: { terrain, grass: 0.04, water: 1, nutrient: 0.38, heat: 0.08, ash: 0, fungus: 0, toxicity: 0 },
      wasteland: { terrain, grass: 0.14, water: 0.15, nutrient: 0.2, heat: 0.52, ash: 0.05, fungus: 0.04, toxicity: 0.08 },
      crater: { terrain, grass: 0, water: 0.05, nutrient: 0.16, heat: 0.64, ash: 0.45, fungus: 0, toxicity: 0.46 },
      mountain: { terrain, grass: 0.08, water: 0.24, nutrient: 0.32, heat: 0.16, ash: 0.01, fungus: 0.02, toxicity: 0.01 },
    };

    return { ...templates[terrain] };
  }
}
