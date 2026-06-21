import * as Phaser from 'phaser';
import type { Cell, CreatureEvent, CreatureSpecies, CreatureTerritory, GodPower, GridPosition, Season, Terrain, Weather } from '../types';
import terrainWorldUrl from '../assets/terrain-world-imagegen-chat.png';
import creatureAtlasUrl from '../assets/creature-atlas.png';
import effectAtlasUrl from '../assets/effect-atlas.png';
import { CreatureSystem } from '../systems/CreatureSystem';
import { EnvironmentSystem } from '../systems/EnvironmentSystem';
import { GodPowerSystem } from '../systems/GodPowerSystem';
import { PlantSystem } from '../systems/PlantSystem';
import { UISystem } from '../systems/UISystem';

const GRID_WIDTH = 122;
const GRID_HEIGHT = 56;
const CREATURE_FRAME_SIZE = 192;
const CREATURE_MOTION_FRAMES = 4;
const EFFECT_FRAME_SIZE = 256;
const CELL_OVERLAY_REFRESH_SECONDS = 5.0;
const TERRITORY_OVERLAY_REFRESH_SECONDS = 0.16;
const TERRITORY_MAP_REFRESH_SECONDS = 0.16;
const ACTOR_EFFECT_REFRESH_SECONDS = 1.5;
const TERRITORY_OUTLINE_POINTS = 24;
const ENVIRONMENT_STEP_SECONDS = 0.48;
const PLANT_STEP_SECONDS = 0.48;
const CREATURE_STEP_SECONDS = 0.08;
const MAX_SYSTEM_STEP_SECONDS = 0.14;
const STATS_REFRESH_SECONDS = 1.0;

interface CreatureVisual {
  x: number;
  y: number;
  animationSeed: number;
  facingLeft: boolean;
}

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
  lynx: 'オオヤマネコ',
  panther: 'クロヒョウ',
};

const speciesVisual: Record<CreatureSpecies, { frameOffset: number; size: number; gait: number; color: number }> = {
  hare: { frameOffset: 0, size: 3.25, gait: 12.8, color: 0xe0b06c },
  deer: { frameOffset: 4, size: 4.45, gait: 8.2, color: 0xc9975b },
  boar: { frameOffset: 8, size: 4.75, gait: 7.4, color: 0x7a5741 },
  wolf: { frameOffset: 12, size: 4.75, gait: 10.4, color: 0x7f8780 },
  fox: { frameOffset: 16, size: 3.65, gait: 12.2, color: 0xd87937 },
  bear: { frameOffset: 20, size: 5.9, gait: 6.6, color: 0x5b3e2f },
  vulture: { frameOffset: 24, size: 3.55, gait: 9.4, color: 0x2f2b27 },
  lynx: { frameOffset: 28, size: 3.95, gait: 11.8, color: 0xc5833f },
  panther: { frameOffset: 32, size: 4.9, gait: 9.6, color: 0x20252c },
};

const effectFrame = {
  meteor: 0,
  impact: 1,
  rain: 2,
  sun: 3,
  seed: 4,
  corpse: 5,
  sickness: 6,
  alert: 7,
  ash: 8,
} as const;

export class WorldScene extends Phaser.Scene {
  private environment!: EnvironmentSystem;
  private plants!: PlantSystem;
  private creatures!: CreatureSystem;
  private godPowers!: GodPowerSystem;
  private ui!: UISystem;
  private terrainGraphics!: Phaser.GameObjects.Graphics;
  private cellOverlayGraphics!: Phaser.GameObjects.Graphics;
  private actorGraphics!: Phaser.GameObjects.Graphics;
  private overlayGraphics!: Phaser.GameObjects.Graphics;
  private territoryGraphics!: Phaser.GameObjects.Graphics;
  private terrainBaseImage?: Phaser.GameObjects.Image;
  private cellOverlayTimer = 0;
  private cellOverlayDirty = true;
  private readonly creatureSprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly creatureSicknessGlows = new Map<number, Phaser.GameObjects.Image>();
  private readonly creatureAlertRings = new Map<number, Phaser.GameObjects.Image>();
  private readonly corpseSprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly creatureVisuals = new Map<number, CreatureVisual>();
  private readonly territoryLabels = new Map<CreatureSpecies, Phaser.GameObjects.Text>();
  private readonly territoryOutlineCache = new Map<string, Phaser.Geom.Point[]>();
  private territoryMapMode = false;
  private territoryOverlayDirty = true;
  private territoryOverlayTimer = 0;
  private previousTerritoryMapMode = false;
  private actorEffectDirty = true;
  private actorEffectTimer = 0;
  private creatureSpritesVisible = true;
  private environmentAccumulator = 0;
  private plantAccumulator = 0;
  private creatureAccumulator = 0;
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
    this.load.image('terrain-world', terrainWorldUrl);
    this.load.spritesheet('creatures', creatureAtlasUrl, {
      frameWidth: CREATURE_FRAME_SIZE,
      frameHeight: CREATURE_FRAME_SIZE,
    });
    this.load.spritesheet('effects', effectAtlasUrl, {
      frameWidth: EFFECT_FRAME_SIZE,
      frameHeight: EFFECT_FRAME_SIZE,
    });
  }

  create(): void {
    this.environment = new EnvironmentSystem(GRID_WIDTH, GRID_HEIGHT);
    this.plants = new PlantSystem(this.environment);
    this.creatures = new CreatureSystem(this.environment);
    this.ui = new UISystem(
      (power) => this.godPowers.setPower(power),
      (enabled) => {
        this.territoryMapMode = enabled;
        this.territoryOverlayDirty = true;
        this.ui.addLog(enabled ? '縄張り地図を表示' : '通常表示に戻す');
        this.renderWorld(0);
      },
    );
    this.godPowers = new GodPowerSystem(this.environment, this.creatures, (message) => this.ui.addLog(message));

    this.terrainGraphics = this.add.graphics();
    this.cellOverlayGraphics = this.add.graphics();
    this.actorGraphics = this.add.graphics();
    this.overlayGraphics = this.add.graphics();
    this.territoryGraphics = this.add.graphics();
    this.terrainGraphics.setDepth(0.25);
    this.cellOverlayGraphics.setDepth(1.7);
    this.overlayGraphics.setDepth(2);
    this.territoryGraphics.setDepth(2.4);
    this.actorGraphics.setDepth(3);
    this.createTerrainBaseTexture();
    this.createMirroredCreatureTexture();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const grid = this.pointerToGrid(pointer.x, pointer.y);
      if (grid) {
        const power = this.godPowers.selectedPower;
        this.godPowers.applyAt(grid);
        this.cellOverlayDirty = true;
        this.actorEffectDirty = true;
        this.territoryOverlayDirty = true;
        this.playGodPowerEffect(power, grid);
      }
    });

    this.scale.on('resize', () => this.resizeMap());
    this.resizeMap();
    this.ui.addLog('生態系が始動: 季節と天候が巡り始める');
  }

  update(_: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.08);
    this.stepSimulation(dt);
    this.renderWorld(dt);

    this.statsTimer += dt;
    if (this.statsTimer > STATS_REFRESH_SECONDS) {
      this.ui.updateStats(this.creatures.getStats());
      this.statsTimer = 0;
    }
  }

  private stepSimulation(dt: number): void {
    this.environmentAccumulator = Math.min(this.environmentAccumulator + dt, ENVIRONMENT_STEP_SECONDS * 2);
    this.plantAccumulator = Math.min(this.plantAccumulator + dt, PLANT_STEP_SECONDS * 2);
    this.creatureAccumulator = Math.min(this.creatureAccumulator + dt, CREATURE_STEP_SECONDS * 2);

    if (this.creatureAccumulator >= CREATURE_STEP_SECONDS) {
      const step = Math.min(this.creatureAccumulator, MAX_SYSTEM_STEP_SECONDS);
      this.creatures.update(step);
      this.processCreatureEvents(step);
      this.creatureAccumulator = 0;
      return;
    }

    if (this.plantAccumulator >= PLANT_STEP_SECONDS) {
      const step = Math.min(this.plantAccumulator, MAX_SYSTEM_STEP_SECONDS);
      this.plants.update(step);
      this.plantAccumulator = 0;
      return;
    }

    if (this.environmentAccumulator >= ENVIRONMENT_STEP_SECONDS) {
      const step = Math.min(this.environmentAccumulator, MAX_SYSTEM_STEP_SECONDS);
      this.environment.update(step);
      this.environmentAccumulator = 0;
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
    this.cellOverlayDirty = true;
    this.actorEffectDirty = true;
    this.territoryOverlayDirty = true;
    this.territoryOutlineCache.clear();
    this.syncTerrainBaseTexture();
    this.renderWorld(0);
  }

  private createTerrainBaseTexture(): void {
    this.terrainBaseImage = this.add.image(0, 0, 'terrain-world');
    this.terrainBaseImage.setOrigin(0, 0);
    this.terrainBaseImage.setDepth(0);
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
    const events = this.creatures.consumeEvents();
    if (events.length > 0) {
      this.actorEffectDirty = true;
      this.territoryOverlayDirty = true;
    }

    for (const event of events) {
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
    const fireball = this.add.image(startX, startY, 'effects', effectFrame.meteor);
    fireball.setDepth(6);
    fireball.setAngle(-28);
    fireball.setDisplaySize(this.cellSize * 9.5, this.cellSize * 9.5);

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
    const rain = this.add.image(center.x, center.y - radius * 0.12, 'effects', effectFrame.rain);
    rain.setDepth(5.2);
    rain.setDisplaySize(radius * 2.45, radius * 1.85);
    rain.setAlpha(0.88);
    this.tweens.add({
      targets: rain,
      y: rain.y + this.cellSize * 0.8,
      alpha: 0,
      duration: 980,
      ease: 'Sine.easeOut',
      onComplete: () => rain.destroy(),
    });
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
    const sun = this.add.image(center.x, center.y, 'effects', effectFrame.sun);
    sun.setDepth(5.1);
    sun.setDisplaySize(radius * 1.95, radius * 1.95);
    sun.setAlpha(0.88);
    this.tweens.add({
      targets: sun,
      angle: 16,
      scale: 1.16,
      alpha: 0,
      duration: 920,
      ease: 'Cubic.easeOut',
      onComplete: () => sun.destroy(),
    });
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
    const seed = this.add.image(center.x, center.y, 'effects', effectFrame.seed);
    seed.setDepth(5.15);
    seed.setDisplaySize(radius * 1.85, radius * 1.85);
    seed.setAlpha(0.9);
    this.tweens.add({
      targets: seed,
      scale: 1.12,
      alpha: 0,
      duration: 940,
      ease: 'Cubic.easeOut',
      onComplete: () => seed.destroy(),
    });
    this.addRing(center.x, center.y, this.cellSize * 1.2, 0xb7f26a, 2, 620, 0, 3);
    this.addRing(center.x, center.y, this.cellSize * 2.2, 0x68d466, 2, 760, 90, 2.4);
    this.burstParticles(center.x, center.y, 34, [0xd8ff80, 0x7de36a, 0x3ca65a], this.cellSize * 0.8, radius, 980);
  }

  private playBirthEffect(event: CreatureEvent): void {
    const center = this.gridToWorldCenter(event);
    const color =
      event.species && speciesVisual[event.species]
        ? speciesVisual[event.species].color
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
    const impact = this.add.image(x, y, 'effects', effectFrame.impact);
    impact.setDepth(7.1);
    impact.setDisplaySize(radius * 2.35, radius * 2.35);
    impact.setAlpha(0.96);
    this.tweens.add({
      targets: impact,
      scale: 1.42,
      alpha: 0,
      duration: 620,
      ease: 'Cubic.easeOut',
      onComplete: () => impact.destroy(),
    });
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
    this.overlayGraphics.clear();
    this.updateCellOverlayGraphics(dt);
    this.drawTerrainBase();

    this.drawAtmosphere(dt);
    this.updateTerritoryGraphics(dt);
    if (this.territoryMapMode) {
      this.actorGraphics.setVisible(false);
      this.hideCreatureSprites();
      this.hideCorpseSprites();
    } else {
      this.actorGraphics.setVisible(true);
      this.updateActorEffectGraphics(dt);
      this.drawCreatures(dt);
    }
  }

  private updateTerritoryGraphics(dt: number): void {
    const modeChanged = this.previousTerritoryMapMode !== this.territoryMapMode;
    if (modeChanged) {
      this.previousTerritoryMapMode = this.territoryMapMode;
      this.territoryOverlayDirty = true;
      if (!this.territoryMapMode) {
        this.hideTerritoryLabels();
      }
    }

    this.territoryOverlayTimer += dt;
    const refreshSeconds = this.territoryMapMode ? TERRITORY_MAP_REFRESH_SECONDS : TERRITORY_OVERLAY_REFRESH_SECONDS;
    if (!this.territoryOverlayDirty && this.territoryOverlayTimer < refreshSeconds) {
      return;
    }

    this.territoryOverlayTimer = 0;
    this.territoryOverlayDirty = false;
    this.territoryGraphics.clear();
    if (this.territoryMapMode) {
      this.drawTerritoryMapOverlay();
    } else {
      this.hideTerritoryLabels();
      this.drawPredatorTerritories();
    }
  }

  private updateActorEffectGraphics(dt: number): void {
    this.actorEffectTimer += dt;
    if (!this.actorEffectDirty && this.actorEffectTimer < ACTOR_EFFECT_REFRESH_SECONDS) {
      return;
    }

    this.actorEffectTimer = 0;
    this.actorEffectDirty = false;
    this.actorGraphics.clear();
    this.drawCorpses();
  }

  private updateCellOverlayGraphics(dt: number): void {
    this.cellOverlayTimer += dt;
    if (!this.cellOverlayDirty && this.cellOverlayTimer < CELL_OVERLAY_REFRESH_SECONDS) {
      return;
    }
    this.cellOverlayTimer = 0;
    this.cellOverlayDirty = false;
    this.cellOverlayGraphics.clear();

    for (let y = 0; y < this.environment.height; y += 1) {
      for (let x = 0; x < this.environment.width; x += 1) {
        const cell = this.environment.getCell(x, y);
        if (cell) {
          this.drawCell(cell, x, y);
        }
      }
    }
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
      this.cellOverlayGraphics.fillStyle(terrainColor.crater, 0.16 + cell.ash * 0.18);
      this.cellOverlayGraphics.fillCircle(cx, cy, radius * 1.12);
    }
    if (cell.terrain !== 'water' && cell.water > 0.78) {
      this.cellOverlayGraphics.fillStyle(0x6fc7e8, Math.min(0.13, (cell.water - 0.78) * 0.42));
      this.cellOverlayGraphics.fillCircle(cx, cy, radius * 0.8);
    }
    if (cell.nutrient > 0.86 && cell.terrain !== 'water') {
      this.cellOverlayGraphics.fillStyle(0xe8d86a, Math.min(0.08, (cell.nutrient - 0.86) * 0.26));
      this.cellOverlayGraphics.fillCircle(cx, cy, radius * 0.7);
    }
    if (cell.fungus > 0.38 && cell.terrain !== 'water') {
      this.cellOverlayGraphics.fillStyle(0x9bd36a, Math.min(0.16, cell.fungus * 0.2));
      this.cellOverlayGraphics.fillCircle(cx, cy, radius * 0.72);
    }
    if (cell.heat > 0.55) {
      this.cellOverlayGraphics.fillStyle(0xff6b35, Math.min(0.3, cell.heat * 0.3));
      this.cellOverlayGraphics.fillCircle(cx, cy, radius * 0.95);
    }
    if (cell.ash > 0.32) {
      this.cellOverlayGraphics.fillStyle(0xc9c0b1, Math.min(0.22, cell.ash * 0.22));
      this.cellOverlayGraphics.fillCircle(cx, cy, radius);
    }
    if (cell.toxicity > 0.34) {
      this.cellOverlayGraphics.fillStyle(0x6f5aa8, Math.min(0.18, cell.toxicity * 0.22));
      this.cellOverlayGraphics.fillCircle(cx, cy, radius * 0.82);
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

  private drawPredatorTerritories(): void {
    for (const territory of this.creatures.getPredatorTerritories()) {
      this.drawPredatorTerritory(territory);
    }
  }

  private drawPredatorTerritory(territory: CreatureTerritory): void {
    const center = this.gridToWorldCenter(territory);
    const radius = territory.radius * this.cellSize;
    const visualStyle = speciesVisual[territory.species] ?? speciesVisual.wolf;
    const alpha = Phaser.Math.Clamp(0.025 + territory.strength * 0.055 + territory.pressure * 0.016, 0.035, 0.13);
    const pulse = 0.5 + Math.sin(this.time.now * 0.003 + territory.packId) * 0.5;
    const zocOutline = this.createTerritoryOutline(territory, territory.zocRadius);
    const coreOutline = this.createTerritoryOutline(territory, territory.radius);

    this.territoryGraphics.lineStyle(Math.max(1, this.cellSize * 0.08), visualStyle.color, alpha * 0.34);
    this.territoryGraphics.strokePoints(zocOutline, true, true);
    this.territoryGraphics.fillStyle(visualStyle.color, alpha * 0.16);
    this.territoryGraphics.fillPoints(coreOutline, true, true);
    this.territoryGraphics.lineStyle(Math.max(1, this.cellSize * 0.16), visualStyle.color, alpha);
    this.territoryGraphics.strokePoints(coreOutline, true, true);
    this.territoryGraphics.fillStyle(visualStyle.color, alpha * 1.7);
    this.territoryGraphics.fillCircle(center.x, center.y, Math.max(2, this.cellSize * 0.38));

    if (territory.pressure > 0.42) {
      const pressureOutline = this.createTerritoryOutline(territory, territory.radius * (0.9 + pulse * 0.04), 0.92);
      this.territoryGraphics.lineStyle(Math.max(1, this.cellSize * 0.12), 0xff705c, alpha * (0.55 + pulse * 0.55));
      this.territoryGraphics.strokePoints(pressureOutline, true, true);
    }
  }

  private drawTerritoryMapOverlay(): void {
    const mapWidth = this.cellSize * GRID_WIDTH;
    const mapHeight = this.cellSize * GRID_HEIGHT;
    this.territoryGraphics.fillStyle(0x06100d, 0.54);
    this.territoryGraphics.fillRect(this.mapOffsetX, this.mapOffsetY, mapWidth, mapHeight);

    const visibleLabels = new Set<CreatureSpecies>();
    for (const territory of this.creatures.getPredatorTerritories()) {
      const center = this.gridToWorldCenter(territory);
      const radius = territory.radius * this.cellSize;
      const visualStyle = speciesVisual[territory.species] ?? speciesVisual.wolf;
      const conflict = Phaser.Math.Clamp(territory.pressure / 2.4, 0, 1);
      const alpha = Phaser.Math.Clamp(0.12 + territory.strength * 0.14, 0.12, 0.28);
      const pulse = 0.5 + Math.sin(this.time.now * 0.004 + territory.packId) * 0.5;
      const zocOutline = this.createTerritoryOutline(territory, territory.zocRadius);
      const coreOutline = this.createTerritoryOutline(territory, territory.radius);

      this.territoryGraphics.fillStyle(visualStyle.color, alpha * 0.18);
      this.territoryGraphics.fillPoints(zocOutline, true, true);
      this.territoryGraphics.lineStyle(Math.max(1, this.cellSize * 0.18), 0xf4ecd5, 0.2);
      this.territoryGraphics.strokePoints(zocOutline, true, true);
      this.territoryGraphics.fillStyle(visualStyle.color, alpha);
      this.territoryGraphics.fillPoints(coreOutline, true, true);
      this.territoryGraphics.lineStyle(Math.max(2, this.cellSize * 0.32), visualStyle.color, 0.72);
      this.territoryGraphics.strokePoints(coreOutline, true, true);
      this.territoryGraphics.lineStyle(Math.max(1, this.cellSize * 0.16), 0xf6efd8, 0.26);
      this.territoryGraphics.strokePoints(this.createTerritoryOutline(territory, territory.radius * 0.56, 0.74), true, true);
      this.territoryGraphics.fillStyle(visualStyle.color, 0.95);
      this.territoryGraphics.fillCircle(center.x, center.y, Math.max(4, this.cellSize * 0.7));

      if (conflict > 0.05) {
        const conflictOutline = this.createTerritoryOutline(territory, territory.radius * (0.92 + pulse * 0.05), 0.9);
        this.territoryGraphics.lineStyle(Math.max(1.5, this.cellSize * 0.22), 0xff624f, 0.35 + conflict * 0.5 * (0.75 + pulse * 0.25));
        this.territoryGraphics.strokePoints(conflictOutline, true, true);
      }

      visibleLabels.add(territory.species);
      this.updateTerritoryLabel(territory, center, radius);
    }
    this.hideTerritoryLabels(visibleLabels);
  }

  private drawTerritoryMapPredatorMarkers(): void {
    for (const creature of this.creatures.creatures) {
      if (creature.kind !== 'carnivore') {
        continue;
      }
      const center = this.gridToWorldCenter(creature);
      const visualStyle = speciesVisual[creature.species] ?? speciesVisual.wolf;
      const radius = Math.max(2.5, this.cellSize * (creature.species === 'fox' ? 0.45 : 0.58));
      this.territoryGraphics.fillStyle(0x070907, 0.7);
      this.territoryGraphics.fillCircle(center.x + radius * 0.28, center.y + radius * 0.28, radius * 1.12);
      this.territoryGraphics.fillStyle(visualStyle.color, 0.95);
      this.territoryGraphics.fillCircle(center.x, center.y, radius);
      this.territoryGraphics.lineStyle(Math.max(1, this.cellSize * 0.12), 0xf7f1d6, 0.58);
      this.territoryGraphics.strokeCircle(center.x, center.y, radius * 1.35);
    }
  }

  private createTerritoryOutline(territory: CreatureTerritory, radiusInCells: number, roughness = 1): Phaser.Geom.Point[] {
    const center = this.gridToWorldCenter(territory);
    const cacheKey = `${territory.species}:${territory.packId}:${radiusInCells.toFixed(2)}:${roughness.toFixed(2)}:${this.cellSize.toFixed(3)}`;
    let points = this.territoryOutlineCache.get(cacheKey);
    if (!points) {
      points = Array.from({ length: TERRITORY_OUTLINE_POINTS }, () => new Phaser.Geom.Point());
      this.territoryOutlineCache.set(cacheKey, points);
    }

    const members = this.creatures.creatures.filter((creature) => creature.species === territory.species);
    const radii = new Array<number>(TERRITORY_OUTLINE_POINTS);
    for (let i = 0; i < TERRITORY_OUTLINE_POINTS; i += 1) {
      const angle = (Math.PI * 2 * i) / TERRITORY_OUTLINE_POINTS;
      radii[i] = this.dynamicTerritoryRadius(territory, members, angle, radiusInCells, roughness);
    }
    this.smoothTerritoryRadii(radii);

    for (let i = 0; i < TERRITORY_OUTLINE_POINTS; i += 1) {
      const angle = (Math.PI * 2 * i) / TERRITORY_OUTLINE_POINTS;
      const radius = radii[i] * this.cellSize;
      points[i].x = center.x + Math.cos(angle) * radius;
      points[i].y = center.y + Math.sin(angle) * radius;
    }
    return points;
  }

  private dynamicTerritoryRadius(
    territory: CreatureTerritory,
    members: GridPosition[],
    angle: number,
    radiusInCells: number,
    roughness: number,
  ): number {
    const base = radiusInCells * this.territoryShapeFactor(territory, angle, roughness * 0.72);
    const zocExtra = Math.max(0, radiusInCells - territory.radius);
    const memberRadius = this.memberTerritoryRadiusAtAngle(territory, members, angle) + zocExtra;
    const pressurePush = territory.pressure > 0.42 ? Math.sin(angle * 2 + territory.packId) * 0.035 * territory.pressure : 0;
    const blended = Phaser.Math.Linear(base, Math.max(base * 0.72, memberRadius), 0.62);
    return Phaser.Math.Clamp(blended * (1 + pressurePush), radiusInCells * 0.62, radiusInCells * 1.28);
  }

  private memberTerritoryRadiusAtAngle(territory: CreatureTerritory, members: GridPosition[], angle: number): number {
    if (members.length === 0) {
      return territory.radius * 0.72;
    }

    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const lateralWidth = Math.max(2.5, territory.radius * 0.34);
    let envelope = territory.radius * 0.52;

    for (const member of members) {
      const mx = member.x - territory.x;
      const my = member.y - territory.y;
      const projection = mx * dx + my * dy;
      const lateral = Math.abs(mx * -dy + my * dx);
      if (projection < -lateralWidth * 0.4 || lateral > lateralWidth * 1.35) {
        continue;
      }

      const lateralWeight = Phaser.Math.Clamp(1 - lateral / (lateralWidth * 1.35), 0, 1);
      const individualInfluence = lateralWidth * (0.42 + lateralWeight * 0.5);
      envelope = Math.max(envelope, projection + individualInfluence);
    }

    return Phaser.Math.Clamp(envelope, territory.radius * 0.45, territory.radius * 1.2);
  }

  private smoothTerritoryRadii(radii: number[]): void {
    const original = [...radii];
    for (let i = 0; i < radii.length; i += 1) {
      const previous = original[(i - 1 + original.length) % original.length];
      const current = original[i];
      const next = original[(i + 1) % original.length];
      radii[i] = previous * 0.24 + current * 0.52 + next * 0.24;
    }
  }

  private territoryShapeFactor(territory: CreatureTerritory, angle: number, roughness: number): number {
    const seed = this.territoryShapeSeed(territory.species) + territory.packId * 0.173;
    const wave =
      Math.sin(angle * 3 + seed) * 0.14 +
      Math.cos(angle * 5 - seed * 0.7) * 0.09 +
      Math.sin(angle * 2 + seed * 1.9) * 0.07;
    return Phaser.Math.Clamp(1 + wave * roughness, 0.76, 1.24);
  }

  private territoryShapeSeed(species: CreatureSpecies): number {
    switch (species) {
      case 'wolf':
        return 1.2;
      case 'fox':
        return 3.7;
      case 'bear':
        return 5.3;
      case 'vulture':
        return 6.9;
      case 'lynx':
        return 7.6;
      case 'panther':
        return 8.7;
      case 'boar':
        return 8.1;
      case 'deer':
        return 9.4;
      case 'hare':
      default:
        return 10.8;
    }
  }

  private updateTerritoryLabel(territory: CreatureTerritory, center: GridPosition, radius: number): void {
    let label = this.territoryLabels.get(territory.species);
    if (!label) {
      label = this.add.text(0, 0, '', {
        align: 'center',
        color: '#f8f1dc',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        fontStyle: '700',
      });
      label.setOrigin(0.5);
      label.setDepth(8);
      label.setVisible(false);
      this.territoryLabels.set(territory.species, label);
    }

    const fontSize = Math.round(Phaser.Math.Clamp(this.cellSize * 2.65, 12, 18));
    label.setText(speciesLabel[territory.species]);
    label.setFontSize(fontSize);
    label.setStroke('#06100d', Math.max(3, Math.round(fontSize * 0.22)));
    label.setBackgroundColor('rgba(6, 16, 13, 0.56)');
    label.setPadding(Math.max(5, Math.round(fontSize * 0.34)), 3, Math.max(5, Math.round(fontSize * 0.34)), 3);
    label.setPosition(center.x, center.y - radius * 0.08);
    label.setVisible(true);
  }

  private hideTerritoryLabels(visibleSpecies = new Set<CreatureSpecies>()): void {
    for (const [species, label] of this.territoryLabels) {
      if (!visibleSpecies.has(species)) {
        label.setVisible(false);
      }
    }
  }

  private drawCreatures(dt: number): void {
    this.creatureSpritesVisible = true;
    const follow = dt <= 0 ? 1 : 1 - Math.exp(-dt * 8.5);
    const aliveIds = new Set<number>();

    for (const creature of this.creatures.creatures) {
      const target = this.gridToWorldCenter(creature);
      let visual = this.creatureVisuals.get(creature.id);
      if (!visual) {
        visual = {
          x: target.x,
          y: target.y,
          animationSeed: Phaser.Math.FloatBetween(0, Math.PI * 2),
          facingLeft: false,
        };
        this.creatureVisuals.set(creature.id, visual);
      }

      const dx = target.x - visual.x;
      const dy = target.y - visual.y;
      const distance = Math.hypot(dx, dy);
      const previousX = visual.x;
      const previousY = visual.y;
      const snapDistance = Math.max(0.25, this.cellSize * 0.035);
      if (distance <= snapDistance) {
        visual.x = target.x;
        visual.y = target.y;
      } else if (distance > this.cellSize * 5) {
        visual.x = target.x;
        visual.y = target.y;
      } else {
        visual.x = Phaser.Math.Linear(visual.x, target.x, follow);
        visual.y = Phaser.Math.Linear(visual.y, target.y, follow);
      }
      const frameMove = Math.hypot(visual.x - previousX, visual.y - previousY);
      if (Math.abs(dx) > this.cellSize * 0.025) {
        visual.facingLeft = dx < 0;
      }

      const visualStyle = speciesVisual[creature.species] ?? speciesVisual.deer;
      const spriteSize = Math.max(22, this.cellSize * visualStyle.size);
      const gaitSpeed = visualStyle.gait;
      const isMoving = distance > this.cellSize * 0.08 || frameMove > 0.12;
      const motionFrame = isMoving
        ? Math.floor((this.time.now * 0.001 * gaitSpeed + visual.animationSeed) % CREATURE_MOTION_FRAMES)
        : 0;
      const frameOffset = visualStyle.frameOffset;
      const renderX = visual.x;
      const renderY = visual.y;

      const showSickness = creature.sickness > 0.38;
      if (showSickness) {
        const sicknessGlow = this.getCreatureEffectSprite(this.creatureSicknessGlows, creature.id, 'effects', effectFrame.sickness, 4.2);
        sicknessGlow.setVisible(true);
        sicknessGlow.setPosition(renderX, renderY - spriteSize * 0.18);
        sicknessGlow.setDisplaySize(spriteSize * 0.52, spriteSize * 0.52);
        sicknessGlow.setAlpha(Phaser.Math.Clamp((creature.sickness - 0.28) * 0.7, 0.1, 0.3));
      } else {
        this.creatureSicknessGlows.get(creature.id)?.setVisible(false);
      }

      const showAlert = creature.state === 'fleeing';
      if (showAlert) {
        const alertRing = this.getCreatureEffectSprite(this.creatureAlertRings, creature.id, 'effects', effectFrame.alert, 4.25);
        alertRing.setVisible(true);
        alertRing.setPosition(renderX, renderY);
        alertRing.setDisplaySize(spriteSize * 0.62, spriteSize * 0.62);
        alertRing.setAlpha(0.24);
      } else {
        this.creatureAlertRings.get(creature.id)?.setVisible(false);
      }

      let sprite = this.creatureSprites.get(creature.id);
      if (!sprite) {
        const textureKey = visual.facingLeft ? 'creatures-left' : 'creatures';
        sprite = this.add.image(renderX, renderY, textureKey, frameOffset + motionFrame);
        sprite.setDepth(4);
        this.creatureSprites.set(creature.id, sprite);
      }

      sprite.setVisible(true);
      const textureKey = visual.facingLeft ? 'creatures-left' : 'creatures';
      const frame = frameOffset + motionFrame;
      if (sprite.texture.key !== textureKey) {
        sprite.setTexture(textureKey, frame);
      } else if (sprite.frame.name !== String(frame)) {
        sprite.setFrame(frame);
      }
      sprite.setPosition(renderX, renderY);
      sprite.setDisplaySize(spriteSize, spriteSize);
      sprite.setFlipX(false);
      sprite.setRotation(0);
      sprite.setAlpha(Phaser.Math.Clamp(0.62 + creature.energy * 0.3 - creature.sickness * 0.14, 0.48, 1));
      if (creature.sickness > 0.48) {
        sprite.setTint(0xc7eaa1);
      } else if (creature.stress > 0.7 || creature.energy < 0.24) {
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
        this.destroyCreatureEffectSprite(this.creatureSicknessGlows, id);
        this.destroyCreatureEffectSprite(this.creatureAlertRings, id);
        this.creatureVisuals.delete(id);
      }
    }
  }

  private getCreatureEffectSprite(
    store: Map<number, Phaser.GameObjects.Image>,
    id: number,
    textureKey: string,
    frame: number,
    depth: number,
  ): Phaser.GameObjects.Image {
    let sprite = store.get(id);
    if (!sprite) {
      sprite = this.add.image(0, 0, textureKey, frame);
      sprite.setDepth(depth);
      store.set(id, sprite);
    } else if (sprite.frame.name !== String(frame)) {
      sprite.setFrame(frame);
    }
    return sprite;
  }

  private destroyCreatureEffectSprite(store: Map<number, Phaser.GameObjects.Image>, id: number): void {
    const sprite = store.get(id);
    if (sprite) {
      sprite.destroy();
      store.delete(id);
    }
  }

  private hideCreatureSprites(): void {
    if (!this.creatureSpritesVisible) {
      return;
    }
    this.creatureSpritesVisible = false;
    for (const sprite of this.creatureSprites.values()) {
      sprite.setVisible(false);
    }
    for (const sprite of this.creatureSicknessGlows.values()) {
      sprite.setVisible(false);
    }
    for (const sprite of this.creatureAlertRings.values()) {
      sprite.setVisible(false);
    }
  }

  private drawCorpses(): void {
    const aliveIds = new Set<number>();
    for (const corpse of this.creatures.corpses) {
      const cx = this.mapOffsetX + corpse.x * this.cellSize + this.cellSize / 2;
      const cy = this.mapOffsetY + corpse.y * this.cellSize + this.cellSize / 2;
      const ageAlpha = Phaser.Math.Clamp(0.2 + corpse.nutrientsLeft * 0.8, 0.16, 0.9);
      let sprite = this.corpseSprites.get(corpse.id);
      if (!sprite) {
        sprite = this.add.image(cx, cy, 'effects', effectFrame.corpse);
        sprite.setDepth(3.45);
        this.corpseSprites.set(corpse.id, sprite);
      }
      sprite.setVisible(true);
      sprite.setPosition(cx, cy);
      sprite.setDisplaySize(this.cellSize * 4.2, this.cellSize * 3.2);
      sprite.setAlpha(ageAlpha);
      if (corpse.decay > 5) {
        sprite.setTint(0xb8d98b);
      } else {
        sprite.clearTint();
      }
      aliveIds.add(corpse.id);
    }

    for (const [id, sprite] of this.corpseSprites) {
      if (!aliveIds.has(id)) {
        sprite.destroy();
        this.corpseSprites.delete(id);
      }
    }
  }

  private hideCorpseSprites(): void {
    for (const sprite of this.corpseSprites.values()) {
      sprite.setVisible(false);
    }
  }
}
