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

public static class TerrainStampGenerator
{
    private const int Frame = 256;
    private static readonly Random Rng = new Random(19840);

    public static void Generate(string outDir)
    {
        Directory.CreateDirectory(outDir);
        using (var bmp = new Bitmap(Frame * 5, Frame, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(bmp))
        {
            g.Clear(Color.Transparent);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;

            DrawForest(g, 0);
            DrawMountain(g, 1);
            DrawLake(g, 2);
            DrawWasteland(g, 3);
            DrawCrater(g, 4);

            bmp.Save(Path.Combine(outDir, "terrain-stamps.png"), ImageFormat.Png);
        }
    }

    private static void DrawForest(Graphics g, int col)
    {
        float ox = col * Frame;
        FillBlob(g, C(28, 87, 41, 96), ox + 22, 34, 214, 176, 18);
        for (int i = 0; i < 52; i++)
        {
            float x = ox + Rand(38, 220);
            float y = Rand(42, 202);
            float s = Rand(24, 48);
            FillEllipse(g, C(8, 38, 22, 80), x - s * .46f, y - s * .18f, s * .92f, s * .46f);
        }
        for (int i = 0; i < 48; i++)
        {
            float x = ox + Rand(38, 220);
            float y = Rand(36, 198);
            float s = Rand(22, 42);
            Color dark = i % 3 == 0 ? C(25, 82, 38, 245) : C(37, 112, 46, 245);
            Color light = i % 3 == 0 ? C(82, 153, 66, 210) : C(93, 172, 72, 210);
            FillEllipse(g, dark, x - s * .48f, y - s * .48f, s, s);
            FillEllipse(g, light, x - s * .2f, y - s * .36f, s * .46f, s * .42f);
            FillRect(g, C(85, 54, 33, 190), x - s * .06f, y + s * .24f, s * .12f, s * .28f);
        }
    }

    private static void DrawMountain(Graphics g, int col)
    {
        float ox = col * Frame;
        FillBlob(g, C(78, 84, 80, 105), ox + 22, 78, 214, 104, 12);
        DrawPeak(g, ox + 56, 182, 82, 132, C(78, 85, 82, 250), C(202, 207, 196, 240));
        DrawPeak(g, ox + 122, 190, 116, 158, C(66, 73, 72, 255), C(232, 235, 224, 245));
        DrawPeak(g, ox + 190, 178, 88, 126, C(91, 96, 88, 245), C(190, 198, 188, 235));
        using (var p = new Pen(C(34, 40, 40, 110), 4.5f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            g.DrawLine(p, ox + 119, 58, ox + 87, 191);
            g.DrawLine(p, ox + 125, 39, ox + 170, 191);
            g.DrawLine(p, ox + 190, 63, ox + 210, 176);
        }
    }

    private static void DrawLake(Graphics g, int col)
    {
        float ox = col * Frame;
        FillEllipse(g, C(51, 143, 188, 94), ox + 24, 44, 210, 166);
        FillEllipse(g, C(35, 127, 179, 255), ox + 34, 54, 190, 144);
        FillEllipse(g, C(45, 157, 205, 230), ox + 58, 64, 142, 104);
        using (var p = new Pen(C(177, 231, 240, 170), 4f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 7; i++)
            {
                float y = 83 + i * 16;
                g.DrawBezier(p, ox + 58, y, ox + 94, y - 13, ox + 126, y + 13, ox + 164, y);
                g.DrawBezier(p, ox + 128, y + 6, ox + 154, y - 8, ox + 182, y + 13, ox + 205, y + 1);
            }
        }
    }

    private static void DrawWasteland(Graphics g, int col)
    {
        float ox = col * Frame;
        FillBlob(g, C(143, 114, 75, 245), ox + 22, 34, 212, 184, 15);
        FillBlob(g, C(112, 90, 59, 120), ox + 40, 52, 174, 148, 11);
        Dots(g, ox, C(80, 63, 42, 130), C(186, 148, 92, 125), 96, 3, 8);
        using (var p = new Pen(C(54, 43, 32, 160), 3.2f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 14; i++)
            {
                float x = ox + Rand(45, 210);
                float y = Rand(55, 200);
                g.DrawLine(p, x, y, x + Rand(-34, 34), y + Rand(10, 34));
                g.DrawLine(p, x, y, x + Rand(-24, 24), y + Rand(-30, -9));
            }
        }
    }

    private static void DrawCrater(Graphics g, int col)
    {
        float ox = col * Frame;
        FillEllipse(g, C(98, 79, 62, 225), ox + 36, 40, 186, 174);
        FillEllipse(g, C(45, 40, 36, 255), ox + 55, 57, 148, 138);
        FillEllipse(g, C(23, 22, 21, 245), ox + 82, 82, 92, 82);
        FillEllipse(g, C(236, 111, 50, 70), ox + 101, 103, 54, 32);
        using (var p = new Pen(C(34, 28, 25, 115), 3.5f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 20; i++)
            {
                double a = i * Math.PI * 2 / 20.0 + Rand(-.1f, .1f);
                float x1 = ox + 128 + (float)Math.Cos(a) * Rand(58, 78);
                float y1 = 128 + (float)Math.Sin(a) * Rand(52, 72);
                float x2 = ox + 128 + (float)Math.Cos(a) * Rand(82, 112);
                float y2 = 128 + (float)Math.Sin(a) * Rand(78, 108);
                g.DrawLine(p, x1, y1, x2, y2);
            }
        }
    }

    private static void DrawPeak(Graphics g, float x, float baseY, float width, float height, Color shade, Color snow)
    {
        PointF top = new PointF(x, baseY - height);
        PointF left = new PointF(x - width * .52f, baseY);
        PointF right = new PointF(x + width * .52f, baseY);
        FillPolygon(g, shade, top, left, right);
        FillPolygon(g, Color.FromArgb(100, 43, 49, 50), top, new PointF(x, baseY), right);
        FillPolygon(g, snow, top, new PointF(x - width * .16f, baseY - height * .66f), new PointF(x + width * .18f, baseY - height * .6f));
    }

    private static void FillBlob(Graphics g, Color color, float x, float y, float w, float h, int lobes)
    {
        using (var brush = new SolidBrush(color))
        {
            g.FillEllipse(brush, x, y, w, h);
            for (int i = 0; i < lobes; i++)
            {
                float s = Rand(Math.Min(w, h) * .18f, Math.Min(w, h) * .36f);
                float a = (float)(i * Math.PI * 2 / lobes);
                float cx = x + w / 2 + (float)Math.Cos(a) * w * Rand(.34f, .48f);
                float cy = y + h / 2 + (float)Math.Sin(a) * h * Rand(.34f, .48f);
                g.FillEllipse(brush, cx - s / 2, cy - s / 2, s, s);
            }
        }
    }

    private static void Dots(Graphics g, float ox, Color a, Color b, int count, int min, int max)
    {
        for (int i = 0; i < count; i++)
        {
            float size = Rand(min, max);
            FillEllipse(g, Rng.Next(2) == 0 ? a : b, ox + Rand(30, 226), Rand(44, 212), size, size);
        }
    }

    private static void FillRect(Graphics g, Color color, float x, float y, float w, float h)
    {
        using (var brush = new SolidBrush(color)) { g.FillRectangle(brush, x, y, w, h); }
    }

    private static void FillEllipse(Graphics g, Color color, float x, float y, float w, float h)
    {
        using (var brush = new SolidBrush(color)) { g.FillEllipse(brush, x, y, w, h); }
    }

    private static void FillPolygon(Graphics g, Color color, params PointF[] points)
    {
        using (var brush = new SolidBrush(color)) { g.FillPolygon(brush, points); }
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
[TerrainStampGenerator]::Generate($resolvedOutDir)
Write-Host "Generated terrain stamps in $resolvedOutDir"
