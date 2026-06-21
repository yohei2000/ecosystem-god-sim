import * as Phaser from 'phaser';
import type { Cell, CreatureEvent, CreatureSpecies, GodPower, GridPosition, Season, Terrain, Weather } from '../types';
import terrainAtlasUrl from '../assets/terrain-atlas.png';
import terrainStampsUrl from '../assets/terrain-stamps.png';
import creatureAtlasUrl from '../assets/creature-atlas.png';
import { CreatureSystem } from '../systems/CreatureSystem';
import { EnvironmentSystem } from '../systems/EnvironmentSystem';
import { GodPowerSystem } from '../systems/GodPowerSystem';
import { PlantSystem } from '../systems/PlantSystem';
import { UISystem } from '../systems/UISystem';

const GRID_WIDTH = 122;
const GRID_HEIGHT = 56;
const TERRAIN_ATLAS_FRAME_SIZE = 128;
const TERRAIN_STAMP_FRAME_SIZE = 320;
const TERRAIN_TEXTURE_CELL_SIZE = 12;
const CREATURE_FRAME_SIZE = 192;
const CREATURE_MOTION_FRAMES = 4;

interface CreatureVisual {
  x: number;
  y: number;
  bobSeed: number;
  movement: number;
  facingLeft: boolean;
}

interface TerrainStampDefinition {
  frame: number;
  x: number;
  y: number;
  width: number;
  height: number;
  alpha?: number;
  angle?: number;
  flipX?: boolean;
}

const TERRAIN_STAMPS: TerrainStampDefinition[] = [
  { frame: 3, x: 0.12, y: 0.24, width: 0.24, height: 0.42, alpha: 0.94 },
  { frame: 0, x: 0.18, y: 0.72, width: 0.23, height: 0.3, alpha: 0.96, angle: -8 },
  { frame: 0, x: 0.36, y: 0.17, width: 0.19, height: 0.25, alpha: 0.92, flipX: true },
  { frame: 0, x: 0.82, y: 0.2, width: 0.17, height: 0.23, alpha: 0.9, angle: 9 },
  { frame: 2, x: 0.72, y: 0.33, width: 0.34, height: 0.34, alpha: 0.98 },
  { frame: 2, x: 0.25, y: 0.74, width: 0.24, height: 0.24, alpha: 0.96 },
  { frame: 4, x: 0.52, y: 0.56, width: 0.2, height: 0.23, alpha: 0.98 },
  { frame: 1, x: 0.73, y: 0.74, width: 0.35, height: 0.29, alpha: 0.95, angle: 6 },
  { frame: 1, x: 0.91, y: 0.53, width: 0.27, height: 0.23, alpha: 0.9, angle: -7, flipX: true },
  { frame: 1, x: 0.88, y: 0.09, width: 0.21, height: 0.19, alpha: 0.86, angle: 4 },
];

const terrainColor: Record<Terrain, number> = {
  grassland: 0x5f9f43,
  forest: 0x2f6b35,
  water: 0x247da2,
  wasteland: 0x76634a,
  crater: 0x2f2d2a,
  mountain: 0x656f6c,
};

const baseSeasonColor: Record<Season, number> = {
  spring: 0x69ad4d,
  summer: 0x5e9f43,
  autumn: 0x78924a,
  winter: 0x7d946f,
};

const weatherTint: Record<Weather, { color: number; alpha: number }> = {
  clear: { color: 0xffffff, alpha: 0 },
  rain: { color: 0x79bfff, alpha: 0.08 },
  storm: { color: 0x3c4a64, alpha: 0.18 },
  drought: { color: 0xd5a765, alpha: 0.12 },
  heatwave: { color: 0xff8a3f, alpha: 0.16 },
  ashfall: { color: 0x9d9387, alpha: 0.18 },
};

const speciesLabel: Record<CreatureSpecies, string> = {
  hare: 'ノウサギ',
  deer: 'シカ',
  boar: 'イノシシ',
  wolf: 'オオカミ',
  fox: 'キツネ',
  bear: 'クマ',
  vulture: 'ハゲワシ',
};

const speciesVisual: Record<CreatureSpecies, { frameOffset: number; size: number; gait: number; tint: number }> = {
  hare: { frameOffset: 0, size: 3.25, gait: 12.8, tint: 0xe0b06c },
  deer: { frameOffset: 0, size: 4.45, gait: 8.2, tint: 0xc9975b },
  boar: { frameOffset: 0, size: 4.75, gait: 7.4, tint: 0x7a5741 },
  wolf: { frameOffset: CREATURE_MOTION_FRAMES, size: 4.75, gait: 10.4, tint: 0x5d5e58 },
  fox: { frameOffset: CREATURE_MOTION_FRAMES, size: 3.65, gait: 12.2, tint: 0xd87937 },
  bear: { frameOffset: CREATURE_MOTION_FRAMES, size: 5.9, gait: 6.6, tint: 0x5b3e2f },
  vulture: { frameOffset: CREATURE_MOTION_FRAMES, size: 3.55, gait: 9.4, tint: 0x2f2b27 },
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
  private terrainBaseImage?: Phaser.GameObjects.Image;
  private terrainBaseCanvas?: HTMLCanvasElement;
  private terrainBaseContext?: CanvasRenderingContext2D;
  private terrainScratchCanvas?: HTMLCanvasElement;
  private terrainScratchContext?: CanvasRenderingContext2D;
  private terrainBaseTexture?: Phaser.Textures.CanvasTexture;
  private terrainTextureTimer = 0;
  private readonly terrainStamps: Phaser.GameObjects.Image[] = [];
  private readonly creatureSprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly creatureVisuals = new Map<number, CreatureVisual>();
  private cellSize = 12;
  private mapOffsetX = 0;
  private mapOffsetY = 0;
  private statsTimer = 0;
  private eventLogTimer = 0;
  private readonly birthLogCounts = new Map<CreatureSpecies, number>();
  private readonly eventLogCounts = {
    hunt: 0,
    scavenge: 0,
    outbreak: 0,
    death: 0,
  };

  constructor() {
    super('WorldScene');
  }

  preload(): void {
    this.load.spritesheet('terrain-atlas', terrainAtlasUrl, {
      frameWidth: TERRAIN_ATLAS_FRAME_SIZE,
      frameHeight: TERRAIN_ATLAS_FRAME_SIZE,
    });
    this.load.spritesheet('terrain-stamps', terrainStampsUrl, {
      frameWidth: TERRAIN_STAMP_FRAME_SIZE,
      frameHeight: TERRAIN_STAMP_FRAME_SIZE,
    });
    this.load.spritesheet('creatures', creatureAtlasUrl, {
      frameWidth: CREATURE_FRAME_SIZE,
      frameHeight: CREATURE_FRAME_SIZE,
    });
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
    this.terrainGraphics.setDepth(0.25);
    this.overlayGraphics.setDepth(2);
    this.actorGraphics.setDepth(3);
    this.createTerrainBaseTexture();
    this.createMirroredCreatureTexture();
    this.createTerrainStamps();

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
    this.ui.addLog('生態系が始動: 季節と天候が巡り始める');
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
    const edgePadding = width < 640 ? 2 : 4;
    const availableWidth = width - edgePadding * 2;
    const availableHeight = height - edgePadding * 2;

    this.cellSize = Math.max(4, Math.min(availableWidth / GRID_WIDTH, availableHeight / GRID_HEIGHT));
    const mapWidth = this.cellSize * GRID_WIDTH;
    const mapHeight = this.cellSize * GRID_HEIGHT;

    this.mapOffsetX = (width - mapWidth) / 2;
    this.mapOffsetY = edgePadding + (availableHeight - mapHeight) / 2;
    this.syncTerrainBaseTexture();
    this.syncTerrainStamps();
    this.renderWorld(0);
  }

  private createTerrainStamps(): void {
    for (const stamp of TERRAIN_STAMPS) {
      const image = this.add.image(0, 0, 'terrain-stamps', stamp.frame);
      image.setDepth(1);
      image.setAlpha(stamp.alpha ?? 1);
      image.setAngle(stamp.angle ?? 0);
      image.setFlipX(stamp.flipX ?? false);
      this.terrainStamps.push(image);
    }
  }

  private createTerrainBaseTexture(): void {
    if (this.textures.exists('terrain-base')) {
      this.textures.remove('terrain-base');
    }

    const canvas = document.createElement('canvas');
    canvas.width = GRID_WIDTH * TERRAIN_TEXTURE_CELL_SIZE;
    canvas.height = GRID_HEIGHT * TERRAIN_TEXTURE_CELL_SIZE;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.imageSmoothingEnabled = true;
    const scratchCanvas = document.createElement('canvas');
    scratchCanvas.width = canvas.width;
    scratchCanvas.height = canvas.height;
    const scratchContext = scratchCanvas.getContext('2d');
    if (scratchContext) {
      scratchContext.imageSmoothingEnabled = true;
      this.terrainScratchCanvas = scratchCanvas;
      this.terrainScratchContext = scratchContext;
    }

    this.terrainBaseCanvas = canvas;
    this.terrainBaseContext = context;
    this.terrainBaseTexture = this.textures.addCanvas('terrain-base', canvas) ?? undefined;
    this.terrainBaseImage = this.add.image(0, 0, 'terrain-base');
    this.terrainBaseImage.setOrigin(0, 0);
    this.terrainBaseImage.setDepth(0);
    this.updateTerrainBaseTexture(0, true);
    this.syncTerrainBaseTexture();
  }

  private syncTerrainBaseTexture(): void {
    if (!this.terrainBaseImage) {
      return;
    }
    this.terrainBaseImage.setPosition(this.mapOffsetX, this.mapOffsetY);
    this.terrainBaseImage.setDisplaySize(this.cellSize * GRID_WIDTH, this.cellSize * GRID_HEIGHT);
  }

  private createMirroredCreatureTexture(): void {
    if (this.textures.exists('creatures-left')) {
      return;
    }

    const source = this.textures.get('creatures').getSourceImage() as CanvasImageSource & {
      width: number;
      height: number;
    };
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const columns = Math.floor(source.width / CREATURE_FRAME_SIZE);
    const rows = Math.floor(source.height / CREATURE_FRAME_SIZE);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const frameX = column * CREATURE_FRAME_SIZE;
        const frameY = row * CREATURE_FRAME_SIZE;
        context.save();
        context.translate(frameX + CREATURE_FRAME_SIZE, frameY);
        context.scale(-1, 1);
        context.drawImage(
          source,
          frameX,
          frameY,
          CREATURE_FRAME_SIZE,
          CREATURE_FRAME_SIZE,
          0,
          0,
          CREATURE_FRAME_SIZE,
          CREATURE_FRAME_SIZE,
        );
        context.restore();
      }
    }

    const mirroredTexture = this.textures.addCanvas('creatures-left', canvas);
    if (!mirroredTexture) {
      return;
    }

    this.textures.addSpriteSheet('', mirroredTexture, {
      frameWidth: CREATURE_FRAME_SIZE,
      frameHeight: CREATURE_FRAME_SIZE,
    });
  }

  private syncTerrainStamps(): void {
    const mapWidth = this.cellSize * GRID_WIDTH;
    const mapHeight = this.cellSize * GRID_HEIGHT;
    for (let i = 0; i < TERRAIN_STAMPS.length; i += 1) {
      const definition = TERRAIN_STAMPS[i];
      const image = this.terrainStamps[i];
      if (!image) {
        continue;
      }
      image.setPosition(this.mapOffsetX + definition.x * mapWidth, this.mapOffsetY + definition.y * mapHeight);
      image.setDisplaySize(definition.width * mapWidth, definition.height * mapHeight);
    }
  }

  private updateTerrainBaseTexture(dt: number, force = false): void {
    if (!this.terrainBaseContext || !this.terrainBaseCanvas || !this.terrainBaseTexture) {
      return;
    }
    this.terrainTextureTimer += dt;
    if (!force && this.terrainTextureTimer < 0.55) {
      return;
    }
    this.terrainTextureTimer = 0;

    const context = this.terrainBaseContext;
    const paintCanvas = this.terrainScratchCanvas ?? this.terrainBaseCanvas;
    const paintContext = this.terrainScratchContext ?? context;
    const source = this.textures.get('terrain-atlas').getSourceImage() as CanvasImageSource & {
      width: number;
      height: number;
    };
    paintContext.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
    paintContext.fillStyle = '#5f9f43';
    paintContext.fillRect(0, 0, paintCanvas.width, paintCanvas.height);

    for (let y = 0; y < GRID_HEIGHT; y += 1) {
      for (let x = 0; x < GRID_WIDTH; x += 1) {
        const cell = this.environment.getCell(x, y);
        if (!cell) {
          continue;
        }

        const frame = this.terrainFrameForCell(cell);
        const frameX = (frame % 4) * TERRAIN_ATLAS_FRAME_SIZE;
        const frameY = Math.floor(frame / 4) * TERRAIN_ATLAS_FRAME_SIZE;
        const seed = this.terrainSeed(x, y);
        const sample = 52 + (seed % 30);
        const sourceX = frameX + ((seed >>> 4) % Math.max(1, TERRAIN_ATLAS_FRAME_SIZE - sample));
        const sourceY = frameY + ((seed >>> 11) % Math.max(1, TERRAIN_ATLAS_FRAME_SIZE - sample));
        const destX = x * TERRAIN_TEXTURE_CELL_SIZE;
        const destY = y * TERRAIN_TEXTURE_CELL_SIZE;

        paintContext.drawImage(source, sourceX, sourceY, sample, sample, destX - 1, destY - 1, TERRAIN_TEXTURE_CELL_SIZE + 3, TERRAIN_TEXTURE_CELL_SIZE + 3);
        this.tintTerrainTextureCell(paintContext, cell, destX, destY);
      }
    }

    if (paintCanvas !== this.terrainBaseCanvas) {
      context.clearRect(0, 0, this.terrainBaseCanvas.width, this.terrainBaseCanvas.height);
      context.save();
      context.filter = 'blur(2.8px)';
      context.drawImage(paintCanvas, -4, -4, this.terrainBaseCanvas.width + 8, this.terrainBaseCanvas.height + 8);
      context.restore();
      context.save();
      context.globalAlpha = 0.42;
      context.drawImage(paintCanvas, 0, 0);
      context.restore();
    }

    this.terrainBaseTexture.refresh();
  }

  private terrainFrameForCell(cell: Cell): number {
    if (cell.terrain === 'forest') return 1;
    if (cell.terrain === 'water') return 2;
    if (cell.terrain === 'wasteland') return cell.ash > 0.34 || cell.toxicity > 0.35 ? 6 : 3;
    if (cell.terrain === 'crater') return 4;
    if (cell.terrain === 'mountain') return 5;
    return cell.grass > 0.72 && cell.water > 0.32 ? 7 : 0;
  }

  private tintTerrainTextureCell(context: CanvasRenderingContext2D, cell: Cell, x: number, y: number): void {
    const size = TERRAIN_TEXTURE_CELL_SIZE + 1;
    if (cell.terrain !== 'water' && cell.grass > 0.42) {
      context.fillStyle = `rgba(92, 168, 64, ${Math.min(0.22, cell.grass * 0.18)})`;
      context.fillRect(x, y, size, size);
    }
    if (cell.water > 0.74 && cell.terrain !== 'water') {
      context.fillStyle = `rgba(90, 178, 214, ${Math.min(0.22, (cell.water - 0.74) * 0.55)})`;
      context.fillRect(x, y, size, size);
    }
    if (cell.heat > 0.55) {
      context.fillStyle = `rgba(232, 95, 42, ${Math.min(0.3, cell.heat * 0.24)})`;
      context.fillRect(x, y, size, size);
    }
    if (cell.ash > 0.32) {
      context.fillStyle = `rgba(194, 184, 172, ${Math.min(0.28, cell.ash * 0.24)})`;
      context.fillRect(x, y, size, size);
    }
    if (cell.toxicity > 0.34) {
      context.fillStyle = `rgba(94, 74, 142, ${Math.min(0.22, cell.toxicity * 0.2)})`;
      context.fillRect(x, y, size, size);
    }
  }

  private terrainSeed(x: number, y: number): number {
    return (Math.imul(x + 31, 73856093) ^ Math.imul(y + 47, 19349663)) >>> 0;
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
    this.eventLogTimer += dt;
    for (const event of this.creatures.consumeEvents()) {
      switch (event.type) {
        case 'birth':
          if (event.species) {
            this.birthLogCounts.set(event.species, (this.birthLogCounts.get(event.species) ?? 0) + 1);
          }
          this.playBirthEffect(event);
          break;
        case 'hunt':
          this.eventLogCounts.hunt += 1;
          this.playHuntEffect(event);
          break;
        case 'scavenge':
          this.eventLogCounts.scavenge += 1;
          this.playScavengeEffect(event);
          break;
        case 'outbreak':
          this.eventLogCounts.outbreak += 1;
          this.playOutbreakEffect(event);
          break;
        case 'death':
          this.eventLogCounts.death += 1;
          break;
        case 'recovery':
          break;
      }
    }

    if (this.eventLogTimer >= 1.5) {
      const messages: string[] = [];
      for (const [species, count] of this.birthLogCounts) {
        if (count > 0) {
          messages.push(`${speciesLabel[species]} +${count}`);
        }
      }
      if (this.eventLogCounts.hunt > 0) messages.push(`捕食 ${this.eventLogCounts.hunt}`);
      if (this.eventLogCounts.scavenge > 0) messages.push(`腐肉漁り ${this.eventLogCounts.scavenge}`);
      if (this.eventLogCounts.outbreak > 0) messages.push(`疫病 ${this.eventLogCounts.outbreak}`);
      if (this.eventLogCounts.death > 0) messages.push(`自然死 ${this.eventLogCounts.death}`);
      if (messages.length > 0) {
        this.ui.addLog(messages.join(' / '));
      }
      this.birthLogCounts.clear();
      this.eventLogCounts.hunt = 0;
      this.eventLogCounts.scavenge = 0;
      this.eventLogCounts.outbreak = 0;
      this.eventLogCounts.death = 0;
      this.eventLogTimer = 0;
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
      const point = this.randomPointInRadius(center, radius);
      const drop = this.createEffectGraphic(point.x, point.y - Phaser.Math.Between(34, 86), 5);
      drop.lineStyle(2, 0xa9e3ff, Phaser.Math.FloatBetween(0.55, 0.9));
      drop.lineBetween(0, 0, -this.cellSize * 0.25, this.cellSize * 1.7);
      this.tweens.add({
        targets: drop,
        y: drop.y + Phaser.Math.Between(58, 104),
        alpha: 0,
        duration: Phaser.Math.Between(480, 760),
        ease: 'Sine.easeIn',
        delay: Phaser.Math.Between(0, 170),
        onComplete: () => drop.destroy(),
      });
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
    this.burstParticles(center.x, center.y, 22, [0xffef9f, 0xff9d43, 0xff6b35], radius * 0.2, radius * 0.95, 880);
  }

  private playSeedEffect(grid: GridPosition): void {
    const center = this.gridToWorldCenter(grid);
    const radius = this.cellSize * 4.8;
    this.addRing(center.x, center.y, this.cellSize * 1.2, 0xb7f26a, 2, 620, 0, 3);
    this.addRing(center.x, center.y, this.cellSize * 2.2, 0x68d466, 2, 760, 90, 2.4);
    this.burstParticles(center.x, center.y, 34, [0xd8ff80, 0x7de36a, 0x3ca65a], this.cellSize * 0.8, radius, 980);
  }

  private playBirthEffect(event: CreatureEvent): void {
    const center = this.gridToWorldCenter(event);
    const color =
      event.species && speciesVisual[event.species]
        ? speciesVisual[event.species].tint
        : event.kind === 'carnivore'
          ? 0xff715c
          : 0xffef83;
    this.addRing(center.x, center.y, this.cellSize * 0.55, color, 2, 620, 0, 2.8);
    this.burstParticles(center.x, center.y, 8, [color, 0xffffff], this.cellSize * 0.25, this.cellSize * 1.8, 620);
  }

  private playHuntEffect(event: CreatureEvent): void {
    const center = this.gridToWorldCenter(event);
    this.burstParticles(center.x, center.y, 7, [0xff4d38, 0x5a1815], this.cellSize * 0.2, this.cellSize * 1.2, 420);
  }

  private playScavengeEffect(event: CreatureEvent): void {
    const center = this.gridToWorldCenter(event);
    this.addRing(center.x, center.y, this.cellSize * 0.4, 0xc8b28e, 1, 480, 0, 2);
  }

  private playOutbreakEffect(event: CreatureEvent): void {
    const center = this.gridToWorldCenter(event);
    this.addRing(center.x, center.y, this.cellSize * 0.7, 0x9bdd70, 2, 720, 0, 2.6);
    this.burstParticles(center.x, center.y, 10, [0x9bdd70, 0xd6ffb0, 0x4f6f3d], this.cellSize * 0.2, this.cellSize * 1.7, 700);
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
    this.updateTerrainBaseTexture(dt);
    this.drawTerrainBase();

    for (let y = 0; y < this.environment.height; y += 1) {
      for (let x = 0; x < this.environment.width; x += 1) {
        const cell = this.environment.getCell(x, y);
        if (cell) {
          this.drawCell(cell, x, y);
        }
      }
    }

    this.drawAtmosphere(dt);
    this.drawCorpses();
    this.drawCreatures(dt);
  }

  private drawTerrainBase(): void {
    const mapWidth = this.cellSize * GRID_WIDTH;
    const mapHeight = this.cellSize * GRID_HEIGHT;
    const climate = this.environment.getClimate();
    this.terrainGraphics.fillStyle(baseSeasonColor[climate.season], climate.season === 'winter' ? 0.16 : 0.08);
    this.terrainGraphics.fillRect(this.mapOffsetX, this.mapOffsetY, mapWidth, mapHeight);
  }

  private drawCell(cell: Cell, x: number, y: number): void {
    const px = this.mapOffsetX + x * this.cellSize;
    const py = this.mapOffsetY + y * this.cellSize;
    const cx = px + this.cellSize / 2;
    const cy = py + this.cellSize / 2;
    const radius = Math.max(1.2, this.cellSize * 0.6);

    if (cell.terrain === 'crater') {
      this.overlayGraphics.fillStyle(terrainColor.crater, 0.16 + cell.ash * 0.18);
      this.overlayGraphics.fillCircle(cx, cy, radius * 1.12);
    }
    if (cell.terrain !== 'water' && cell.water > 0.78) {
      this.overlayGraphics.fillStyle(0x6fc7e8, Math.min(0.13, (cell.water - 0.78) * 0.42));
      this.overlayGraphics.fillCircle(cx, cy, radius * 0.8);
    }
    if (cell.nutrient > 0.86 && cell.terrain !== 'water') {
      this.overlayGraphics.fillStyle(0xe8d86a, Math.min(0.08, (cell.nutrient - 0.86) * 0.26));
      this.overlayGraphics.fillCircle(cx, cy, radius * 0.7);
    }
    if (cell.fungus > 0.38 && cell.terrain !== 'water') {
      this.overlayGraphics.fillStyle(0x9bd36a, Math.min(0.16, cell.fungus * 0.2));
      this.overlayGraphics.fillCircle(cx, cy, radius * 0.72);
    }
    if (cell.heat > 0.55) {
      this.overlayGraphics.fillStyle(0xff6b35, Math.min(0.3, cell.heat * 0.3));
      this.overlayGraphics.fillCircle(cx, cy, radius * 0.95);
    }
    if (cell.ash > 0.32) {
      this.overlayGraphics.fillStyle(0xc9c0b1, Math.min(0.22, cell.ash * 0.22));
      this.overlayGraphics.fillCircle(cx, cy, radius);
    }
    if (cell.toxicity > 0.34) {
      this.overlayGraphics.fillStyle(0x6f5aa8, Math.min(0.18, cell.toxicity * 0.22));
      this.overlayGraphics.fillCircle(cx, cy, radius * 0.82);
    }
  }

  private drawAtmosphere(dt: number): void {
    const climate = this.environment.getClimate();
    const tint = weatherTint[climate.weather];
    const mapWidth = this.cellSize * GRID_WIDTH;
    const mapHeight = this.cellSize * GRID_HEIGHT;
    if (tint.alpha > 0) {
      this.overlayGraphics.fillStyle(tint.color, tint.alpha);
      this.overlayGraphics.fillRect(this.mapOffsetX, this.mapOffsetY, mapWidth, mapHeight);
    }

    if (climate.weather === 'rain' || climate.weather === 'storm') {
      const drops = climate.weather === 'storm' ? 42 : 24;
      this.overlayGraphics.lineStyle(1, 0xb6e6ff, climate.weather === 'storm' ? 0.22 : 0.16);
      const drift = (this.time.now * 0.08) % 48;
      for (let i = 0; i < drops; i += 1) {
        const x = this.mapOffsetX + ((i * 97 + drift * 3) % mapWidth);
        const y = this.mapOffsetY + ((i * 41 + drift) % mapHeight);
        this.overlayGraphics.lineBetween(x, y, x - this.cellSize * 0.7, y + this.cellSize * 2.1);
      }
    }

    if (climate.weather === 'ashfall') {
      this.overlayGraphics.fillStyle(0xd0c7b8, 0.16);
      const drift = this.time.now * 0.012 + dt;
      for (let i = 0; i < 42; i += 1) {
        const x = this.mapOffsetX + ((i * 83 + drift * 16) % mapWidth);
        const y = this.mapOffsetY + ((i * 29 + drift * 23) % mapHeight);
        this.overlayGraphics.fillCircle(x, y, Math.max(1, this.cellSize * 0.14));
      }
    }
  }

  private drawCreatures(dt: number): void {
    const follow = dt <= 0 ? 1 : 1 - Math.exp(-dt * 13);
    const aliveIds = new Set<number>();

    for (const creature of this.creatures.creatures) {
      const target = this.gridToWorldCenter(creature);
      let visual = this.creatureVisuals.get(creature.id);
      if (!visual) {
        visual = {
          x: target.x,
          y: target.y,
          bobSeed: Phaser.Math.FloatBetween(0, Math.PI * 2),
          movement: 0,
          facingLeft: false,
        };
        this.creatureVisuals.set(creature.id, visual);
      }

      const dx = target.x - visual.x;
      const dy = target.y - visual.y;
      const distance = Math.hypot(dx, dy);
      if (distance > this.cellSize * 5) {
        visual.x = target.x;
        visual.y = target.y;
      } else {
        visual.x = Phaser.Math.Linear(visual.x, target.x, follow);
        visual.y = Phaser.Math.Linear(visual.y, target.y, follow);
      }
      visual.movement = Phaser.Math.Linear(visual.movement, Math.min(1, distance / Math.max(1, this.cellSize * 1.8)), dt <= 0 ? 1 : dt * 12);
      if (distance > 0.02) {
        if (Math.abs(dx) > this.cellSize * 0.04) {
          visual.facingLeft = dx < 0;
        }
      }

      const visualStyle = speciesVisual[creature.species] ?? speciesVisual.deer;
      const spriteSize = Math.max(22, this.cellSize * visualStyle.size);
      const shadowWidth = Math.max(16, spriteSize * 0.82);
      const shadowHeight = Math.max(6, spriteSize * 0.28);
      const gaitSpeed = visualStyle.gait;
      const isMoving = visual.movement > 0.08;
      const motionFrame = isMoving
        ? Math.floor((this.time.now * 0.001 * gaitSpeed + visual.bobSeed) % CREATURE_MOTION_FRAMES)
        : 0;
      const frameOffset = visualStyle.frameOffset;
      const bob = Math.sin(this.time.now * 0.016 * gaitSpeed + visual.bobSeed) * Math.min(2.2, spriteSize * 0.055) * visual.movement;
      this.actorGraphics.fillStyle(0x10130f, creature.state === 'fleeing' ? 0.3 : 0.22);
      this.actorGraphics.fillEllipse(visual.x, visual.y + spriteSize * 0.18, shadowWidth, shadowHeight);

      if (creature.sickness > 0.38) {
        this.actorGraphics.fillStyle(0xa8e06f, 0.24);
        this.actorGraphics.fillCircle(visual.x, visual.y - spriteSize * 0.18, Math.max(3, spriteSize * 0.16));
      }
      if (creature.state === 'fleeing') {
        this.actorGraphics.lineStyle(1, 0xfff3a0, 0.48);
        this.actorGraphics.strokeCircle(visual.x, visual.y, spriteSize * 0.48);
      }

      let sprite = this.creatureSprites.get(creature.id);
      if (!sprite) {
        const textureKey = visual.facingLeft ? 'creatures-left' : 'creatures';
        sprite = this.add.image(visual.x, visual.y, textureKey, frameOffset + motionFrame);
        sprite.setDepth(4);
        this.creatureSprites.set(creature.id, sprite);
      }

      const textureKey = visual.facingLeft ? 'creatures-left' : 'creatures';
      if (sprite.texture.key !== textureKey) {
        sprite.setTexture(textureKey, frameOffset + motionFrame);
      } else {
        sprite.setFrame(frameOffset + motionFrame);
      }
      sprite.setPosition(visual.x, visual.y + bob);
      sprite.setDisplaySize(spriteSize, spriteSize);
      sprite.setFlipX(false);
      sprite.setRotation(0);
      sprite.setAlpha(Phaser.Math.Clamp(0.62 + creature.energy * 0.3 - creature.sickness * 0.14, 0.48, 1));
      if (creature.sickness > 0.48) {
        sprite.setTint(0xc7eaa1);
      } else if (creature.stress > 0.7 || creature.energy < 0.24) {
        sprite.setTint(0xffc7a9);
      } else {
        sprite.setTint(visualStyle.tint);
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
      const ageAlpha = Phaser.Math.Clamp(0.2 + corpse.nutrientsLeft * 0.8, 0.16, 0.9);
      this.actorGraphics.fillStyle(0xead7be, ageAlpha);
      this.actorGraphics.fillEllipse(cx, cy, radius * 2.1, radius * 1.1);
      if (corpse.decay > 5) {
        this.actorGraphics.fillStyle(0x9bd36a, 0.18);
        this.actorGraphics.fillCircle(cx, cy, radius * 1.8);
      }
    }
  }
}
