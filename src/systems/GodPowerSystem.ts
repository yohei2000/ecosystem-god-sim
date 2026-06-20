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
    this.log(`${this.labelFor(power)} を選択`);
  }

  applyAt(position: GridPosition): void {
    if (!this.environment.inBounds(position.x, position.y)) {
      return;
    }

    switch (this.selectedPower) {
      case 'meteor': {
        this.environment.applyMeteor(position, 3);
        const killed = this.creatures.killCreaturesInRadius(position, 7);
        this.log(`隕石衝突: ${killed}体が消滅し、灰と毒性が広がる`);
        break;
      }
      case 'rain':
        this.environment.addWater(position, 9, 0.42);
        this.log('豪雨: 水分が戻り、熱と毒性が薄まる');
        break;
      case 'sun':
        this.environment.addHeat(position, 8, 0.36);
        this.log('太陽熱: 草は乾き、捕食者の圧が上がる');
        break;
      case 'seed':
        this.environment.addSeeds(position, 8);
        this.creatures.addHerbivores(position, 3);
        this.log('種まき: 草と菌床が広がり、草食動物が集まる');
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
