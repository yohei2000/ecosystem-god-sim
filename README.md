# Ecosystem God Sim

Phaser 3 + TypeScript + Vite で作った、スマホブラウザ対応の神視点・箱庭生態系シミュレーターです。

公開URL: https://yohei2000.github.io/ecosystem-god-sim/

## Features

- 2D見下ろし型のグリッドマップ
- 草原、森、水辺、荒地、山、クレーターを持つ地形
- 各セルに `grass`, `water`, `nutrient`, `heat`, `ash`, `fungus`, `toxicity` を保持
- 草、腐敗、灰、栄養、天候が相互作用する環境シミュレーション
- 草食、肉食、雑食、腐肉食の複数種による捕食・繁殖・病気・縄張り
- 肉食動物の縄張りマップ表示
- 隕石、雨、太陽、種追加の神の力
- AI生成画像ソースから作成した高精細な地形、動物、エフェクトアセット

## Local Setup

```bash
npm install
npm run dev
```

`npm run dev` のあと、表示されたローカルURLをブラウザで開きます。

Windows PowerShell で `npm` が実行ポリシーに止められる場合は、以下のように `npm.cmd` を使ってください。

```bash
npm.cmd install
npm.cmd run dev
```

## Build

```bash
npm run build
```

成功すると `dist/` に本番ビルドが生成されます。

## Asset Generation

AI生成画像ソースは `src/assets/ai-*-source.png` に保存しています。

地形アセットを再生成する場合:

```bash
powershell -ExecutionPolicy Bypass -File tools/build-ai-terrain-assets.ps1
```

動物・エフェクトアセットを再生成する場合:

```bash
powershell -ExecutionPolicy Bypass -File tools/build-ai-creature-assets.ps1
```

## GitHub Pages Deployment

このプロジェクトは GitHub Actions から GitHub Pages にデプロイします。

- `vite.config.ts` の `base` は `/ecosystem-god-sim/` に設定済みです。
- `.github/workflows/deploy.yml` は `main` ブランチへの push で `npm ci` → `npm run build` → GitHub Pages へのデプロイを実行します。
- GitHub リポジトリ側の Settings > Pages で Source を `GitHub Actions` に設定する必要があります。

## Git Commands

```bash
git init
git add .
git commit -m "Initial ecosystem god sim"
git branch -M main
git remote add origin https://github.com/<YOUR_USER_NAME>/ecosystem-god-sim.git
git push -u origin main
```

このリポジトリの実際の remote 例:

```bash
git remote add origin https://github.com/yohei2000/ecosystem-god-sim.git
```
