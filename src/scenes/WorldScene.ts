import * as Phaser from 'phaser';
import type { Cell, GridPosition, Terrain } from '../types';
import { CreatureSystem } from '../systems/CreatureSystem';
import { EnvironmentSystem } from '../systems/EnvironmentSystem';
import { GodPowerSystem } from '../systems/GodPowerSystem';
import { PlantSystem } from '../systems/PlantSystem';
import { UISystem } from '../systems/UISystem';

const GRID_WIDTH = 48;
const GRID_HEIGHT = 32;

const terrainColor: Record<Terrain, number> = {
  grassland: 0x426c36,
  forest: 0x1f4d2a,
  water: 0x1f6f8f,
  wasteland: 0x665740,
  crater: 0x282725,
};

export class WorldScene extends Phaser.Scene {
  private environment!: EnvironmentSystem;
  private plants!: PlantSystem;
  private creatures!: CreatureSystem;
  private godPowers!: GodPowerSystem;
  private ui!: UISystem;
  private terrainGraphics!: Phaser.GameObjects.Graphics;
  private actorGraphics!: Phaser.GameObjects.Graphics;
  private overlayGraphics!: Phaser.GameObjects.Graphics;
  private cellSize = 12;
  private mapOffsetX = 0;
  private mapOffsetY = 0;
  private statsTimer = 0;

  constructor() {
    super('WorldScene');
  }

  create(): void {
    this.environment = new EnvironmentSystem(GRID_WIDTH, GRID_HEIGHT);
    this.plants = new PlantSystem(this.environment);
    this.creatures = new CreatureSystem(this.environment);
    this.ui = new UISystem((power) => this.godPowers.setPower(power));
    this.godPowers = new GodPowerSystem(this.environment, this.creatures, (message) => this.ui.addLog(message));

    this.terrainGraphics = this.add.graphics();
    this.actorGraphics = this.add.graphics();
    this.overlayGraphics = this.add.graphics();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const grid = this.pointerToGrid(pointer.x, pointer.y);
      if (grid) {
        this.godPowers.applyAt(grid);
      }
    });

    this.scale.on('resize', () => this.resizeMap());
    this.resizeMap();
    this.ui.addLog('生態系が始動');
  }

  update(_: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.environment.update(dt);
    this.plants.update(dt);
    this.creatures.update(dt);
    this.renderWorld();

    this.statsTimer += dt;
    if (this.statsTimer > 0.25) {
      this.ui.updateStats(this.creatures.getStats());
      this.statsTimer = 0;
    }
  }

  private resizeMap(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const topReserve = width < 640 ? 112 : 84;
    const bottomReserve = width < 640 ? 118 : 96;
    const sidePadding = width < 640 ? 8 : 18;
    const availableWidth = width - sidePadding * 2;
    const availableHeight = Math.max(220, height - topReserve - bottomReserve);

    this.cellSize = Math.floor(Math.max(6, Math.min(availableWidth / GRID_WIDTH, availableHeight / GRID_HEIGHT)));
    const mapWidth = this.cellSize * GRID_WIDTH;
    const mapHeight = this.cellSize * GRID_HEIGHT;

    this.mapOffsetX = Math.floor((width - mapWidth) / 2);
    this.mapOffsetY = Math.floor(topReserve + (availableHeight - mapHeight) / 2);
    this.renderWorld();
  }

  private pointerToGrid(pointerX: number, pointerY: number): GridPosition | undefined {
    const x = Math.floor((pointerX - this.mapOffsetX) / this.cellSize);
    const y = Math.floor((pointerY - this.mapOffsetY) / this.cellSize);
    if (!this.environment.inBounds(x, y)) {
      return undefined;
    }
    return { x, y };
  }

  private renderWorld(): void {
    if (!this.terrainGraphics) {
      return;
    }

    this.terrainGraphics.clear();
    this.actorGraphics.clear();
    this.overlayGraphics.clear();

    for (let y = 0; y < this.environment.height; y += 1) {
      for (let x = 0; x < this.environment.width; x += 1) {
        const cell = this.environment.getCell(x, y);
        if (!cell) {
          continue;
        }
        this.drawCell(cell, x, y);
      }
    }

    this.drawCorpses();
    this.drawCreatures();
    this.drawFrame();
  }

  private drawCell(cell: Cell, x: number, y: number): void {
    const px = this.mapOffsetX + x * this.cellSize;
    const py = this.mapOffsetY + y * this.cellSize;
    const base = Phaser.Display.Color.ValueToColor(terrainColor[cell.terrain]);
    const grassTint = Math.floor(70 * cell.grass);
    const waterTint = Math.floor(55 * cell.water);
    const heatTint = Math.floor(90 * cell.heat);
    const ashTint = Math.floor(70 * cell.ash);
    const color = Phaser.Display.Color.GetColor(
      Math.min(255, base.red + heatTint + ashTint * 0.35),
      Math.min(255, base.green + grassTint + cell.nutrient * 28),
      Math.min(255, base.blue + waterTint + ashTint * 0.25),
    );

    this.terrainGraphics.fillStyle(color, 1);
    this.terrainGraphics.fillRect(px, py, this.cellSize, this.cellSize);

    if (cell.heat > 0.55) {
      this.terrainGraphics.fillStyle(0xff6b35, Math.min(0.42, cell.heat * 0.42));
      this.terrainGraphics.fillRect(px, py, this.cellSize, this.cellSize);
    }

    if (cell.ash > 0.32) {
      this.terrainGraphics.fillStyle(0xc9c0b1, Math.min(0.34, cell.ash * 0.34));
      this.terrainGraphics.fillRect(px + 1, py + 1, Math.max(1, this.cellSize - 2), Math.max(1, this.cellSize - 2));
    }
  }

  private drawCreatures(): void {
    const radius = Math.max(2, this.cellSize * 0.32);
    for (const creature of this.creatures.creatures) {
      const cx = this.mapOffsetX + creature.x * this.cellSize + this.cellSize / 2;
      const cy = this.mapOffsetY + creature.y * this.cellSize + this.cellSize / 2;
      if (creature.kind === 'herbivore') {
        this.actorGraphics.fillStyle(0xf7e37a, 1);
        this.actorGraphics.fillCircle(cx, cy, radius);
        this.actorGraphics.fillStyle(0x7e8b3e, 1);
        this.actorGraphics.fillCircle(cx - radius * 0.35, cy - radius * 0.15, radius * 0.35);
        continue;
      }

      this.actorGraphics.fillStyle(0xd5533d, 1);
      this.actorGraphics.fillTriangle(cx, cy - radius, cx - radius, cy + radius, cx + radius, cy + radius);
      this.actorGraphics.fillStyle(0x491a18, 1);
      this.actorGraphics.fillCircle(cx, cy + radius * 0.25, radius * 0.32);
    }
  }

  private drawCorpses(): void {
    const radius = Math.max(2, this.cellSize * 0.24);
    for (const corpse of this.creatures.corpses) {
      const cx = this.mapOffsetX + corpse.x * this.cellSize + this.cellSize / 2;
      const cy = this.mapOffsetY + corpse.y * this.cellSize + this.cellSize / 2;
      this.actorGraphics.fillStyle(0xead7be, Math.max(0.2, corpse.nutrientsLeft));
      this.actorGraphics.fillRect(cx - radius, cy - radius * 0.45, radius * 2, radius * 0.9);
    }
  }

  private drawFrame(): void {
    const mapWidth = this.cellSize * GRID_WIDTH;
    const mapHeight = this.cellSize * GRID_HEIGHT;
    this.overlayGraphics.lineStyle(2, 0xd7e6c5, 0.32);
    this.overlayGraphics.strokeRect(this.mapOffsetX - 1, this.mapOffsetY - 1, mapWidth + 2, mapHeight + 2);
  }
}
