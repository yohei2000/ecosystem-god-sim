import type { EcosystemStats, GodPower, Season, Weather } from '../types';

const seasonLabel: Record<Season, string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
};

const weatherLabel: Record<Weather, string> = {
  clear: '晴',
  rain: '雨',
  storm: '嵐',
  drought: '干ばつ',
  heatwave: '熱波',
  ashfall: '灰降り',
};

export class UISystem {
  private readonly grassMetric = this.requireElement('grassMetric');
  private readonly herbivoreMetric = this.requireElement('herbivoreMetric');
  private readonly carnivoreMetric = this.requireElement('carnivoreMetric');
  private readonly mixedMetric = this.requireElement('mixedMetric');
  private readonly diversityMetric = this.requireElement('diversityMetric');
  private readonly stabilityMetric = this.requireElement('stabilityMetric');
  private readonly seasonMetric = this.requireElement('seasonMetric');
  private readonly weatherMetric = this.requireElement('weatherMetric');
  private readonly riskMetric = this.requireElement('riskMetric');
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
    this.mixedMetric.textContent = `${stats.omnivores}/${stats.scavengers}`;
    this.diversityMetric.textContent = `${Math.round(stats.speciesDiversity * 7)}/7`;
    this.stabilityMetric.textContent = `${stats.stability}%`;
    this.seasonMetric.textContent = seasonLabel[stats.season];
    this.weatherMetric.textContent = weatherLabel[stats.weather];
    this.riskMetric.textContent = `${stats.corpses}/${stats.sick}`;

    this.stabilityMetric.classList.toggle('danger', stats.stability < 35);
    this.diversityMetric.classList.toggle('danger', stats.speciesDiversity < 0.58);
    this.riskMetric.classList.toggle('danger', stats.sick > 8 || stats.corpses > 22);
    this.weatherMetric.classList.toggle('danger', stats.weather === 'heatwave' || stats.weather === 'drought' || stats.weather === 'ashfall');
  }

  addLog(message: string): void {
    const time = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.logs.unshift(`${time} ${message}`);
    this.logs.splice(8);
    this.eventLog.innerHTML = this.logs.map((entry) => `<li>${this.escapeHtml(entry)}</li>`).join('');
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

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
