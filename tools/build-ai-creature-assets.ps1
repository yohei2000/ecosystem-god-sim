param(
  [string]$OutDir = (Join-Path $PSScriptRoot '..\src\assets'),
  [string]$CreatureSource = (Join-Path $PSScriptRoot '..\src\assets\ai-creature-source.png'),
  [string]$EffectSource = (Join-Path $PSScriptRoot '..\src\assets\ai-effect-source.png')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$source = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public static class AiCreatureAssetBuilder
{
    private const int CreatureFrame = 192;
    private const int CreatureFrames = 4;
    private const int CreatureRows = 9;
    private const int EffectFrame = 256;
    private const int EffectRows = 3;
    private const int EffectCols = 3;

    public static void Generate(string creatureSourcePath, string effectSourcePath, string outDir)
    {
        if (!File.Exists(creatureSourcePath))
        {
            throw new FileNotFoundException("Missing AI creature source image", creatureSourcePath);
        }
        if (!File.Exists(effectSourcePath))
        {
            throw new FileNotFoundException("Missing AI effect source image", effectSourcePath);
        }

        Directory.CreateDirectory(outDir);
        using (var creatureSource = new Bitmap(creatureSourcePath))
        using (var effectSource = new Bitmap(effectSourcePath))
        {
            BuildCreatureAtlas(creatureSource, Path.Combine(outDir, "creature-atlas.png"));
            BuildEffectAtlas(effectSource, Path.Combine(outDir, "effect-atlas.png"));
        }
    }

    private static void BuildCreatureAtlas(Bitmap source, string path)
    {
        using (var atlas = new Bitmap(CreatureFrame * CreatureFrames, CreatureFrame * CreatureRows, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(atlas))
        {
            Configure(g);
            g.Clear(Color.Transparent);
            Rectangle[] crops = CreatureCrops(source.Width, source.Height);
            for (int row = 0; row < CreatureRows; row++)
            {
                using (var sprite = ExtractSprite(source, crops[row], 62, 58, true))
                {
                    for (int frame = 0; frame < CreatureFrames; frame++)
                    {
                        DrawCreatureFrame(g, sprite, row, frame);
                    }
                }
            }
            atlas.Save(path, ImageFormat.Png);
        }
    }

    private static void BuildEffectAtlas(Bitmap source, string path)
    {
        using (var atlas = new Bitmap(EffectFrame * EffectCols, EffectFrame * EffectRows, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(atlas))
        {
            Configure(g);
            g.Clear(Color.Transparent);
            for (int row = 0; row < EffectRows; row++)
            {
                for (int col = 0; col < EffectCols; col++)
                {
                    int index = row * EffectCols + col;
                    int tolerance = (index == 4 || index == 6) ? 32 : 54;
                    using (var sprite = ExtractSprite(source, col, row, EffectCols, EffectRows, tolerance, 26, false))
                    {
                        DrawEffectFrame(g, sprite, col, row, index);
                    }
                }
            }
            atlas.Save(path, ImageFormat.Png);
        }
    }

    private static Bitmap ExtractSprite(Bitmap source, int col, int row, int cols, int rows, int chromaTolerance, int softRange, bool keepLargestComponent)
    {
        int cellW = source.Width / cols;
        int cellH = source.Height / rows;
        return ExtractSprite(source, new Rectangle(col * cellW, row * cellH, cellW, cellH), chromaTolerance, softRange, keepLargestComponent);
    }

    private static Bitmap ExtractSprite(Bitmap source, Rectangle cropRect, int chromaTolerance, int softRange, bool keepLargestComponent)
    {
        cropRect.Intersect(new Rectangle(0, 0, source.Width, source.Height));
        int cellW = cropRect.Width;
        int cellH = cropRect.Height;
        using (var keyed = new Bitmap(cellW, cellH, PixelFormat.Format32bppArgb))
        {
            for (int y = 0; y < cellH; y++)
            {
                for (int x = 0; x < cellW; x++)
                {
                    Color c = source.GetPixel(cropRect.X + x, cropRect.Y + y);
                    double distance = ChromaDistance(c);
                    if (distance <= chromaTolerance || (c.G > 235 && c.R < 60 && c.B < 60))
                    {
                        keyed.SetPixel(x, y, Color.Transparent);
                    }
                    else
                    {
                        Color cleaned = DespillGreen(c);
                        if (distance <= chromaTolerance + softRange)
                        {
                            int alpha = (int)Math.Max(0, Math.Min(255, c.A * ((distance - chromaTolerance) / Math.Max(1.0, softRange))));
                            cleaned = Color.FromArgb(alpha, cleaned.R, cleaned.G, cleaned.B);
                        }
                        keyed.SetPixel(x, y, cleaned);
                    }
                }
            }

            if (keepLargestComponent)
            {
                KeepLargestOpaqueComponent(keyed);
            }

            Rectangle bounds = FindOpaqueBounds(keyed);
            bounds.Inflate(8, 8);
            bounds.Intersect(new Rectangle(0, 0, keyed.Width, keyed.Height));
            var sprite = new Bitmap(Math.Max(1, bounds.Width), Math.Max(1, bounds.Height), PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(sprite))
            {
                Configure(g);
                g.Clear(Color.Transparent);
                g.DrawImage(keyed, new Rectangle(0, 0, sprite.Width, sprite.Height), bounds, GraphicsUnit.Pixel);
            }
            return sprite;
        }
    }

    private static void KeepLargestOpaqueComponent(Bitmap bmp)
    {
        int width = bmp.Width;
        int height = bmp.Height;
        bool[] seen = new bool[width * height];
        int[] queueX = new int[width * height];
        int[] queueY = new int[width * height];
        int[] component = new int[width * height];
        int largestCount = 0;
        bool[] keep = new bool[width * height];

        for (int y = 0; y < height; y++)
        {
            for (int x = 0; x < width; x++)
            {
                int start = y * width + x;
                if (seen[start] || bmp.GetPixel(x, y).A <= 12)
                {
                    seen[start] = true;
                    continue;
                }

                int head = 0;
                int tail = 0;
                int count = 0;
                queueX[tail] = x;
                queueY[tail] = y;
                tail++;
                seen[start] = true;

                while (head < tail)
                {
                    int cx = queueX[head];
                    int cy = queueY[head];
                    head++;
                    int ci = cy * width + cx;
                    component[count++] = ci;

                    for (int oy = -1; oy <= 1; oy++)
                    {
                        for (int ox = -1; ox <= 1; ox++)
                        {
                            if (ox == 0 && oy == 0) continue;
                            int nx = cx + ox;
                            int ny = cy + oy;
                            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                            int ni = ny * width + nx;
                            if (seen[ni]) continue;
                            seen[ni] = true;
                            if (bmp.GetPixel(nx, ny).A <= 12) continue;
                            queueX[tail] = nx;
                            queueY[tail] = ny;
                            tail++;
                        }
                    }
                }

                if (count > largestCount)
                {
                    Array.Clear(keep, 0, keep.Length);
                    for (int i = 0; i < count; i++)
                    {
                        keep[component[i]] = true;
                    }
                    largestCount = count;
                }
            }
        }

        if (largestCount <= 0)
        {
            return;
        }

        for (int y = 0; y < height; y++)
        {
            for (int x = 0; x < width; x++)
            {
                int index = y * width + x;
                if (!keep[index])
                {
                    bmp.SetPixel(x, y, Color.Transparent);
                }
            }
        }
    }

    private static Rectangle[] CreatureCrops(int width, int height)
    {
        double sx = width / 1254.0;
        double sy = height / 1254.0;
        return new Rectangle[]
        {
            ScaleRect(0, 92, 378, 326, sx, sy),     // hare
            ScaleRect(392, 0, 452, 426, sx, sy),    // deer
            ScaleRect(824, 108, 430, 312, sx, sy),  // boar
            ScaleRect(0, 492, 420, 326, sx, sy),    // wolf
            ScaleRect(394, 518, 418, 304, sx, sy),  // fox
            ScaleRect(784, 486, 470, 344, sx, sy),  // bear
            ScaleRect(0, 854, 388, 378, sx, sy),    // vulture
            ScaleRect(402, 862, 438, 354, sx, sy),  // lynx
            ScaleRect(790, 868, 464, 348, sx, sy),  // panther
        };
    }

    private static Rectangle ScaleRect(int x, int y, int w, int h, double sx, double sy)
    {
        return new Rectangle(
            (int)Math.Round(x * sx),
            (int)Math.Round(y * sy),
            (int)Math.Round(w * sx),
            (int)Math.Round(h * sy)
        );
    }

    private static void DrawCreatureFrame(Graphics g, Bitmap sprite, int row, int frame)
    {
        float x = frame * CreatureFrame;
        float y = row * CreatureFrame;
        float maxW = CreatureFrame * CreatureWidthScale(row);
        float maxH = CreatureFrame * CreatureHeightScale(row);
        float scale = Math.Min(maxW / sprite.Width, maxH / sprite.Height);
        float w = sprite.Width * scale;
        float h = sprite.Height * scale;
        float baseX = x + (CreatureFrame - w) * 0.5f;
        float baseY = y + CreatureFrame * CreatureGround(row) - h;
        float legCut = sprite.Height * 0.60f;
        float[] shifts = new float[] { 0f, -2.8f, 1.8f, 2.8f };
        float legShift = shifts[frame] * Math.Max(0.75f, scale);

        using (var pose = new Bitmap(CreatureFrame, CreatureFrame, PixelFormat.Format32bppArgb))
        using (var pg = Graphics.FromImage(pose))
        {
            Configure(pg);
            pg.Clear(Color.Transparent);

            var upperSrc = new RectangleF(0, 0, sprite.Width, legCut);
            var upperDst = new RectangleF((CreatureFrame - w) * 0.5f, CreatureFrame * CreatureGround(row) - h, w, legCut * scale);
            pg.DrawImage(sprite, upperDst, upperSrc, GraphicsUnit.Pixel);

            var lowerSrc = new RectangleF(0, legCut, sprite.Width, sprite.Height - legCut);
            var lowerDst = new RectangleF((CreatureFrame - w) * 0.5f + legShift, CreatureFrame * CreatureGround(row) - h + legCut * scale, w, (sprite.Height - legCut) * scale);
            pg.DrawImage(sprite, lowerDst, lowerSrc, GraphicsUnit.Pixel);

            AddGroundShadow(pg, row);
            g.DrawImage(pose, x, y, CreatureFrame, CreatureFrame);
        }
    }

    private static void DrawEffectFrame(Graphics g, Bitmap sprite, int col, int row, int index)
    {
        float max = EffectFrame * EffectScale(index);
        float scale = Math.Min(max / sprite.Width, max / sprite.Height);
        float w = sprite.Width * scale;
        float h = sprite.Height * scale;
        float x = col * EffectFrame + (EffectFrame - w) * 0.5f;
        float y = row * EffectFrame + (EffectFrame - h) * 0.5f;
        if (index == 5)
        {
            y += EffectFrame * 0.07f;
        }
        g.DrawImage(sprite, x, y, w, h);
    }

    private static float CreatureWidthScale(int row)
    {
        switch (row)
        {
            case 0: return 0.78f; // hare
            case 1: return 0.92f; // deer
            case 2: return 0.90f; // boar
            case 3: return 0.94f; // wolf
            case 4: return 0.82f; // fox
            case 5: return 0.96f; // bear
            case 6: return 0.74f; // vulture
            case 7: return 0.90f; // lynx
            case 8: return 0.92f; // panther
            default: return 0.88f;
        }
    }

    private static float CreatureHeightScale(int row)
    {
        switch (row)
        {
            case 1: return 0.84f;
            case 5: return 0.92f;
            case 6: return 0.88f;
            default: return 0.78f;
        }
    }

    private static float CreatureGround(int row)
    {
        switch (row)
        {
            case 0: return 0.78f;
            case 1: return 0.84f;
            case 5: return 0.86f;
            case 6: return 0.88f;
            default: return 0.82f;
        }
    }

    private static float EffectScale(int index)
    {
        switch (index)
        {
            case 0: return 0.90f;
            case 1: return 0.96f;
            case 2: return 0.92f;
            case 3: return 0.84f;
            case 4: return 0.88f;
            case 5: return 0.88f;
            case 6: return 0.86f;
            case 7: return 0.84f;
            case 8: return 0.92f;
            default: return 0.9f;
        }
    }

    private static void AddGroundShadow(Graphics g, int row)
    {
        float y = CreatureFrame * CreatureGround(row) + 2;
        float w = CreatureFrame * (row == 0 || row == 6 ? 0.48f : 0.62f);
        float h = CreatureFrame * 0.08f;
        using (var brush = new SolidBrush(Color.FromArgb(38, 0, 0, 0)))
        {
            g.FillEllipse(brush, (CreatureFrame - w) * 0.5f, y - h * 0.5f, w, h);
        }
    }

    private static double ChromaDistance(Color c)
    {
        int dr = c.R;
        int dg = 255 - c.G;
        int db = c.B;
        return Math.Sqrt(dr * dr + dg * dg + db * db);
    }

    private static Color DespillGreen(Color c)
    {
        if (c.G > c.R * 1.35 && c.G > c.B * 1.35)
        {
            int maxOther = Math.Max(c.R, c.B);
            int green = Math.Max(maxOther + 24, (int)(c.G * 0.72));
            return Color.FromArgb(c.A, c.R, Math.Min(255, green), c.B);
        }
        return c;
    }

    private static Rectangle FindOpaqueBounds(Bitmap bmp)
    {
        int minX = bmp.Width;
        int minY = bmp.Height;
        int maxX = -1;
        int maxY = -1;
        for (int y = 0; y < bmp.Height; y++)
        {
            for (int x = 0; x < bmp.Width; x++)
            {
                if (bmp.GetPixel(x, y).A <= 8) continue;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
        if (maxX < minX || maxY < minY)
        {
            return new Rectangle(0, 0, bmp.Width, bmp.Height);
        }
        return Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1);
    }

    private static void Configure(Graphics g)
    {
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.CompositingQuality = CompositingQuality.HighQuality;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
    }
}
"@

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition $source

$resolvedOutDir = Resolve-Path -LiteralPath $OutDir -ErrorAction SilentlyContinue
if (-not $resolvedOutDir) {
  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  $resolvedOutDir = Resolve-Path -LiteralPath $OutDir
}

[AiCreatureAssetBuilder]::Generate(
  (Resolve-Path -LiteralPath $CreatureSource),
  (Resolve-Path -LiteralPath $EffectSource),
  $resolvedOutDir
)

Write-Host "Generated AI creature and effect assets in $resolvedOutDir"
