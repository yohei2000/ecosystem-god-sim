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

public static class GameAssetGenerator
{
    private const int Tile = 128;
    private static readonly Random Rng = new Random(8421);

    public static void Generate(string outDir)
    {
        Directory.CreateDirectory(outDir);
        DrawTerrainAtlas(Path.Combine(outDir, "terrain-atlas.png"));
        DrawCreatureAtlas(Path.Combine(outDir, "creature-atlas.png"));
    }

    private static void DrawTerrainAtlas(string path)
    {
        using (var bmp = new Bitmap(Tile * 4, Tile * 2, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            DrawGrassland(g, 0, 0);
            DrawForest(g, 1, 0);
            DrawWater(g, 2, 0);
            DrawWasteland(g, 3, 0);
            DrawCrater(g, 0, 1);
            DrawMountain(g, 1, 1);
            DrawAsh(g, 2, 1);
            DrawMeadow(g, 3, 1);
            bmp.Save(path, ImageFormat.Png);
        }
    }

    private static void DrawCreatureAtlas(string path)
    {
        using (var bmp = new Bitmap(Tile * 2, Tile, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(bmp))
        {
            g.Clear(Color.Transparent);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            DrawHerbivore(g, 0, 0);
            DrawCarnivore(g, 1, 0);
            bmp.Save(path, ImageFormat.Png);
        }
    }

    private static void DrawGrassland(Graphics g, int col, int row)
    {
        var r = TileRect(col, row);
        FillBase(g, r, C(76, 125, 55), C(54, 102, 48));
        Dots(g, r, C(124, 178, 75, 150), C(44, 84, 39, 100), 210, 1, 4);
        Strokes(g, r, C(151, 205, 88, 150), 95, 4, 14);
    }

    private static void DrawForest(Graphics g, int col, int row)
    {
        var r = TileRect(col, row);
        FillBase(g, r, C(35, 77, 42), C(22, 57, 31));
        Dots(g, r, C(70, 122, 58, 120), C(13, 44, 25, 120), 120, 2, 5);
        for (int i = 0; i < 34; i++)
        {
            float x = r.X + Rand(6, Tile - 7);
            float y = r.Y + Rand(6, Tile - 7);
            float size = Rand(10, 22);
            FillEllipse(g, C(12, 43, 24, 165), x - size * .45f, y - size * .28f, size * .9f, size * .58f);
            FillEllipse(g, C(42, 104, 45, 225), x - size * .42f, y - size * .55f, size * .84f, size * .84f);
            FillEllipse(g, C(81, 143, 61, 190), x - size * .2f, y - size * .46f, size * .42f, size * .42f);
            FillRect(g, C(73, 48, 30, 180), x - 1.3f, y + size * .18f, 2.6f, size * .25f);
        }
    }

    private static void DrawWater(Graphics g, int col, int row)
    {
        var r = TileRect(col, row);
        FillBase(g, r, C(35, 113, 145), C(21, 86, 119));
        Dots(g, r, C(74, 157, 188, 95), C(8, 53, 82, 85), 95, 2, 6);
        using (var p = new Pen(C(166, 224, 236, 145), 2.4f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 12; i++)
            {
                float y = r.Y + 12 + i * 9 + Rand(-3, 4);
                var path = new GraphicsPath();
                path.StartFigure();
                path.AddBezier(r.X + 6, y, r.X + 26, y - 8, r.X + 44, y + 8, r.X + 64, y);
                path.AddBezier(r.X + 64, y, r.X + 84, y - 8, r.X + 101, y + 8, r.X + 122, y);
                g.DrawPath(p, path);
            }
        }
        using (var p = new Pen(C(211, 196, 131, 90), 4.2f))
        {
            g.DrawArc(p, r.X - 14, r.Y + 82, 84, 56, 294, 98);
            g.DrawArc(p, r.X + 76, r.Y - 18, 70, 54, 94, 128);
        }
    }

    private static void DrawWasteland(Graphics g, int col, int row)
    {
        var r = TileRect(col, row);
        FillBase(g, r, C(102, 86, 59), C(74, 65, 45));
        Dots(g, r, C(148, 123, 77, 105), C(48, 43, 34, 110), 170, 1, 5);
        using (var p = new Pen(C(44, 36, 29, 130), 2.1f))
        {
            for (int i = 0; i < 17; i++)
            {
                float x = r.X + Rand(12, Tile - 12);
                float y = r.Y + Rand(12, Tile - 12);
                g.DrawLine(p, x, y, x + Rand(-24, 24), y + Rand(7, 24));
                g.DrawLine(p, x, y, x + Rand(-17, 17), y + Rand(-22, -6));
            }
        }
    }

    private static void DrawCrater(Graphics g, int col, int row)
    {
        var r = TileRect(col, row);
        FillBase(g, r, C(56, 53, 48), C(34, 33, 31));
        Dots(g, r, C(116, 104, 87, 80), C(14, 13, 12, 140), 120, 1, 5);
        FillEllipse(g, C(117, 98, 78, 210), r.X + 18, r.Y + 20, 92, 82);
        FillEllipse(g, C(47, 41, 37, 255), r.X + 28, r.Y + 28, 72, 64);
        FillEllipse(g, C(26, 25, 24, 245), r.X + 39, r.Y + 38, 50, 44);
        FillEllipse(g, C(218, 112, 56, 80), r.X + 50, r.Y + 46, 27, 18);
        using (var p = new Pen(C(18, 17, 16, 130), 2.3f))
        {
            for (int i = 0; i < 15; i++)
            {
                double a = i * Math.PI * 2 / 15.0 + Rand(-.13f, .13f);
                float x1 = r.X + 64 + (float)Math.Cos(a) * Rand(33, 43);
                float y1 = r.Y + 64 + (float)Math.Sin(a) * Rand(28, 38);
                float x2 = r.X + 64 + (float)Math.Cos(a) * Rand(47, 67);
                float y2 = r.Y + 64 + (float)Math.Sin(a) * Rand(42, 62);
                g.DrawLine(p, x1, y1, x2, y2);
            }
        }
    }

    private static void DrawMountain(Graphics g, int col, int row)
    {
        var r = TileRect(col, row);
        FillBase(g, r, C(84, 94, 88), C(57, 65, 62));
        Dots(g, r, C(131, 139, 128, 90), C(32, 38, 37, 120), 130, 1, 5);
        DrawPeak(g, r.X + 28, r.Y + 94, 46, 78, C(80, 83, 76), C(161, 167, 155));
        DrawPeak(g, r.X + 70, r.Y + 98, 56, 88, C(64, 70, 69), C(181, 186, 177));
        DrawPeak(g, r.X + 102, r.Y + 92, 39, 70, C(93, 97, 87), C(153, 160, 152));
        using (var p = new Pen(C(40, 45, 44, 130), 2.2f))
        {
            g.DrawLine(p, r.X + 51, r.Y + 44, r.X + 35, r.Y + 99);
            g.DrawLine(p, r.X + 71, r.Y + 31, r.X + 92, r.Y + 98);
            g.DrawLine(p, r.X + 96, r.Y + 50, r.X + 107, r.Y + 93);
        }
    }

    private static void DrawAsh(Graphics g, int col, int row)
    {
        var r = TileRect(col, row);
        FillBase(g, r, C(78, 76, 69), C(48, 47, 44));
        Dots(g, r, C(177, 167, 149, 105), C(25, 24, 22, 140), 190, 1, 6);
        using (var p = new Pen(C(236, 122, 58, 115), 2.2f))
        {
            for (int i = 0; i < 14; i++)
            {
                float x = r.X + Rand(12, Tile - 12);
                float y = r.Y + Rand(12, Tile - 12);
                g.DrawLine(p, x, y, x + Rand(7, 20), y + Rand(-3, 5));
            }
        }
    }

    private static void DrawMeadow(Graphics g, int col, int row)
    {
        var r = TileRect(col, row);
        FillBase(g, r, C(90, 151, 55), C(60, 122, 49));
        Dots(g, r, C(169, 217, 98, 150), C(44, 90, 38, 90), 240, 1, 4);
        Strokes(g, r, C(189, 240, 109, 155), 110, 5, 16);
        Color[] flowerColors = { C(255, 226, 104, 210), C(244, 122, 142, 190), C(216, 228, 255, 190) };
        for (int i = 0; i < 32; i++)
        {
            float x = r.X + Rand(7, Tile - 7);
            float y = r.Y + Rand(7, Tile - 7);
            FillEllipse(g, flowerColors[Rng.Next(flowerColors.Length)], x - 1.6f, y - 1.6f, 3.2f, 3.2f);
        }
    }

    private static void DrawHerbivore(Graphics g, int col, int row)
    {
        float ox = col * Tile;
        float oy = row * Tile;
        FillEllipse(g, C(0, 0, 0, 50), ox + 36, oy + 50, 58, 31);
        FillRotatedEllipse(g, C(178, 132, 75), ox + 64, oy + 61, 55, 30, -8);
        FillRotatedEllipse(g, C(229, 190, 121), ox + 69, oy + 55, 33, 14, -8);
        FillEllipse(g, C(195, 147, 84), ox + 35, oy + 50, 27, 22);
        FillEllipse(g, C(238, 204, 139), ox + 39, oy + 55, 13, 10);
        FillEllipse(g, C(86, 55, 40), ox + 40, oy + 47, 5, 5);
        FillEllipse(g, C(86, 55, 40), ox + 49, oy + 47, 5, 5);
        FillPolygon(g, C(167, 112, 64), P(35, 50, ox, oy), P(27, 42, ox, oy), P(39, 44, ox, oy));
        FillPolygon(g, C(167, 112, 64), P(55, 50, ox, oy), P(65, 42, ox, oy), P(53, 44, ox, oy));
        FillRect(g, C(112, 78, 48), ox + 55, oy + 76, 6, 19);
        FillRect(g, C(112, 78, 48), ox + 76, oy + 74, 6, 18);
        FillRect(g, C(112, 78, 48), ox + 49, oy + 33, 5, 16);
        FillRect(g, C(112, 78, 48), ox + 73, oy + 33, 5, 16);
        FillEllipse(g, C(241, 224, 169), ox + 87, oy + 50, 12, 12);
    }

    private static void DrawCarnivore(Graphics g, int col, int row)
    {
        float ox = col * Tile;
        float oy = row * Tile;
        FillEllipse(g, C(0, 0, 0, 55), ox + 31, oy + 50, 66, 32);
        FillRotatedEllipse(g, C(143, 62, 46), ox + 63, oy + 62, 62, 27, 8);
        FillRotatedEllipse(g, C(200, 95, 62), ox + 57, oy + 57, 38, 12, 8);
        FillPolygon(g, C(122, 48, 40), P(30, 58, ox, oy), P(16, 48, ox, oy), P(33, 46, ox, oy));
        FillPolygon(g, C(112, 43, 36), P(34, 50, ox, oy), P(25, 35, ox, oy), P(45, 43, ox, oy));
        FillPolygon(g, C(112, 43, 36), P(47, 45, ox, oy), P(56, 32, ox, oy), P(60, 50, ox, oy));
        FillEllipse(g, C(245, 174, 95), ox + 28, oy + 53, 11, 9);
        FillEllipse(g, C(34, 19, 17), ox + 33, oy + 46, 5, 5);
        FillEllipse(g, C(34, 19, 17), ox + 44, oy + 45, 5, 5);
        using (var p = new Pen(C(92, 37, 32), 9f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            g.DrawBezier(p, ox + 90, oy + 58, ox + 111, oy + 45, ox + 116, oy + 72, ox + 100, oy + 79);
        }
        FillRect(g, C(88, 39, 33), ox + 55, oy + 76, 7, 20);
        FillRect(g, C(88, 39, 33), ox + 81, oy + 74, 7, 18);
        FillRect(g, C(88, 39, 33), ox + 53, oy + 31, 6, 17);
        FillRect(g, C(88, 39, 33), ox + 78, oy + 32, 6, 17);
    }

    private static void FillBase(Graphics g, Rectangle r, Color a, Color b)
    {
        using (var brush = new LinearGradientBrush(r, a, b, 45f))
        {
            g.FillRectangle(brush, r);
        }
    }

    private static void Dots(Graphics g, Rectangle r, Color a, Color b, int count, int min, int max)
    {
        for (int i = 0; i < count; i++)
        {
            float size = Rand(min, max);
            FillEllipse(g, Rng.Next(2) == 0 ? a : b, r.X + Rand(0, Tile), r.Y + Rand(0, Tile), size, size);
        }
    }

    private static void Strokes(Graphics g, Rectangle r, Color color, int count, int minLen, int maxLen)
    {
        using (var p = new Pen(color, 1.4f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < count; i++)
            {
                float x = r.X + Rand(1, Tile - 1);
                float y = r.Y + Rand(1, Tile - 1);
                float len = Rand(minLen, maxLen);
                float sway = Rand(-4, 5);
                g.DrawLine(p, x, y, x + sway, y - len);
            }
        }
    }

    private static void DrawPeak(Graphics g, float x, float baseY, float width, float height, Color shade, Color snow)
    {
        PointF top = new PointF(x, baseY - height);
        PointF left = new PointF(x - width * .52f, baseY);
        PointF right = new PointF(x + width * .52f, baseY);
        FillPolygon(g, shade, top, left, right);
        FillPolygon(g, Color.FromArgb(92, 74, 78, 76), top, new PointF(x, baseY), right);
        FillPolygon(g, snow, top, new PointF(x - width * .16f, baseY - height * .68f), new PointF(x + width * .18f, baseY - height * .62f));
    }

    private static void FillRotatedEllipse(Graphics g, Color color, float cx, float cy, float w, float h, float angle)
    {
        var state = g.Save();
        g.TranslateTransform(cx, cy);
        g.RotateTransform(angle);
        FillEllipse(g, color, -w / 2f, -h / 2f, w, h);
        g.Restore(state);
    }

    private static Rectangle TileRect(int col, int row)
    {
        return new Rectangle(col * Tile, row * Tile, Tile, Tile);
    }

    private static PointF P(float x, float y, float ox, float oy)
    {
        return new PointF(ox + x, oy + y);
    }

    private static void FillRect(Graphics g, Color color, float x, float y, float w, float h)
    {
        using (var brush = new SolidBrush(color))
        {
            g.FillRectangle(brush, x, y, w, h);
        }
    }

    private static void FillEllipse(Graphics g, Color color, float x, float y, float w, float h)
    {
        using (var brush = new SolidBrush(color))
        {
            g.FillEllipse(brush, x, y, w, h);
        }
    }

    private static void FillPolygon(Graphics g, Color color, params PointF[] points)
    {
        using (var brush = new SolidBrush(color))
        {
            g.FillPolygon(brush, points);
        }
    }

    private static float Rand(float min, float max)
    {
        return (float)(min + Rng.NextDouble() * (max - min));
    }

    private static Color C(int r, int g, int b, int a = 255)
    {
        return Color.FromArgb(a, r, g, b);
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies System.Drawing
$resolvedOutDir = [System.IO.Path]::GetFullPath($OutDir)
[GameAssetGenerator]::Generate($resolvedOutDir)

Write-Host "Generated assets in $resolvedOutDir"
