import type { EcosystemStats, GodPower } from '../types';

export class UISystem {
  private readonly grassMetric = this.requireElement('grassMetric');
  private readonly herbivoreMetric = this.requireElement('herbivoreMetric');
  private readonly carnivoreMetric = this.requireElement('carnivoreMetric');
  private readonly stabilityMetric = this.requireElement('stabilityMetric');
  private readonly eventLog = this.requireElement('eventLog');
  private readonly buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.power-button'));
  private readonly logs: string[] = [];

  constructor(onPowerSelected: (power: GodPower) => void) {
    for (const button of this.buttons) {
      button.addEventListener('click', () => {
        const power = button.dataset.power as GodPower | undefined;
        if (!power) {
          return;
        }
        this.setActivePower(power);
        onPowerSelected(power);
      });
    }
  }

  updateStats(stats: EcosystemStats): void {
    this.grassMetric.textContent = Math.round(stats.grass).toString();
    this.herbivoreMetric.textContent = stats.herbivores.toString();
    this.carnivoreMetric.textContent = stats.carnivores.toString();
    this.stabilityMetric.textContent = `${stats.stability}%`;
    this.stabilityMetric.classList.toggle('danger', stats.stability < 35);
  }

  addLog(message: string): void {
    const time = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.logs.unshift(`${time} ${message}`);
    this.logs.splice(7);
    this.eventLog.innerHTML = this.logs.map((entry) => `<li>${entry}</li>`).join('');
  }

  private setActivePower(power: GodPower): void {
    for (const button of this.buttons) {
      button.classList.toggle('active', button.dataset.power === power);
    }
  }

  private requireElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Missing UI element: ${id}`);
    }
    return element;
  }
}
