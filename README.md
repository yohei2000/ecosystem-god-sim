# Ecosystem God Sim

Phaser 3 + TypeScript + Vite で作った、スマホブラウザ向けの神視点・箱庭生態系シミュレーターです。

## Features

- 2D 見下ろし型グリッドマップ
- 草原、森、水辺、荒地、クレーターの地形
- 各セルに `grass`, `water`, `nutrient`, `heat`, `ash` を保持
- 草、水、栄養、熱、灰が時間経過で相互作用
- 草食動物は草を探して移動し、捕食で energy を回復
- 肉食動物は草食動物を追跡し、捕食で energy を回復
- energy が 0 になると死体化し、分解で周囲の nutrient を増加
- energy が十分高い生物は繁殖
- 画面タップ位置に「隕石」「雨」「太陽」「種追加」を発動
- 草量、草食動物数、肉食動物数、生態系安定度、イベントログを表示
- 外部画像アセットなしの Canvas / Phaser Graphics 描画

## Local Setup

```bash
npm install
npm run dev
```

`npm run dev` のあと、表示されたローカル URL をブラウザで開きます。

## Build

```bash
npm run build
```

成功すると `dist/` に本番ビルドが生成されます。

## GitHub Pages Deployment

このプロジェクトは GitHub Actions から GitHub Pages にデプロイする構成です。

- `vite.config.ts` の `base` は `/ecosystem-god-sim/` に設定済みです。
- `.github/workflows/deploy.yml` は `main` ブランチへの push で `npm ci`、`npm run build`、GitHub Pages へのデプロイを実行します。
- GitHub リポジトリ側の Settings > Pages で、Source を `GitHub Actions` に設定してください。

## Git Commands

```bash
git init
git add .
git commit -m "Initial ecosystem god sim"
git branch -M main
git remote add origin https://github.com/yohei2000/ecosystem-god-sim.git
git push -u origin main
```
