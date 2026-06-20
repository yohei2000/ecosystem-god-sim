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

public static class RealisticAssetGenerator
{
    private const int TerrainFrame = 320;
    private const int CreatureFrame = 192;
    private static readonly Random Rng = new Random(260620);

    public static void Generate(string outDir)
    {
        Directory.CreateDirectory(outDir);
        DrawTerrainStamps(Path.Combine(outDir, "terrain-stamps.png"));
        DrawCreatureAtlas(Path.Combine(outDir, "creature-atlas.png"));
    }

    private static void DrawTerrainStamps(string path)
    {
        using (var bmp = new Bitmap(TerrainFrame * 5, TerrainFrame, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(bmp))
        {
            g.Clear(Color.Transparent);
            Configure(g);
            DrawForestStamp(g, 0);
            DrawMountainStamp(g, 1);
            DrawLakeStamp(g, 2);
            DrawWastelandStamp(g, 3);
            DrawCraterStamp(g, 4);
            bmp.Save(path, ImageFormat.Png);
        }
    }

    private static void DrawCreatureAtlas(string path)
    {
        using (var bmp = new Bitmap(CreatureFrame * 4, CreatureFrame * 2, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(bmp))
        {
            g.Clear(Color.Transparent);
            Configure(g);
            for (int frame = 0; frame < 4; frame++)
            {
                DrawHerbivoreFrame(g, frame, 0, frame);
                DrawCarnivoreFrame(g, frame, 1, frame);
            }
            bmp.Save(path, ImageFormat.Png);
        }
    }

    private static void Configure(Graphics g)
    {
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.CompositingQuality = CompositingQuality.HighQuality;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
    }

    private static void DrawForestStamp(Graphics g, int col)
    {
        float ox = col * TerrainFrame;
        var basePts = BlobPoints(ox + 160, 174, 126, 88, 24, .18f);
        FillClosed(g, C(12, 45, 24, 72), basePts, 0.62f);
        FillClosed(g, C(23, 77, 36, 132), BlobPoints(ox + 158, 152, 116, 78, 22, .2f), 0.58f);

        for (int i = 0; i < 84; i++)
        {
            float x = ox + Rand(52, 268);
            float y = Rand(54, 246);
            float s = Rand(24, 48);
            Color shadow = C(5, 28, 17, 86);
            Color dark = Mix(C(22, 74, 34, 245), C(31, 95, 42, 245), (float)Rng.NextDouble());
            Color mid = Mix(C(42, 125, 54, 240), C(61, 144, 66, 235), (float)Rng.NextDouble());
            Color hi = Mix(C(105, 169, 82, 205), C(135, 188, 91, 190), (float)Rng.NextDouble());

            FillEllipse(g, shadow, x - s * .48f, y + s * .14f, s * .96f, s * .42f);
            FillEllipse(g, dark, x - s * .48f, y - s * .5f, s, s);
            FillEllipse(g, mid, x - s * .36f, y - s * .42f, s * .74f, s * .7f);
            FillEllipse(g, hi, x - s * .17f, y - s * .36f, s * .34f, s * .3f);

            if (i % 3 == 0)
            {
                FillRect(g, C(84, 56, 34, 165), x - s * .035f, y + s * .14f, s * .07f, s * .34f);
            }
        }

        using (var p = new Pen(C(6, 27, 17, 58), 4.2f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 24; i++)
            {
                float x = ox + Rand(42, 278);
                float y = Rand(80, 250);
                g.DrawLine(p, x, y, x + Rand(-18, 18), y + Rand(10, 28));
            }
        }
    }

    private static void DrawMountainStamp(Graphics g, int col)
    {
        float ox = col * TerrainFrame;
        FillClosed(g, C(58, 66, 63, 92), BlobPoints(ox + 164, 214, 130, 46, 18, .16f), 0.55f);
        DrawPeak(g, ox + 72, 236, 100, 152, C(86, 94, 88, 248), C(228, 230, 220, 245));
        DrawPeak(g, ox + 152, 244, 142, 198, C(65, 75, 74, 255), C(238, 240, 229, 250));
        DrawPeak(g, ox + 236, 228, 110, 150, C(96, 101, 91, 246), C(205, 212, 202, 238));

        using (var p = new Pen(C(31, 37, 37, 108), 4.4f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            g.DrawLine(p, ox + 151, 53, ox + 111, 241);
            g.DrawLine(p, ox + 153, 54, ox + 207, 241);
            g.DrawLine(p, ox + 236, 84, ox + 265, 226);
            g.DrawLine(p, ox + 72, 88, ox + 48, 235);
        }

        for (int i = 0; i < 170; i++)
        {
            float x = ox + Rand(34, 292);
            float y = Rand(120, 256);
            float s = Rand(1.5f, 5.5f);
            FillEllipse(g, Rng.Next(2) == 0 ? C(35, 42, 41, 82) : C(145, 151, 139, 70), x, y, s, s * Rand(.5f, 1.1f));
        }
    }

    private static void DrawLakeStamp(Graphics g, int col)
    {
        float ox = col * TerrainFrame;
        var shore = BlobPoints(ox + 160, 162, 132, 92, 26, .22f);
        var water = BlobPoints(ox + 160, 160, 118, 78, 26, .18f);
        FillClosed(g, C(177, 161, 103, 152), shore, 0.72f);
        FillClosed(g, C(47, 132, 176, 255), water, 0.7f);

        using (var brush = new LinearGradientBrush(new RectangleF(ox + 42, 70, 238, 170), C(70, 176, 212, 238), C(20, 92, 147, 248), 90f))
        {
            using (var path = ClosedPath(water, 0.7f))
            {
                g.FillPath(brush, path);
            }
        }

        FillClosed(g, C(116, 208, 226, 62), BlobPoints(ox + 118, 128, 54, 28, 14, .25f), 0.55f);
        using (var p = new Pen(C(210, 244, 247, 160), 4.4f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 8; i++)
            {
                float y = 96 + i * 16;
                g.DrawBezier(p, ox + 78, y, ox + 108, y - 12, ox + 132, y + 12, ox + 162, y);
                g.DrawBezier(p, ox + 142, y + 7, ox + 172, y - 8, ox + 205, y + 10, ox + 240, y + 1);
            }
        }
    }

    private static void DrawWastelandStamp(Graphics g, int col)
    {
        float ox = col * TerrainFrame;
        FillClosed(g, C(132, 105, 68, 238), BlobPoints(ox + 160, 164, 128, 92, 28, .26f), 0.6f);
        FillClosed(g, C(103, 82, 54, 118), BlobPoints(ox + 158, 160, 96, 68, 18, .24f), 0.6f);
        for (int i = 0; i < 190; i++)
        {
            float x = ox + Rand(44, 276);
            float y = Rand(62, 258);
            float s = Rand(1.2f, 7f);
            FillEllipse(g, Rng.Next(2) == 0 ? C(72, 55, 37, 110) : C(183, 147, 91, 105), x, y, s, s * Rand(.5f, 1.2f));
        }
        using (var p = new Pen(C(49, 38, 29, 166), 3.4f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 22; i++)
            {
                float x = ox + Rand(58, 258);
                float y = Rand(74, 238);
                g.DrawLine(p, x, y, x + Rand(-38, 38), y + Rand(12, 42));
                g.DrawLine(p, x, y, x + Rand(-28, 28), y + Rand(-36, -10));
            }
        }
    }

    private static void DrawCraterStamp(Graphics g, int col)
    {
        float ox = col * TerrainFrame;
        FillEllipse(g, C(108, 87, 66, 226), ox + 48, 54, 226, 202);
        FillEllipse(g, C(70, 56, 47, 235), ox + 66, 70, 190, 170);
        FillEllipse(g, C(35, 31, 29, 255), ox + 88, 91, 146, 128);
        FillEllipse(g, C(19, 19, 18, 248), ox + 112, 113, 96, 76);
        FillEllipse(g, C(214, 92, 42, 72), ox + 128, 132, 66, 34);

        using (var p = new Pen(C(30, 25, 23, 122), 3.8f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 28; i++)
            {
                double a = i * Math.PI * 2 / 28.0 + Rand(-.11f, .11f);
                float x1 = ox + 160 + (float)Math.Cos(a) * Rand(78, 98);
                float y1 = 160 + (float)Math.Sin(a) * Rand(67, 90);
                float x2 = ox + 160 + (float)Math.Cos(a) * Rand(104, 144);
                float y2 = 160 + (float)Math.Sin(a) * Rand(96, 134);
                g.DrawLine(p, x1, y1, x2, y2);
            }
        }

        for (int i = 0; i < 120; i++)
        {
            double a = Rng.NextDouble() * Math.PI * 2;
            float d = Rand(44, 132);
            float x = ox + 160 + (float)Math.Cos(a) * d;
            float y = 160 + (float)Math.Sin(a) * d * .82f;
            FillEllipse(g, Rng.Next(2) == 0 ? C(151, 123, 91, 96) : C(14, 13, 12, 112), x, y, Rand(2, 8), Rand(1.5f, 6));
        }
    }

    private static void DrawPeak(Graphics g, float x, float baseY, float width, float height, Color shade, Color snow)
    {
        PointF top = new PointF(x, baseY - height);
        PointF left = new PointF(x - width * .54f, baseY);
        PointF right = new PointF(x + width * .54f, baseY);
        FillPolygon(g, shade, top, left, right);
        FillPolygon(g, C(34, 41, 42, 102), top, new PointF(x, baseY), right);
        FillPolygon(g, C(150, 158, 151, 100), new PointF(x - width * .12f, baseY - height * .43f), left, new PointF(x, baseY));
        FillPolygon(g, snow, top, new PointF(x - width * .16f, baseY - height * .62f), new PointF(x + width * .18f, baseY - height * .57f));
    }

    private static void DrawHerbivoreFrame(Graphics g, int col, int row, int frame)
    {
        float ox = col * CreatureFrame;
        float oy = row * CreatureFrame;
        float phase = frame * (float)Math.PI / 2f;
        float bob = (float)Math.Sin(phase) * 3f;
        float stretch = 1f + (float)Math.Sin(phase + .5f) * .04f;
        float cx = ox + 96;
        float cy = oy + 99 + bob;

        FillEllipse(g, C(0, 0, 0, 46), ox + 42, oy + 124, 100, 28);
        DrawLeg(g, C(93, 67, 48, 238), cx - 34, cy + 17, phase, false, 23, 3.8f);
        DrawLeg(g, C(112, 80, 51, 238), cx - 10, cy + 20, phase + (float)Math.PI, false, 25, 4.2f);
        DrawLeg(g, C(98, 68, 45, 238), cx + 15, cy + 18, phase + (float)Math.PI, false, 24, 4.1f);
        DrawLeg(g, C(128, 90, 56, 238), cx + 36, cy + 14, phase, false, 22, 3.8f);

        FillRotatedEllipse(g, C(130, 92, 57, 255), cx - 2, cy, 92 * stretch, 44, -5);
        FillRotatedEllipse(g, C(174, 128, 78, 235), cx + 4, cy - 7, 72 * stretch, 24, -5);
        FillRotatedEllipse(g, C(214, 184, 130, 214), cx + 23, cy + 8, 42, 17, -5);
        FillRotatedEllipse(g, C(111, 75, 50, 245), cx + 51, cy - 9, 38, 26, 6);
        FillRotatedEllipse(g, C(170, 125, 80, 240), cx + 68, cy - 10, 28, 18, 8);
        FillEllipse(g, C(28, 20, 17, 238), cx + 77, cy - 14, 4.2f, 4.2f);
        FillPolygon(g, C(111, 75, 50, 245), new PointF(cx + 46, cy - 21), new PointF(cx + 38, cy - 41), new PointF(cx + 57, cy - 26));
        FillPolygon(g, C(111, 75, 50, 245), new PointF(cx + 61, cy - 20), new PointF(cx + 70, cy - 39), new PointF(cx + 73, cy - 22));
        using (var p = new Pen(C(91, 66, 46, 190), 3.2f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            g.DrawLine(p, cx + 48, cy - 32, cx + 39, cy - 48);
            g.DrawLine(p, cx + 65, cy - 31, cx + 75, cy - 47);
        }
        FillEllipse(g, C(232, 219, 170, 226), cx - 54, cy - 7, 14, 12);
    }

    private static void DrawCarnivoreFrame(Graphics g, int col, int row, int frame)
    {
        float ox = col * CreatureFrame;
        float oy = row * CreatureFrame;
        float phase = frame * (float)Math.PI / 2f;
        float bob = (float)Math.Sin(phase + .6f) * 2.5f;
        float stretch = 1f + (float)Math.Sin(phase) * .06f;
        float cx = ox + 95;
        float cy = oy + 101 + bob;

        FillEllipse(g, C(0, 0, 0, 52), ox + 35, oy + 126, 116, 30);
        DrawLeg(g, C(56, 47, 39, 244), cx - 40, cy + 17, phase + (float)Math.PI, true, 26, 4.5f);
        DrawLeg(g, C(72, 58, 45, 244), cx - 14, cy + 21, phase, true, 29, 4.8f);
        DrawLeg(g, C(58, 48, 40, 244), cx + 15, cy + 21, phase, true, 28, 4.8f);
        DrawLeg(g, C(78, 62, 46, 244), cx + 39, cy + 16, phase + (float)Math.PI, true, 26, 4.5f);

        FillRotatedEllipse(g, C(63, 55, 48, 255), cx - 5, cy, 108 * stretch, 38, 4);
        FillRotatedEllipse(g, C(102, 87, 68, 230), cx - 2, cy - 7, 76 * stretch, 18, 4);
        FillRotatedEllipse(g, C(37, 34, 32, 245), cx + 54, cy - 7, 42, 26, -4);
        FillPolygon(g, C(37, 34, 32, 245), new PointF(cx + 70, cy - 10), new PointF(cx + 92, cy - 3), new PointF(cx + 71, cy + 7));
        FillEllipse(g, C(18, 16, 15, 245), cx + 89, cy - 4, 5.2f, 5.2f);
        FillPolygon(g, C(42, 38, 34, 245), new PointF(cx + 45, cy - 17), new PointF(cx + 37, cy - 36), new PointF(cx + 58, cy - 23));
        FillPolygon(g, C(42, 38, 34, 245), new PointF(cx + 60, cy - 17), new PointF(cx + 70, cy - 36), new PointF(cx + 72, cy - 16));
        using (var p = new Pen(C(47, 41, 36, 238), 8.5f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            float tailLift = (float)Math.Sin(phase) * 10f;
            g.DrawBezier(p, cx - 58, cy - 4, cx - 82, cy - 22 + tailLift, cx - 104, cy - 4 - tailLift, cx - 90, cy + 18);
        }
        FillEllipse(g, C(199, 143, 79, 220), cx + 58, cy - 4, 4.6f, 4.6f);
    }

    private static void DrawLeg(Graphics g, Color color, float x, float y, float phase, bool longStride, float length, float width)
    {
        float stride = (float)Math.Sin(phase) * (longStride ? 14f : 10f);
        float knee = y + length * .45f;
        float footX = x + stride;
        float footY = y + length;
        using (var p = new Pen(color, width))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            g.DrawBezier(p, x, y, x + stride * .3f, knee, footX - stride * .2f, knee, footX, footY);
        }
        FillEllipse(g, C(30, 24, 20, 205), footX - width * .8f, footY - width * .35f, width * 1.8f, width * .75f);
    }

    private static PointF[] BlobPoints(float cx, float cy, float rx, float ry, int count, float jitter)
    {
        PointF[] points = new PointF[count];
        for (int i = 0; i < count; i++)
        {
            double a = i * Math.PI * 2.0 / count;
            float j = 1f + Rand(-jitter, jitter);
            points[i] = new PointF(cx + (float)Math.Cos(a) * rx * j, cy + (float)Math.Sin(a) * ry * j);
        }
        return points;
    }

    private static GraphicsPath ClosedPath(PointF[] points, float tension)
    {
        var path = new GraphicsPath();
        path.AddClosedCurve(points, tension);
        return path;
    }

    private static void FillClosed(Graphics g, Color color, PointF[] points, float tension)
    {
        using (var path = ClosedPath(points, tension))
        using (var brush = new SolidBrush(color))
        {
            g.FillPath(brush, path);
        }
    }

    private static void FillEllipse(Graphics g, Color color, float x, float y, float w, float h)
    {
        using (var brush = new SolidBrush(color)) { g.FillEllipse(brush, x, y, w, h); }
    }

    private static void FillRect(Graphics g, Color color, float x, float y, float w, float h)
    {
        using (var brush = new SolidBrush(color)) { g.FillRectangle(brush, x, y, w, h); }
    }

    private static void FillPolygon(Graphics g, Color color, params PointF[] points)
    {
        using (var brush = new SolidBrush(color)) { g.FillPolygon(brush, points); }
    }

    private static void FillRotatedEllipse(Graphics g, Color color, float cx, float cy, float w, float h, float degrees)
    {
        var state = g.Save();
        g.TranslateTransform(cx, cy);
        g.RotateTransform(degrees);
        FillEllipse(g, color, -w / 2f, -h / 2f, w, h);
        g.Restore(state);
    }

    private static float Rand(float min, float max)
    {
        return (float)(min + Rng.NextDouble() * (max - min));
    }

    private static Color C(int r, int g, int b, int a = 255)
    {
        return Color.FromArgb(a, r, g, b);
    }

    private static Color Mix(Color a, Color b, float t)
    {
        return Color.FromArgb(
            (int)(a.A + (b.A - a.A) * t),
            (int)(a.R + (b.R - a.R) * t),
            (int)(a.G + (b.G - a.G) * t),
            (int)(a.B + (b.B - a.B) * t));
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies System.Drawing
$resolvedOutDir = [System.IO.Path]::GetFullPath($OutDir)
[RealisticAssetGenerator]::Generate($resolvedOutDir)
Write-Host "Generated realistic terrain and creature assets in $resolvedOutDir"
