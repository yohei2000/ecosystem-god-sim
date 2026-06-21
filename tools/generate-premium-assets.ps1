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

public static class PremiumAssetGenerator
{
    private const int TerrainFrame = 512;
    private const int CreatureFrame = 192;
    private static readonly Random Rng = new Random(421337);

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
            Configure(g);
            g.Clear(Color.Transparent);
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
        using (var bmp = new Bitmap(CreatureFrame * 4, CreatureFrame * 9, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(bmp))
        {
            Configure(g);
            g.Clear(Color.Transparent);
            for (int frame = 0; frame < 4; frame++)
            {
                DrawCreatureFrame(g, frame, 0, "hare");
                DrawCreatureFrame(g, frame, 1, "deer");
                DrawCreatureFrame(g, frame, 2, "boar");
                DrawCreatureFrame(g, frame, 3, "wolf");
                DrawCreatureFrame(g, frame, 4, "fox");
                DrawCreatureFrame(g, frame, 5, "bear");
                DrawCreatureFrame(g, frame, 6, "vulture");
                DrawCreatureFrame(g, frame, 7, "lynx");
                DrawCreatureFrame(g, frame, 8, "panther");
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
        FillBlob(g, C(8, 38, 22, 130), ox + 256, 286, 210, 142, 34, .16f);
        FillBlob(g, C(16, 68, 34, 150), ox + 250, 248, 196, 132, 36, .2f);
        for (int i = 0; i < 150; i++)
        {
            float x = ox + Rand(82, 430);
            float y = Rand(78, 420);
            float s = Rand(34, 74);
            DrawTree(g, x, y, s, i % 4);
        }
        using (var p = new Pen(C(10, 31, 18, 65), 6f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 34; i++)
            {
                float x = ox + Rand(58, 450);
                float y = Rand(116, 438);
                g.DrawLine(p, x, y, x + Rand(-28, 26), y + Rand(18, 48));
            }
        }
        AddSoftShadow(g, ox + 70, 342, 370, 70, C(0, 0, 0, 36));
    }

    private static void DrawMountainStamp(Graphics g, int col)
    {
        float ox = col * TerrainFrame;
        FillBlob(g, C(57, 65, 62, 115), ox + 260, 374, 222, 74, 18, .14f);
        DrawPeak(g, ox + 92, 404, 150, 238, C(89, 98, 94, 248), C(239, 241, 232, 250));
        DrawPeak(g, ox + 214, 420, 226, 324, C(64, 75, 75, 255), C(247, 248, 238, 252));
        DrawPeak(g, ox + 366, 398, 176, 246, C(97, 103, 96, 246), C(219, 224, 214, 240));
        using (var p = new Pen(C(27, 34, 34, 115), 7f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            g.DrawLine(p, ox + 214, 78, ox + 150, 414);
            g.DrawLine(p, ox + 216, 78, ox + 302, 420);
            g.DrawLine(p, ox + 366, 136, ox + 414, 398);
            g.DrawLine(p, ox + 92, 160, ox + 56, 404);
        }
        for (int i = 0; i < 230; i++)
        {
            FillEllipse(g, Rng.Next(2) == 0 ? C(32, 40, 39, 86) : C(156, 163, 151, 72), ox + Rand(50, 466), Rand(160, 430), Rand(2.2f, 7.5f), Rand(1.5f, 5.2f));
        }
        AddSoftShadow(g, ox + 66, 396, 380, 50, C(0, 0, 0, 34));
    }

    private static void DrawLakeStamp(Graphics g, int col)
    {
        float ox = col * TerrainFrame;
        FillBlob(g, C(185, 170, 106, 170), ox + 258, 270, 216, 142, 38, .24f);
        FillBlob(g, C(31, 116, 169, 255), ox + 258, 264, 190, 118, 42, .2f);
        using (var brush = new LinearGradientBrush(new RectangleF(ox + 70, 126, 380, 260), C(79, 189, 222, 240), C(16, 90, 151, 248), 90f))
        using (var path = BlobPath(ox + 258, 264, 186, 114, 42, .2f))
        {
            g.FillPath(brush, path);
        }
        using (var p = new Pen(C(218, 248, 250, 170), 6f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 10; i++)
            {
                float y = 152 + i * 22;
                g.DrawBezier(p, ox + 104, y, ox + 156, y - 18, ox + 188, y + 18, ox + 236, y);
                g.DrawBezier(p, ox + 220, y + 9, ox + 274, y - 16, ox + 320, y + 18, ox + 394, y + 2);
            }
        }
        for (int i = 0; i < 36; i++)
        {
            FillEllipse(g, C(219, 201, 135, 116), ox + Rand(52, 440), Rand(170, 382), Rand(18, 52), Rand(8, 22));
        }
        AddSoftShadow(g, ox + 86, 365, 350, 50, C(0, 0, 0, 24));
    }

    private static void DrawWastelandStamp(Graphics g, int col)
    {
        float ox = col * TerrainFrame;
        FillBlob(g, C(139, 109, 70, 240), ox + 258, 272, 212, 146, 42, .28f);
        FillBlob(g, C(104, 80, 54, 130), ox + 252, 266, 162, 104, 24, .24f);
        for (int i = 0; i < 260; i++)
        {
            FillEllipse(g, Rng.Next(2) == 0 ? C(70, 54, 37, 115) : C(188, 148, 89, 116), ox + Rand(60, 452), Rand(96, 420), Rand(2, 9), Rand(1.4f, 6));
        }
        using (var p = new Pen(C(47, 35, 26, 176), 5.2f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 34; i++)
            {
                float x = ox + Rand(82, 430);
                float y = Rand(124, 390);
                g.DrawLine(p, x, y, x + Rand(-62, 62), y + Rand(20, 64));
                g.DrawLine(p, x, y, x + Rand(-42, 42), y + Rand(-52, -12));
            }
        }
        AddSoftShadow(g, ox + 70, 372, 372, 54, C(0, 0, 0, 28));
    }

    private static void DrawCraterStamp(Graphics g, int col)
    {
        float ox = col * TerrainFrame;
        AddSoftShadow(g, ox + 86, 356, 350, 72, C(0, 0, 0, 58));
        FillEllipse(g, C(111, 86, 64, 230), ox + 80, 82, 360, 320);
        FillEllipse(g, C(71, 56, 47, 240), ox + 110, 112, 300, 260);
        FillEllipse(g, C(35, 31, 29, 255), ox + 148, 150, 226, 188);
        FillEllipse(g, C(18, 18, 17, 250), ox + 186, 186, 150, 112);
        FillEllipse(g, C(214, 91, 42, 88), ox + 214, 212, 98, 48);
        using (var p = new Pen(C(30, 25, 23, 132), 5f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 40; i++)
            {
                double a = i * Math.PI * 2 / 40.0 + Rand(-.1f, .1f);
                float x1 = ox + 260 + (float)Math.Cos(a) * Rand(124, 156);
                float y1 = 244 + (float)Math.Sin(a) * Rand(102, 136);
                float x2 = ox + 260 + (float)Math.Cos(a) * Rand(170, 226);
                float y2 = 244 + (float)Math.Sin(a) * Rand(144, 212);
                g.DrawLine(p, x1, y1, x2, y2);
            }
        }
        for (int i = 0; i < 180; i++)
        {
            double a = Rng.NextDouble() * Math.PI * 2;
            float r = Rand(80, 210);
            FillEllipse(g, C(159, 125, 89, 120), ox + 260 + (float)Math.Cos(a) * r, 244 + (float)Math.Sin(a) * r * .78f, Rand(3, 9), Rand(2, 7));
        }
    }

    private static void DrawCreatureFrame(Graphics g, int frame, int row, string species)
    {
        float ox = frame * CreatureFrame;
        float oy = row * CreatureFrame;
        g.ResetTransform();
        g.TranslateTransform(ox, oy);
        float walk = (frame - 1.5f) * 3f;
        AddSoftShadow(g, 36, 134, 120, 20, C(0, 0, 0, 56));
        switch (species)
        {
            case "hare": DrawHare(g, walk); break;
            case "deer": DrawDeer(g, walk); break;
            case "boar": DrawBoar(g, walk); break;
            case "wolf": DrawWolf(g, walk); break;
            case "fox": DrawFox(g, walk); break;
            case "bear": DrawBear(g, walk); break;
            case "vulture": DrawVulture(g, walk); break;
            case "lynx": DrawLynx(g, walk); break;
            case "panther": DrawPanther(g, walk); break;
        }
        g.ResetTransform();
    }

    private static void DrawHare(Graphics g, float walk)
    {
        DrawLegs(g, C(88, 58, 34, 225), 70, 124, 78, walk, .7f);
        FillEllipse(g, C(184, 132, 78, 245), 52, 76, 78, 48);
        FillEllipse(g, C(218, 166, 100, 235), 66, 84, 44, 26);
        FillEllipse(g, C(195, 142, 88, 245), 118, 70, 34, 28);
        FillEllipse(g, C(245, 230, 193, 230), 45, 86, 18, 18);
        using (var p = new Pen(C(91, 55, 33, 245), 7f)) { p.StartCap = p.EndCap = LineCap.Round; g.DrawLine(p, 129, 72, 124, 38); g.DrawLine(p, 141, 74, 146, 40); }
        FillEllipse(g, C(30, 24, 18, 255), 142, 82, 4, 4);
    }

    private static void DrawDeer(Graphics g, float walk)
    {
        DrawLegs(g, C(91, 54, 31, 235), 66, 130, 96, walk, 1.15f);
        FillEllipse(g, C(168, 105, 55, 250), 48, 72, 100, 48);
        FillEllipse(g, C(203, 146, 78, 230), 62, 78, 56, 25);
        FillEllipse(g, C(184, 116, 61, 250), 136, 64, 34, 30);
        using (var p = new Pen(C(69, 43, 25, 245), 4f)) { p.StartCap = p.EndCap = LineCap.Round; DrawAntler(g, p, 148, 66, -1); DrawAntler(g, p, 158, 66, 1); }
        FillEllipse(g, C(247, 230, 195, 230), 42, 78, 16, 16);
        FillEllipse(g, C(28, 20, 15, 255), 160, 76, 4, 4);
    }

    private static void DrawBoar(Graphics g, float walk)
    {
        DrawLegs(g, C(43, 31, 24, 245), 56, 130, 106, walk, .9f);
        FillEllipse(g, C(92, 59, 43, 252), 42, 74, 112, 56);
        FillEllipse(g, C(116, 75, 48, 235), 54, 80, 68, 30);
        FillEllipse(g, C(82, 53, 39, 252), 138, 76, 38, 34);
        FillEllipse(g, C(36, 28, 23, 255), 166, 90, 8, 8);
        using (var p = new Pen(C(238, 216, 178, 245), 4f)) { p.StartCap = p.EndCap = LineCap.Round; g.DrawArc(p, 160, 92, 22, 16, 250, 70); }
        using (var p = new Pen(C(55, 35, 25, 240), 5f)) { p.StartCap = p.EndCap = LineCap.Round; g.DrawLine(p, 92, 72, 90, 56); g.DrawLine(p, 104, 72, 110, 54); }
    }

    private static void DrawWolf(Graphics g, float walk)
    {
        DrawLegs(g, C(36, 36, 34, 245), 58, 128, 106, walk, 1f);
        FillEllipse(g, C(87, 91, 86, 250), 44, 76, 112, 42);
        FillEllipse(g, C(114, 120, 112, 225), 62, 78, 58, 22);
        FillEllipse(g, C(67, 69, 66, 252), 142, 70, 40, 28);
        FillPolygon(g, C(43, 45, 43, 245), new PointF[] { P(151,70), P(158,48), P(164,72) });
        FillPolygon(g, C(43, 45, 43, 245), new PointF[] { P(168,73), P(176,54), P(176,80) });
        using (var p = new Pen(C(48, 50, 48, 245), 9f)) { p.StartCap = p.EndCap = LineCap.Round; g.DrawBezier(p, 44, 88, 18, 68, 16, 112, 38, 104); }
        FillEllipse(g, C(234, 178, 65, 255), 170, 80, 5, 5);
    }

    private static void DrawFox(Graphics g, float walk)
    {
        DrawLegs(g, C(78, 38, 22, 245), 58, 128, 98, walk, .95f);
        FillEllipse(g, C(213, 105, 40, 252), 44, 76, 104, 42);
        FillEllipse(g, C(240, 157, 70, 230), 60, 78, 54, 22);
        FillEllipse(g, C(214, 103, 38, 252), 134, 70, 40, 28);
        FillPolygon(g, C(90, 45, 27, 245), new PointF[] { P(146,70), P(152,50), P(160,72) });
        using (var p = new Pen(C(196, 89, 34, 245), 11f)) { p.StartCap = p.EndCap = LineCap.Round; g.DrawBezier(p, 46, 88, 14, 66, 14, 112, 42, 106); }
        FillEllipse(g, C(242, 232, 204, 240), 24, 96, 18, 14);
        FillEllipse(g, C(28, 20, 16, 255), 164, 80, 4, 4);
    }

    private static void DrawBear(Graphics g, float walk)
    {
        DrawLegs(g, C(42, 28, 22, 250), 50, 134, 112, walk, 1.2f);
        FillEllipse(g, C(75, 48, 36, 255), 34, 68, 128, 66);
        FillEllipse(g, C(104, 68, 45, 230), 54, 78, 70, 34);
        FillEllipse(g, C(67, 43, 32, 255), 140, 70, 44, 36);
        FillEllipse(g, C(47, 31, 25, 255), 146, 62, 12, 12);
        FillEllipse(g, C(47, 31, 25, 255), 166, 64, 12, 12);
        FillEllipse(g, C(20, 16, 13, 255), 174, 86, 7, 6);
    }

    private static void DrawVulture(Graphics g, float walk)
    {
        FillEllipse(g, C(26, 26, 24, 250), 42, 76, 112, 48);
        using (var p = new Pen(C(18, 18, 17, 245), 18f)) { p.StartCap = p.EndCap = LineCap.Round; g.DrawBezier(p, 62, 90, 26, 66, 16, 116, 48, 124); g.DrawBezier(p, 112, 88, 150, 58, 164, 112, 132, 124); }
        FillEllipse(g, C(230, 221, 198, 245), 142, 66, 30, 26);
        FillPolygon(g, C(203, 158, 65, 245), new PointF[] { P(168,78), P(186,84), P(168,90) });
        DrawLegs(g, C(60, 48, 35, 220), 72, 130, 92, walk, .5f);
        FillEllipse(g, C(30, 22, 16, 255), 158, 75, 4, 4);
    }

    private static void DrawLynx(Graphics g, float walk)
    {
        DrawLegs(g, C(71, 50, 35, 245), 58, 128, 100, walk, .9f);
        FillEllipse(g, C(178, 121, 64, 252), 42, 74, 108, 44);
        FillEllipse(g, C(220, 159, 88, 226), 58, 78, 58, 22);
        FillEllipse(g, C(169, 110, 57, 252), 136, 68, 40, 30);
        FillPolygon(g, C(78, 49, 31, 245), new PointF[] { P(145,68), P(148,44), P(158,70) });
        FillPolygon(g, C(78, 49, 31, 245), new PointF[] { P(165,70), P(174,48), P(174,76) });
        using (var p = new Pen(C(80, 50, 31, 245), 7f)) { p.StartCap = p.EndCap = LineCap.Round; g.DrawBezier(p, 44, 88, 26, 80, 24, 112, 42, 106); }
        for (int i = 0; i < 18; i++)
        {
            FillEllipse(g, C(62, 42, 28, 155), Rand(56, 138), Rand(78, 108), Rand(2.2f, 4.8f), Rand(1.6f, 3.6f));
        }
        using (var p = new Pen(C(233, 225, 203, 200), 2.5f)) { p.StartCap = p.EndCap = LineCap.Round; g.DrawLine(p, 162, 86, 176, 82); g.DrawLine(p, 162, 90, 177, 91); }
        FillEllipse(g, C(49, 33, 22, 255), 164, 80, 4.5f, 4.5f);
    }

    private static void DrawPanther(Graphics g, float walk)
    {
        DrawLegs(g, C(17, 18, 20, 250), 56, 130, 110, walk, 1.05f);
        FillEllipse(g, C(25, 28, 31, 255), 38, 76, 118, 42);
        FillEllipse(g, C(48, 53, 58, 190), 58, 79, 64, 18);
        FillEllipse(g, C(18, 20, 23, 255), 142, 70, 42, 28);
        FillPolygon(g, C(12, 14, 16, 248), new PointF[] { P(150,70), P(156,50), P(162,72) });
        FillPolygon(g, C(12, 14, 16, 248), new PointF[] { P(168,73), P(176,55), P(178,78) });
        using (var p = new Pen(C(18, 20, 23, 250), 10f)) { p.StartCap = p.EndCap = LineCap.Round; g.DrawBezier(p, 42, 88, 10, 72, 13, 116, 42, 106); }
        using (var p = new Pen(C(72, 78, 86, 84), 3.4f)) { p.StartCap = p.EndCap = LineCap.Round; g.DrawLine(p, 74, 82, 126, 82); g.DrawLine(p, 62, 94, 132, 96); }
        FillEllipse(g, C(104, 197, 143, 255), 166, 79, 5, 5);
    }

    private static void DrawLegs(Graphics g, Color color, float x, float y, float width, float walk, float scale)
    {
        using (var p = new Pen(color, 5f * scale))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            g.DrawLine(p, x, y - 18, x - walk, y + 14);
            g.DrawLine(p, x + width * .28f, y - 18, x + width * .28f + walk, y + 14);
            g.DrawLine(p, x + width * .58f, y - 16, x + width * .58f - walk, y + 14);
            g.DrawLine(p, x + width * .82f, y - 16, x + width * .82f + walk, y + 14);
        }
    }

    private static void DrawTree(Graphics g, float x, float y, float s, int type)
    {
        FillEllipse(g, C(4, 22, 12, 64), x - s * .46f, y + s * .17f, s * .94f, s * .42f);
        FillRect(g, C(91, 61, 36, 168), x - s * .035f, y + s * .12f, s * .07f, s * .36f);
        Color dark = type == 0 ? C(20, 70, 34, 248) : type == 1 ? C(27, 91, 45, 248) : C(18, 83, 38, 248);
        Color mid = type == 0 ? C(51, 137, 62, 238) : type == 1 ? C(66, 153, 69, 236) : C(45, 126, 70, 236);
        FillEllipse(g, dark, x - s * .5f, y - s * .52f, s, s);
        FillEllipse(g, mid, x - s * .34f, y - s * .42f, s * .72f, s * .68f);
        FillEllipse(g, C(134, 190, 94, 190), x - s * .16f, y - s * .36f, s * .32f, s * .28f);
    }

    private static void DrawPeak(Graphics g, float x, float baseY, float width, float height, Color rock, Color snow)
    {
        PointF top = P(x, baseY - height);
        PointF left = P(x - width * .5f, baseY);
        PointF right = P(x + width * .5f, baseY);
        FillPolygon(g, rock, new PointF[] { top, left, right });
        FillPolygon(g, C(35, 45, 45, 92), new PointF[] { top, P(x, baseY), right });
        FillPolygon(g, snow, new PointF[] { top, P(x - width * .18f, baseY - height * .58f), P(x + width * .08f, baseY - height * .48f), P(x + width * .22f, baseY - height * .62f) });
    }

    private static void DrawAntler(Graphics g, Pen p, float x, float y, int side)
    {
        g.DrawLine(p, x, y, x + side * 8, y - 24);
        g.DrawLine(p, x + side * 5, y - 12, x + side * 18, y - 22);
        g.DrawLine(p, x + side * 8, y - 22, x + side * 20, y - 36);
    }

    private static void FillBlob(Graphics g, Color color, float cx, float cy, float rx, float ry, int points, float wobble)
    {
        using (var path = BlobPath(cx, cy, rx, ry, points, wobble))
        using (var brush = new SolidBrush(color))
        {
            g.FillPath(brush, path);
        }
    }

    private static GraphicsPath BlobPath(float cx, float cy, float rx, float ry, int points, float wobble)
    {
        PointF[] pts = new PointF[points];
        for (int i = 0; i < points; i++)
        {
            double a = Math.PI * 2 * i / points;
            float r = 1f + Rand(-wobble, wobble);
            pts[i] = P(cx + (float)Math.Cos(a) * rx * r, cy + (float)Math.Sin(a) * ry * r);
        }
        var path = new GraphicsPath();
        path.AddClosedCurve(pts, .55f);
        return path;
    }

    private static void AddSoftShadow(Graphics g, float x, float y, float w, float h, Color color)
    {
        FillEllipse(g, color, x, y, w, h);
    }

    private static void FillEllipse(Graphics g, Color color, float x, float y, float w, float h)
    {
        using (var b = new SolidBrush(color)) { g.FillEllipse(b, x, y, w, h); }
    }

    private static void FillRect(Graphics g, Color color, float x, float y, float w, float h)
    {
        using (var b = new SolidBrush(color)) { g.FillRectangle(b, x, y, w, h); }
    }

    private static void FillPolygon(Graphics g, Color color, PointF[] points)
    {
        using (var b = new SolidBrush(color)) { g.FillPolygon(b, points); }
    }

    private static Color C(int r, int g, int b, int a) { return Color.FromArgb(a, r, g, b); }
    private static PointF P(float x, float y) { return new PointF(x, y); }
    private static float Rand(float min, float max) { return min + (float)Rng.NextDouble() * (max - min); }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies System.Drawing
[PremiumAssetGenerator]::Generate((Resolve-Path $OutDir).Path)
