import type { GodPower, GridPosition } from '../types';
import { CreatureSystem } from './CreatureSystem';
import { EnvironmentSystem } from './EnvironmentSystem';

export class GodPowerSystem {
  selectedPower: GodPower = 'meteor';

  constructor(
    private readonly environment: EnvironmentSystem,
    private readonly creatures: CreatureSystem,
    private readonly log: (message: string) => void,
  ) {}

  setPower(power: GodPower): void {
    this.selectedPower = power;
    this.log(`${this.labelFor(power)}を選択`);
  }

  applyAt(position: GridPosition): void {
    if (!this.environment.inBounds(position.x, position.y)) {
      return;
    }

    switch (this.selectedPower) {
      case 'meteor': {
        this.environment.applyMeteor(position, 2);
        const killed = this.creatures.killCreaturesInRadius(position, 5);
        this.log(`隕石落下: ${killed}体が消滅`);
        break;
      }
      case 'rain':
        this.environment.addWater(position, 6, 0.42);
        this.log('雨が降り、水と冷却を付与');
        break;
      case 'sun':
        this.environment.addHeat(position, 5, 0.36);
        this.log('太陽熱で周囲が乾燥');
        break;
      case 'seed':
        this.environment.addSeeds(position, 5);
        this.creatures.addHerbivores(position, 2);
        this.log('種と草食動物を追加');
        break;
    }
  }

  private labelFor(power: GodPower): string {
    return {
      meteor: '隕石',
      rain: '雨',
      sun: '太陽',
      seed: '種追加',
    }[power];
  }
}
