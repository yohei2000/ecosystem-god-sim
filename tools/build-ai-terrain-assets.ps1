param(
  [string]$OutDir = (Join-Path $PSScriptRoot '..\src\assets')
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

public static class AiTerrainAssetBuilder
{
    private const int Tile = 128;
    private const int Stamp = 512;
    private static readonly Random Rng = new Random(20260621);

    public static void Build(string outDir)
    {
        Directory.CreateDirectory(outDir);
        string sourcePath = Path.Combine(outDir, "ai-terrain-source.png");
        if (!File.Exists(sourcePath))
        {
            throw new FileNotFoundException("Missing AI terrain source image", sourcePath);
        }

        using (var source = new Bitmap(sourcePath))
        {
            DrawTerrainAtlas(source, Path.Combine(outDir, "terrain-atlas.png"));
            DrawTerrainStamps(source, Path.Combine(outDir, "terrain-stamps.png"));
        }
    }

    private static void DrawTerrainAtlas(Bitmap source, string path)
    {
        using (var atlas = new Bitmap(Tile * 4, Tile * 2, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(atlas))
        {
            Configure(g);
            PaintTile(g, source, 0, 0, Crop("grass"), C(72, 133, 50, 92));
            PaintTile(g, source, 1, 0, Crop("forest"), C(14, 83, 33, 116));
            PaintTile(g, source, 2, 0, Crop("water"), C(18, 134, 190, 132));
            PaintTile(g, source, 3, 0, Crop("wasteland"), C(128, 88, 46, 176));
            PaintTile(g, source, 0, 1, Crop("craterDirt"), C(75, 58, 48, 196));
            PaintTile(g, source, 1, 1, Crop("mountain"), C(86, 93, 88, 124));
            PaintTile(g, source, 2, 1, Crop("ash"), C(53, 51, 47, 170));
            PaintTile(g, source, 3, 1, Crop("meadow"), C(97, 158, 48, 96));
            AddAtlasDetails(g);
            atlas.Save(path, ImageFormat.Png);
        }
    }

    private static void DrawTerrainStamps(Bitmap source, string path)
    {
        using (var sheet = new Bitmap(Stamp * 5, Stamp, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(sheet))
        {
            Configure(g);
            g.Clear(Color.Transparent);
            PaintStamp(sheet, g, source, 0, "forest", Crop("forest"), C(14, 88, 34, 98));
            PaintStamp(sheet, g, source, 1, "mountain", Crop("mountain"), C(82, 91, 88, 118));
            PaintStamp(sheet, g, source, 2, "lake", Crop("water"), C(22, 142, 199, 146));
            PaintStamp(sheet, g, source, 3, "wasteland", Crop("wasteland"), C(133, 89, 45, 186));
            PaintStamp(sheet, g, source, 4, "crater", Crop("craterDirt"), C(98, 70, 48, 205));
            AddStampDetails(g);
            sheet.Save(path, ImageFormat.Png);
        }
    }

    private static Rectangle Crop(string name)
    {
        switch (name)
        {
            case "grass": return new Rectangle(1240, 628, 360, 230);
            case "meadow": return new Rectangle(1080, 590, 360, 220);
            case "forest": return new Rectangle(0, 704, 430, 224);
            case "water": return new Rectangle(0, 346, 330, 180);
            case "mountain": return new Rectangle(0, 150, 500, 230);
            case "wasteland": return new Rectangle(570, 564, 370, 170);
            case "craterDirt": return new Rectangle(620, 554, 360, 180);
            case "ash": return new Rectangle(1318, 346, 250, 210);
            default: return new Rectangle(0, 0, 512, 512);
        }
    }

    private static void PaintTile(Graphics g, Bitmap source, int col, int row, Rectangle crop, Color overlay)
    {
        var dest = new Rectangle(col * Tile, row * Tile, Tile, Tile);
        g.DrawImage(source, dest, crop, GraphicsUnit.Pixel);
        using (var b = new SolidBrush(overlay))
        {
            g.FillRectangle(b, dest);
        }
        using (var b = new SolidBrush(C(0, 0, 0, 32)))
        {
            g.FillRectangle(b, dest.X, dest.Y + Tile * .58f, Tile, Tile * .42f);
        }
    }

    private static void PaintStamp(Bitmap sheet, Graphics sheetGraphics, Bitmap source, int col, string type, Rectangle crop, Color overlay)
    {
        using (var temp = new Bitmap(Stamp, Stamp, PixelFormat.Format32bppArgb))
        using (var tg = Graphics.FromImage(temp))
        {
            Configure(tg);
            tg.Clear(Color.Transparent);
            tg.DrawImage(source, new Rectangle(0, 0, Stamp, Stamp), crop, GraphicsUnit.Pixel);
            using (var b = new SolidBrush(overlay))
            {
                tg.FillRectangle(b, 0, 0, Stamp, Stamp);
            }
            AddTypeTexture(tg, type);
            ApplyOrganicMask(temp, type);
            sheetGraphics.DrawImage(temp, col * Stamp, 0, Stamp, Stamp);
        }
    }

    private static void AddTypeTexture(Graphics g, string type)
    {
        if (type == "lake")
        {
            using (var p = new Pen(C(218, 247, 251, 116), 3.2f))
            {
                p.StartCap = LineCap.Round;
                p.EndCap = LineCap.Round;
                for (int i = 0; i < 26; i++)
                {
                    float x = Rand(72, 372);
                    float y = Rand(136, 360);
                    float len = Rand(34, 96);
                    g.DrawBezier(p, x, y, x + len * .22f, y - Rand(5, 13), x + len * .68f, y + Rand(4, 12), x + len, y + Rand(-4, 5));
                }
            }
            return;
        }

        if (type == "mountain")
        {
            using (var dark = new Pen(C(29, 35, 34, 130), 4.2f))
            using (var light = new Pen(C(229, 232, 222, 94), 3f))
            {
                dark.StartCap = dark.EndCap = LineCap.Round;
                light.StartCap = light.EndCap = LineCap.Round;
                for (int i = 0; i < 24; i++)
                {
                    float x = Rand(84, 432);
                    float y = Rand(128, 392);
                    float sx = Rand(-44, 44);
                    float sy = Rand(-86, -28);
                    g.DrawLine(dark, x, y, x + sx, y + sy);
                    if (i % 2 == 0) g.DrawLine(light, x + Rand(-8, 8), y + Rand(-8, 8), x + sx * .56f, y + sy * .56f);
                }
            }
            return;
        }

        if (type == "wasteland")
        {
            using (var p = new Pen(C(48, 34, 24, 158), 4.8f))
            {
                p.StartCap = p.EndCap = LineCap.Round;
                for (int i = 0; i < 42; i++)
                {
                    float x = Rand(72, 438);
                    float y = Rand(110, 404);
                    g.DrawLine(p, x, y, x + Rand(-66, 66), y + Rand(18, 68));
                    g.DrawLine(p, x, y, x + Rand(-46, 46), y + Rand(-56, -10));
                }
            }
            return;
        }

        if (type == "crater")
        {
            using (var ring = new SolidBrush(C(29, 23, 20, 168)))
            using (var glow = new SolidBrush(C(211, 90, 40, 86)))
            {
                g.FillEllipse(ring, 112, 112, 296, 250);
                g.FillEllipse(new SolidBrush(C(10, 10, 9, 218)), 158, 158, 204, 156);
                g.FillEllipse(glow, 210, 208, 92, 46);
            }
            using (var p = new Pen(C(25, 21, 19, 145), 4.4f))
            {
                p.StartCap = p.EndCap = LineCap.Round;
                for (int i = 0; i < 42; i++)
                {
                    double a = i * Math.PI * 2 / 42.0 + Rand(-.1f, .1f);
                    float x1 = 256 + (float)Math.Cos(a) * Rand(126, 156);
                    float y1 = 238 + (float)Math.Sin(a) * Rand(98, 130);
                    float x2 = 256 + (float)Math.Cos(a) * Rand(170, 228);
                    float y2 = 238 + (float)Math.Sin(a) * Rand(142, 208);
                    g.DrawLine(p, x1, y1, x2, y2);
                }
            }
            return;
        }

        using (var b = new SolidBrush(C(5, 27, 14, 70)))
        {
            for (int i = 0; i < 360; i++)
            {
                float s = Rand(3, 12);
                g.FillEllipse(b, Rand(46, 466), Rand(72, 440), s, s * Rand(.5f, 1.2f));
            }
        }
    }

    private static void ApplyOrganicMask(Bitmap bmp, string type)
    {
        for (int y = 0; y < Stamp; y++)
        {
            for (int x = 0; x < Stamp; x++)
            {
                float lx = x - 256f;
                float ly = y - 258f;
                float rx = type == "lake" ? 214f : type == "mountain" ? 218f : type == "crater" ? 208f : 224f;
                float ry = type == "lake" ? 132f : type == "mountain" ? 168f : type == "crater" ? 168f : 150f;
                float d = (float)Math.Sqrt((lx / rx) * (lx / rx) + (ly / ry) * (ly / ry));
                float n = Fbm((x + 31) * .018f, (y + 17) * .018f, 4, type.GetHashCode());
                float edge = 1.02f + (n - .5f) * .26f - d;
                int alpha = Clamp(edge * 760f);
                Color c = bmp.GetPixel(x, y);
                if (type == "crater")
                {
                    float cd = (float)Math.Sqrt((lx / 168f) * (lx / 168f) + ((y - 238f) / 130f) * ((y - 238f) / 130f));
                    if (cd < .9f) alpha = Math.Max(alpha, 255);
                }
                bmp.SetPixel(x, y, Color.FromArgb(alpha, c.R, c.G, c.B));
            }
        }
    }

    private static void AddAtlasDetails(Graphics g)
    {
        using (var grass = new Pen(C(190, 231, 111, 150), 1.3f))
        {
            grass.StartCap = grass.EndCap = LineCap.Round;
            for (int i = 0; i < 150; i++)
            {
                float x = Rand(4, 124);
                float y = Rand(8, 126);
                g.DrawLine(grass, x, y, x + Rand(-4, 5), y - Rand(4, 15));
            }
        }
        using (var water = new Pen(C(221, 247, 250, 126), 2.2f))
        {
            water.StartCap = water.EndCap = LineCap.Round;
            for (int i = 0; i < 9; i++)
            {
                float y = 20 + i * 12;
                waterDash(g, water, 262, y, 122);
            }
        }
        using (var cracks = new Pen(C(44, 31, 22, 145), 2f))
        {
            cracks.StartCap = cracks.EndCap = LineCap.Round;
            for (int i = 0; i < 22; i++)
            {
                float x = 390 + Rand(10, 112);
                float y = Rand(12, 118);
                g.DrawLine(cracks, x, y, x + Rand(-20, 22), y + Rand(8, 24));
                g.DrawLine(cracks, x, y, x + Rand(-14, 14), y + Rand(-20, -5));
            }
        }
        using (var ring = new SolidBrush(C(25, 22, 20, 178)))
        {
            g.FillEllipse(ring, 34, 156, 62, 52);
        }
        using (var magma = new SolidBrush(C(207, 86, 38, 88)))
        {
            g.FillEllipse(magma, 54, 174, 24, 14);
        }
    }

    private static void AddStampDetails(Graphics g)
    {
        for (int col = 0; col < 5; col++)
        {
            using (var b = new SolidBrush(C(0, 0, 0, 24)))
            {
                g.FillEllipse(b, col * Stamp + 86, 378, 350, 58);
            }
        }
    }

    private static void waterDash(Graphics g, Pen p, float x, float y, float len)
    {
        g.DrawBezier(p, x, y, x + len * .22f, y - 6, x + len * .65f, y + 7, x + len, y);
    }

    private static void Configure(Graphics g)
    {
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.CompositingQuality = CompositingQuality.HighQuality;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
    }

    private static float Fbm(float x, float y, int octaves, int seed)
    {
        float sum = 0f;
        float amp = .5f;
        float freq = 1f;
        float norm = 0f;
        for (int i = 0; i < octaves; i++)
        {
            sum += ValueNoise(x * freq, y * freq, seed + i * 101) * amp;
            norm += amp;
            amp *= .5f;
            freq *= 2.03f;
        }
        return sum / Math.Max(.0001f, norm);
    }

    private static float ValueNoise(float x, float y, int seed)
    {
        int xi = (int)Math.Floor(x);
        int yi = (int)Math.Floor(y);
        float tx = Smooth(x - xi);
        float ty = Smooth(y - yi);
        float a = Hash(xi, yi, seed);
        float b = Hash(xi + 1, yi, seed);
        float c = Hash(xi, yi + 1, seed);
        float d = Hash(xi + 1, yi + 1, seed);
        return Lerp(Lerp(a, b, tx), Lerp(c, d, tx), ty);
    }

    private static float Hash(int x, int y, int seed)
    {
        unchecked
        {
            uint h = (uint)(x * 374761393 + y * 668265263 + seed * 1442695041);
            h = (h ^ (h >> 13)) * 1274126177u;
            h ^= h >> 16;
            return (h & 0xffff) / 65535f;
        }
    }

    private static float Smooth(float t) { return t * t * (3f - 2f * t); }
    private static float Lerp(float a, float b, float t) { return a + (b - a) * t; }
    private static float Rand(float min, float max) { return min + (float)Rng.NextDouble() * (max - min); }
    private static int Clamp(float v) { return (int)Math.Max(0, Math.Min(255, v)); }
    private static Color C(int r, int g, int b, int a = 255) { return Color.FromArgb(a, r, g, b); }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies System.Drawing
$resolvedOutDir = [System.IO.Path]::GetFullPath($OutDir)
[AiTerrainAssetBuilder]::Build($resolvedOutDir)
Write-Host "Built AI-source terrain assets in $resolvedOutDir"
