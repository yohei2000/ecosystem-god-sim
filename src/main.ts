import * as Phaser from 'phaser';
import { WorldScene } from './scenes/WorldScene';
import './style.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#101810',
  pixelArt: false,
  fps: {
    target: 60,
    min: 30,
    smoothStep: true,
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [WorldScene],
};

new Phaser.Game(config);
