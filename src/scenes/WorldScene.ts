import * as Phaser from 'phaser';
import type { Cell, CreatureEvent, CreatureKind, GodPower, GridPosition, Terrain } from '../types';
import creatureAtlasUrl from '../assets/creature-atlas.png';
import { CreatureSystem } from '../systems/CreatureSystem';
import { EnvironmentSystem } from '../systems/EnvironmentSystem';
import { GodPowerSystem } from '../systems/GodPowerSystem';
import { PlantSystem } from '../systems/PlantSystem';
import { UISystem } from '../systems/UISystem';

const GRID_WIDTH = 84;
const GRID_HEIGHT = 56;

interface CreatureVisual {
  x: number;
  y: number;
  rotation: number;
  bobSeed: number;
}

const terrainColor: Record<Terrain, number> = {
  grassland: 0x5f9f43,
  forest: 0x2f6b35,
  water: 0x247da2,
  wasteland: 0x76634a,
  crater: 0x2f2d2a,
  mountain: 0x656f6c,
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
  private readonly creatureSprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly creatureVisuals = new Map<number, CreatureVisual>();
  private cellSize = 12;
  private mapOffsetX = 0;
  private mapOffsetY = 0;
  private statsTimer = 0;
  private birthLogTimer = 0;
  private readonly birthLogCounts: Record<CreatureKind, number> = {
    herbivore: 0,
    carnivore: 0,
  };

  constructor() {
    super('WorldScene');
  }

  preload(): void {
    this.load.spritesheet('creatures', creatureAtlasUrl, { frameWidth: 128, frameHeight: 128 });
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
    this.terrainGraphics.setDepth(1);
    this.actorGraphics.setDepth(2);
    this.overlayGraphics.setDepth(4);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const grid = this.pointerToGrid(pointer.x, pointer.y);
      if (grid) {
        const power = this.godPowers.selectedPower;
        this.godPowers.applyAt(grid);
        this.playGodPowerEffect(power, grid);
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
    this.processCreatureEvents(dt);
    this.renderWorld(dt);

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

    this.cellSize = Math.max(4, Math.min(availableWidth / GRID_WIDTH, availableHeight / GRID_HEIGHT));
    const mapWidth = this.cellSize * GRID_WIDTH;
    const mapHeight = this.cellSize * GRID_HEIGHT;

    this.mapOffsetX = (width - mapWidth) / 2;
    this.mapOffsetY = topReserve + (availableHeight - mapHeight) / 2;
    this.renderWorld(0);
  }

  private pointerToGrid(pointerX: number, pointerY: number): GridPosition | undefined {
    const x = Math.floor((pointerX - this.mapOffsetX) / this.cellSize);
    const y = Math.floor((pointerY - this.mapOffsetY) / this.cellSize);
    if (!this.environment.inBounds(x, y)) {
      return undefined;
    }
    return { x, y };
  }

  private processCreatureEvents(dt: number): void {
    this.birthLogTimer += dt;
    for (const event of this.creatures.consumeEvents()) {
      if (event.type === 'birth') {
        this.birthLogCounts[event.kind] += 1;
        this.playBirthEffect(event);
      }
    }

    if (this.birthLogTimer >= 1.5) {
      const messages: string[] = [];
      if (this.birthLogCounts.herbivore > 0) {
        messages.push(`草食動物 +${this.birthLogCounts.herbivore}`);
      }
      if (this.birthLogCounts.carnivore > 0) {
        messages.push(`肉食動物 +${this.birthLogCounts.carnivore}`);
      }
      if (messages.length > 0) {
        this.ui.addLog(`${messages.join(' / ')} が繁殖`);
      }
      this.birthLogCounts.herbivore = 0;
      this.birthLogCounts.carnivore = 0;
      this.birthLogTimer = 0;
    }
  }

  private playGodPowerEffect(power: GodPower, grid: GridPosition): void {
    switch (power) {
      case 'meteor':
        this.playMeteorEffect(grid);
        break;
      case 'rain':
        this.playRainEffect(grid);
        break;
      case 'sun':
        this.playSunEffect(grid);
        break;
      case 'seed':
        this.playSeedEffect(grid);
        break;
    }
  }

  private playMeteorEffect(grid: GridPosition): void {
    const target = this.gridToWorldCenter(grid);
    const startX = Phaser.Math.Clamp(target.x - this.scale.width * 0.34, 24, this.scale.width - 24);
    const startY = Math.max(16, this.mapOffsetY - 92);
    const fireball = this.createEffectGraphic(startX, startY, 6);

    fireball.lineStyle(Math.max(4, this.cellSize * 0.42), 0xffb347, 0.7);
    fireball.lineBetween(-this.cellSize * 5, -this.cellSize * 3.4, 0, 0);
    fireball.lineStyle(Math.max(2, this.cellSize * 0.22), 0xfff0a3, 0.95);
    fireball.lineBetween(-this.cellSize * 3.2, -this.cellSize * 2.1, 0, 0);
    fireball.fillStyle(0xfff1a8, 1);
    fireball.fillCircle(0, 0, Math.max(5, this.cellSize * 0.8));
    fireball.fillStyle(0xff6b35, 0.88);
    fireball.fillCircle(0, 0, Math.max(8, this.cellSize * 1.15));

    this.tweens.add({
      targets: fireball,
      x: target.x,
      y: target.y,
      duration: 280,
      ease: 'Quad.easeIn',
      onComplete: () => {
        fireball.destroy();
        this.cameras.main.shake(280, 0.006);
        this.playImpactExplosion(target.x, target.y, this.cellSize * 5.2);
      },
    });
  }

  private playRainEffect(grid: GridPosition): void {
    const center = this.gridToWorldCenter(grid);
    const radius = this.cellSize * 6;
    this.addRing(center.x, center.y, radius * 0.35, 0x7dccff, 2, 680, 0, 2.1);
    this.addRing(center.x, center.y, radius * 0.72, 0x7dccff, 2, 820, 80, 1.45);

    for (let i = 0; i < 58; i += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Math.sqrt(Math.random()) * radius;
      const x = center.x + Math.cos(angle) * distance;
      const y = center.y + Math.sin(angle) * distance - Phaser.Math.Between(34, 86);
      const drop = this.createEffectGraphic(x, y, 5);
      drop.lineStyle(2, 0xa9e3ff, Phaser.Math.FloatBetween(0.55, 0.9));
      drop.lineBetween(0, 0, -this.cellSize * 0.25, this.cellSize * 1.7);
      this.tweens.add({
        targets: drop,
        y: y + Phaser.Math.Between(58, 104),
        alpha: 0,
        duration: Phaser.Math.Between(480, 760),
        ease: 'Sine.easeIn',
        delay: Phaser.Math.Between(0, 170),
        onComplete: () => drop.destroy(),
      });
    }

    for (let i = 0; i < 10; i += 1) {
      const ripple = this.randomPointInRadius(center, radius * 0.8);
      this.addRing(ripple.x, ripple.y, this.cellSize * 0.45, 0xb9efff, 1, 620, Phaser.Math.Between(180, 520), 2.6);
    }
  }

  private playSunEffect(grid: GridPosition): void {
    const center = this.gridToWorldCenter(grid);
    const radius = this.cellSize * 5.6;
    const rays = this.createEffectGraphic(center.x, center.y, 5);
    rays.lineStyle(2, 0xffd36a, 0.8);
    for (let i = 0; i < 18; i += 1) {
      const angle = (Math.PI * 2 * i) / 18;
      rays.lineBetween(
        Math.cos(angle) * radius * 0.15,
        Math.sin(angle) * radius * 0.15,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      );
    }
    rays.fillStyle(0xffb23f, 0.16);
    rays.fillCircle(0, 0, radius * 0.52);
    this.tweens.add({
      targets: rays,
      angle: 18,
      scale: 1.35,
      alpha: 0,
      duration: 920,
      ease: 'Cubic.easeOut',
      onComplete: () => rays.destroy(),
    });

    this.addRing(center.x, center.y, radius * 0.25, 0xffe38b, 3, 780, 0, 3.2);
    this.addRing(center.x, center.y, radius * 0.42, 0xff8f3c, 2, 920, 110, 2.2);
    this.burstParticles(center.x, center.y, 22, [0xffef9f, 0xff9d43, 0xff6b35], radius * 0.2, radius * 0.95, 880);
  }

  private playSeedEffect(grid: GridPosition): void {
    const center = this.gridToWorldCenter(grid);
    const radius = this.cellSize * 4.8;
    this.addRing(center.x, center.y, this.cellSize * 1.2, 0xb7f26a, 2, 620, 0, 3);
    this.addRing(center.x, center.y, this.cellSize * 2.2, 0x68d466, 2, 760, 90, 2.4);
    this.burstParticles(center.x, center.y, 34, [0xd8ff80, 0x7de36a, 0x3ca65a], this.cellSize * 0.8, radius, 980);

    for (let i = 0; i < 18; i += 1) {
      const point = this.randomPointInRadius(center, radius);
      const sprout = this.createEffectGraphic(point.x, point.y, 5);
      sprout.lineStyle(2, 0x9bff75, 0.9);
      sprout.lineBetween(0, this.cellSize * 0.4, 0, -this.cellSize * 0.55);
      sprout.fillStyle(0xc8ff7a, 0.85);
      sprout.fillCircle(-this.cellSize * 0.22, -this.cellSize * 0.18, Math.max(2, this.cellSize * 0.22));
      sprout.fillCircle(this.cellSize * 0.22, -this.cellSize * 0.26, Math.max(2, this.cellSize * 0.22));
      sprout.setScale(0.2);
      this.tweens.add({
        targets: sprout,
        scale: 1,
        alpha: 0,
        duration: 980,
        ease: 'Back.easeOut',
        delay: Phaser.Math.Between(80, 360),
        onComplete: () => sprout.destroy(),
      });
    }
  }

  private playBirthEffect(event: CreatureEvent): void {
    const center = this.gridToWorldCenter(event);
    const color = event.kind === 'herbivore' ? 0xffef83 : 0xff715c;
    this.addRing(center.x, center.y, this.cellSize * 0.55, color, 2, 620, 0, 2.8);
    this.burstParticles(center.x, center.y, 8, [color, 0xffffff], this.cellSize * 0.25, this.cellSize * 1.8, 620);
  }

  private playImpactExplosion(x: number, y: number, radius: number): void {
    const flash = this.createEffectGraphic(x, y, 7);
    flash.fillStyle(0xfff3b0, 0.95);
    flash.fillCircle(0, 0, radius * 0.44);
    flash.fillStyle(0xff5d2e, 0.45);
    flash.fillCircle(0, 0, radius * 0.8);
    this.tweens.add({
      targets: flash,
      scale: 1.65,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy(),
    });

    this.addRing(x, y, radius * 0.38, 0xfff0aa, 4, 520, 0, 3.6);
    this.addRing(x, y, radius * 0.58, 0xff8248, 3, 700, 80, 2.8);
    this.addRing(x, y, radius * 0.9, 0xe2d0b8, 2, 900, 150, 1.9);
    this.burstParticles(x, y, 42, [0xfff0aa, 0xff8942, 0xc9c0b1, 0x5c5048], radius * 0.2, radius * 1.15, 980);

    for (let i = 0; i < 14; i += 1) {
      const point = this.randomPointInRadius({ x, y }, radius * 0.58);
      const smoke = this.createEffectGraphic(point.x, point.y, 5);
      smoke.fillStyle(0xaea090, Phaser.Math.FloatBetween(0.25, 0.42));
      smoke.fillCircle(0, 0, Phaser.Math.FloatBetween(this.cellSize * 0.7, this.cellSize * 1.45));
      this.tweens.add({
        targets: smoke,
        x: point.x + Phaser.Math.Between(-20, 20),
        y: point.y - Phaser.Math.Between(8, 34),
        scale: Phaser.Math.FloatBetween(1.8, 2.6),
        alpha: 0,
        duration: Phaser.Math.Between(920, 1450),
        ease: 'Sine.easeOut',
        delay: Phaser.Math.Between(80, 260),
        onComplete: () => smoke.destroy(),
      });
    }
  }

  private addRing(
    x: number,
    y: number,
    radius: number,
    color: number,
    lineWidth: number,
    duration: number,
    delay: number,
    scale: number,
  ): void {
    const ring = this.createEffectGraphic(x, y, 6);
    ring.lineStyle(lineWidth, color, 0.95);
    ring.strokeCircle(0, 0, radius);
    this.tweens.add({
      targets: ring,
      scale,
      alpha: 0,
      duration,
      delay,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private burstParticles(
    x: number,
    y: number,
    count: number,
    colors: number[],
    minDistance: number,
    maxDistance: number,
    duration: number,
  ): void {
    for (let i = 0; i < count; i += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.FloatBetween(minDistance, maxDistance);
      const particle = this.createEffectGraphic(x, y, 6);
      const size = Phaser.Math.FloatBetween(Math.max(2, this.cellSize * 0.18), Math.max(3, this.cellSize * 0.42));
      particle.fillStyle(colors[Phaser.Math.Between(0, colors.length - 1)], Phaser.Math.FloatBetween(0.72, 1));
      particle.fillCircle(0, 0, size);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        angle: Phaser.Math.Between(-180, 180),
        scale: Phaser.Math.FloatBetween(0.25, 0.8),
        alpha: 0,
        duration: duration + Phaser.Math.Between(-120, 180),
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }

  private createEffectGraphic(x: number, y: number, depth: number): Phaser.GameObjects.Graphics {
    const graphic = this.add.graphics();
    graphic.setPosition(x, y);
    graphic.setDepth(depth);
    return graphic;
  }

  private randomPointInRadius(center: GridPosition, radius: number): GridPosition {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const distance = Math.sqrt(Math.random()) * radius;
    return {
      x: center.x + Math.cos(angle) * distance,
      y: center.y + Math.sin(angle) * distance,
    };
  }

  private gridToWorldCenter(grid: GridPosition): GridPosition {
    return {
      x: this.mapOffsetX + grid.x * this.cellSize + this.cellSize / 2,
      y: this.mapOffsetY + grid.y * this.cellSize + this.cellSize / 2,
    };
  }

  private renderWorld(dt = 0): void {
    if (!this.terrainGraphics) {
      return;
    }

    this.terrainGraphics.clear();
    this.actorGraphics.clear();
    this.overlayGraphics.clear();
    this.drawTerrainBase();

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
    this.drawCreatures(dt);
  }

  private drawTerrainBase(): void {
    const mapWidth = this.cellSize * GRID_WIDTH;
    const mapHeight = this.cellSize * GRID_HEIGHT;
    this.terrainGraphics.fillStyle(0x66aa49, 1);
    this.terrainGraphics.fillRect(this.mapOffsetX, this.mapOffsetY, mapWidth, mapHeight);
  }

  private drawCell(cell: Cell, x: number, y: number): void {
    const px = this.mapOffsetX + x * this.cellSize;
    const py = this.mapOffsetY + y * this.cellSize;
    const bleed = Math.max(0.28, this.cellSize * 0.08);
    const size = this.cellSize + bleed * 2;
    const base = Phaser.Display.Color.ValueToColor(terrainColor[cell.terrain]);
    const grassTint = Math.floor(26 * cell.grass);
    const waterTint = Math.floor(42 * cell.water);
    const nutrientTint = Math.floor(18 * cell.nutrient);
    const heatTint = Math.floor(52 * cell.heat);
    const ashTint = Math.floor(46 * cell.ash);
    const color = Phaser.Display.Color.GetColor(
      Phaser.Math.Clamp(base.red + heatTint + ashTint * 0.25, 0, 255),
      Phaser.Math.Clamp(base.green + grassTint + nutrientTint, 0, 255),
      Phaser.Math.Clamp(base.blue + waterTint + ashTint * 0.2, 0, 255),
    );

    this.terrainGraphics.fillStyle(color, 1);
    this.terrainGraphics.fillRect(px - bleed, py - bleed, size, size);

    if (cell.terrain !== 'water' && cell.terrain !== 'crater' && cell.terrain !== 'mountain' && cell.grass > 0.42) {
      this.terrainGraphics.fillStyle(0xa7e961, Math.min(0.07, (cell.grass - 0.42) * 0.16));
      this.terrainGraphics.fillRect(px - bleed, py - bleed, size, size);
    }

    if (cell.terrain !== 'water' && cell.water > 0.7) {
      this.terrainGraphics.fillStyle(0x6fc7e8, Math.min(0.18, (cell.water - 0.7) * 0.55));
      this.terrainGraphics.fillRect(px - bleed, py - bleed, size, size);
    }

    if (cell.nutrient > 0.78 && cell.terrain !== 'water') {
      this.terrainGraphics.fillStyle(0xe8d86a, Math.min(0.1, (cell.nutrient - 0.78) * 0.32));
      this.terrainGraphics.fillRect(px - bleed, py - bleed, size, size);
    }

    if (cell.heat > 0.55) {
      this.terrainGraphics.fillStyle(0xff6b35, Math.min(0.42, cell.heat * 0.42));
      this.terrainGraphics.fillRect(px - bleed, py - bleed, size, size);
    }

    if (cell.ash > 0.32) {
      this.terrainGraphics.fillStyle(0xc9c0b1, Math.min(0.34, cell.ash * 0.34));
      this.terrainGraphics.fillRect(px - bleed, py - bleed, size, size);
    }
  }

  private drawCreatures(dt: number): void {
    const spriteSize = Math.max(10, this.cellSize * 2.2);
    const shadowWidth = Math.max(6, spriteSize * 0.72);
    const shadowHeight = Math.max(3, spriteSize * 0.32);
    const follow = dt <= 0 ? 1 : 1 - Math.exp(-dt * 13);
    const aliveIds = new Set<number>();

    for (const creature of this.creatures.creatures) {
      const target = this.gridToWorldCenter(creature);
      let visual = this.creatureVisuals.get(creature.id);
      if (!visual) {
        visual = {
          x: target.x,
          y: target.y,
          rotation: 0,
          bobSeed: Phaser.Math.FloatBetween(0, Math.PI * 2),
        };
        this.creatureVisuals.set(creature.id, visual);
      }

      const dx = target.x - visual.x;
      const dy = target.y - visual.y;
      if (Math.hypot(dx, dy) > this.cellSize * 5) {
        visual.x = target.x;
        visual.y = target.y;
      } else {
        visual.x = Phaser.Math.Linear(visual.x, target.x, follow);
        visual.y = Phaser.Math.Linear(visual.y, target.y, follow);
      }
      if (Math.abs(dx) + Math.abs(dy) > 0.02) {
        visual.rotation = Phaser.Math.Angle.RotateTo(visual.rotation, Math.atan2(dy, dx), dt <= 0 ? Math.PI : dt * 10);
      }

      const bob = Math.sin(this.time.now * 0.01 + visual.bobSeed) * Math.min(0.8, this.cellSize * 0.08);
      this.actorGraphics.fillStyle(0x10130f, 0.22);
      this.actorGraphics.fillEllipse(visual.x, visual.y + spriteSize * 0.18, shadowWidth, shadowHeight);

      let sprite = this.creatureSprites.get(creature.id);
      if (!sprite) {
        sprite = this.add.image(visual.x, visual.y, 'creatures', creature.kind === 'herbivore' ? 0 : 1);
        sprite.setDepth(3);
        this.creatureSprites.set(creature.id, sprite);
      }

      sprite.setFrame(creature.kind === 'herbivore' ? 0 : 1);
      sprite.setPosition(visual.x, visual.y + bob);
      sprite.setDisplaySize(spriteSize, spriteSize);
      sprite.setRotation(visual.rotation * 0.18);
      sprite.setAlpha(Phaser.Math.Clamp(0.54 + creature.energy * 0.34, 0.52, 1));
      if (creature.energy < 0.24) {
        sprite.setTint(0xffc7a9);
      } else {
        sprite.clearTint();
      }
      aliveIds.add(creature.id);
    }

    for (const [id, sprite] of this.creatureSprites) {
      if (!aliveIds.has(id)) {
        sprite.destroy();
        this.creatureSprites.delete(id);
        this.creatureVisuals.delete(id);
      }
    }
  }

  private drawCorpses(): void {
    const radius = Math.max(2, this.cellSize * 0.24);
    for (const corpse of this.creatures.corpses) {
      const cx = this.mapOffsetX + corpse.x * this.cellSize + this.cellSize / 2;
      const cy = this.mapOffsetY + corpse.y * this.cellSize + this.cellSize / 2;
      this.actorGraphics.fillStyle(0xead7be, Math.max(0.2, corpse.nutrientsLeft));
      this.actorGraphics.fillEllipse(cx, cy, radius * 2.1, radius * 1.1);
    }
  }
}
