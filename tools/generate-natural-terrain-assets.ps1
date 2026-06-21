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

public static class NaturalTerrainAssetGenerator
{
    private const int Tile = 128;
    private const int Stamp = 512;
    private static readonly Random Rng = new Random(914231);

    public static void Generate(string outDir)
    {
        Directory.CreateDirectory(outDir);
        DrawTerrainAtlas(Path.Combine(outDir, "terrain-atlas.png"));
        DrawTerrainStamps(Path.Combine(outDir, "terrain-stamps.png"));
    }

    private static void DrawTerrainAtlas(string path)
    {
        using (var bmp = new Bitmap(Tile * 4, Tile * 2, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(bmp))
        {
            Configure(g);
            DrawNaturalTile(bmp, 0, 0, "grass");
            DrawNaturalTile(bmp, 1, 0, "forest");
            DrawNaturalTile(bmp, 2, 0, "water");
            DrawNaturalTile(bmp, 3, 0, "wasteland");
            DrawNaturalTile(bmp, 0, 1, "crater");
            DrawNaturalTile(bmp, 1, 1, "mountain");
            DrawNaturalTile(bmp, 2, 1, "ash");
            DrawNaturalTile(bmp, 3, 1, "meadow");
            AddTileDetails(g);
            bmp.Save(path, ImageFormat.Png);
        }
    }

    private static void DrawTerrainStamps(string path)
    {
        using (var bmp = new Bitmap(Stamp * 5, Stamp, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(bmp))
        {
            Configure(g);
            g.Clear(Color.Transparent);
            DrawStampTexture(bmp, 0, "forest");
            DrawStampTexture(bmp, 1, "mountain");
            DrawStampTexture(bmp, 2, "lake");
            DrawStampTexture(bmp, 3, "wasteland");
            DrawStampTexture(bmp, 4, "crater");
            AddNaturalStampDetails(g);
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

    private static void DrawNaturalTile(Bitmap bmp, int col, int row, string type)
    {
        int ox = col * Tile;
        int oy = row * Tile;
        for (int y = 0; y < Tile; y++)
        {
            for (int x = 0; x < Tile; x++)
            {
                float nx = (x + ox) / 128f;
                float ny = (y + oy) / 128f;
                float broad = Fbm(nx * 1.35f, ny * 1.35f, 4, 17);
                float grain = Fbm(nx * 7.7f, ny * 7.7f, 3, 91);
                float ridge = Math.Abs(Fbm(nx * 5.1f, ny * 8.4f, 3, 271) - .5f) * 2f;
                Color c;
                if (type == "grass")
                {
                    c = Mix(C(50, 101, 43), C(113, 159, 62), broad * .62f + grain * .28f);
                    c = Shade(c, (grain - .5f) * 34f);
                }
                else if (type == "forest")
                {
                    c = Mix(C(12, 45, 25), C(48, 105, 47), broad * .7f + grain * .25f);
                    if (grain > .66f) c = Mix(c, C(84, 132, 62), .28f);
                    if (ridge > .78f) c = Mix(c, C(4, 27, 18), .3f);
                }
                else if (type == "water")
                {
                    c = Mix(C(16, 72, 112), C(48, 147, 188), broad * .52f + grain * .22f);
                    if (ridge > .82f) c = Mix(c, C(180, 232, 239), .35f);
                }
                else if (type == "wasteland")
                {
                    c = Mix(C(74, 61, 41), C(148, 119, 72), broad * .58f + grain * .28f);
                    if (ridge > .86f) c = Mix(c, C(44, 35, 27), .35f);
                }
                else if (type == "crater")
                {
                    float cx = (x - 64) / 54f;
                    float cy = (y - 64) / 46f;
                    float d = (float)Math.Sqrt(cx * cx + cy * cy);
                    c = Mix(C(36, 34, 32), C(104, 89, 72), broad * .4f + grain * .25f);
                    if (d < .92f) c = Mix(c, C(27, 25, 24), .78f);
                    if (d > .78f && d < 1.17f) c = Mix(c, C(122, 96, 70), .62f);
                    if (d < .42f) c = Mix(c, C(12, 12, 12), .64f);
                    if (d < .22f) c = Mix(c, C(188, 78, 35), .25f);
                }
                else if (type == "mountain")
                {
                    c = Mix(C(57, 65, 63), C(129, 135, 124), broad * .45f + ridge * .42f);
                    if (ridge > .83f) c = Mix(c, C(216, 220, 209), .35f);
                    if (grain < .24f) c = Mix(c, C(31, 38, 38), .34f);
                }
                else if (type == "ash")
                {
                    c = Mix(C(44, 43, 40), C(105, 98, 87), broad * .44f + grain * .25f);
                    if (ridge > .88f) c = Mix(c, C(196, 98, 54), .28f);
                    if (grain < .2f) c = Mix(c, C(17, 16, 15), .38f);
                }
                else
                {
                    c = Mix(C(56, 119, 43), C(143, 190, 72), broad * .62f + grain * .25f);
                    if (grain > .86f) c = Mix(c, C(235, 211, 99), .34f);
                    if (ridge > .92f) c = Mix(c, C(227, 152, 164), .24f);
                }
                bmp.SetPixel(ox + x, oy + y, c);
            }
        }
    }

    private static void AddTileDetails(Graphics g)
    {
        using (var p = new Pen(C(176, 222, 101, 155), 1.2f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 120; i++)
            {
                float x = Rand(4, 124);
                float y = Rand(10, 126);
                g.DrawLine(p, x, y, x + Rand(-4, 5), y - Rand(5, 16));
            }
        }
        using (var p = new Pen(C(205, 243, 246, 142), 2.2f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 9; i++)
            {
                float y = 20 + i * 12 + Rand(-2, 3);
                g.DrawBezier(p, 262, y, 286, y - 8, 306, y + 8, 330, y);
                g.DrawBezier(p, 322, y + 4, 348, y - 9, 368, y + 8, 386, y + 1);
            }
        }
        using (var p = new Pen(C(49, 38, 29, 148), 2.1f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 26; i++)
            {
                float x = 390 + Rand(12, 110);
                float y = Rand(16, 118);
                g.DrawLine(p, x, y, x + Rand(-20, 20), y + Rand(8, 24));
                g.DrawLine(p, x, y, x + Rand(-14, 14), y + Rand(-20, -5));
            }
        }
        using (var p = new Pen(C(32, 38, 37, 125), 2f))
        {
            for (int i = 0; i < 14; i++)
            {
                float x = 148 + Rand(10, 112);
                float y = 150 + Rand(5, 94);
                g.DrawLine(p, x, y, x + Rand(-18, 18), y + Rand(20, 50));
            }
        }
    }

    private static void DrawStampTexture(Bitmap bmp, int col, string type)
    {
        int ox = col * Stamp;
        for (int y = 0; y < Stamp; y++)
        {
            for (int x = 0; x < Stamp; x++)
            {
                float lx = x - 256f;
                float ly = y - 260f;
                float nx = (ox + x) / 512f;
                float ny = y / 512f;
                float broad = Fbm(nx * 2.1f, ny * 2.1f, 5, 811 + col * 97);
                float grain = Fbm(nx * 13.2f, ny * 13.2f, 4, 1421 + col * 131);
                float detail = Fbm(nx * 42.0f, ny * 42.0f, 2, 3671 + col * 199);
                float shape = 1f + (broad - .5f) * .38f + (grain - .5f) * .14f;
                float d = (float)Math.Sqrt((lx / 222f) * (lx / 222f) + (ly / 150f) * (ly / 150f));
                float alphaF = (shape - d) * 5.5f;
                if (type == "mountain") alphaF = (shape - (float)Math.Sqrt((lx / 214f) * (lx / 214f) + (ly / 168f) * (ly / 168f))) * 5.2f;
                if (type == "lake") alphaF = (shape - (float)Math.Sqrt((lx / 218f) * (lx / 218f) + (ly / 132f) * (ly / 132f))) * 6.5f;
                if (type == "crater") alphaF = (1.02f - (float)Math.Sqrt((lx / 205f) * (lx / 205f) + (ly / 170f) * (ly / 170f))) * 6.5f;
                int alpha = Clamp(alphaF * 255f);
                if (alpha <= 0)
                {
                    bmp.SetPixel(ox + x, y, Color.Transparent);
                    continue;
                }

                Color c;
                if (type == "forest")
                {
                    c = Mix(C(8, 42, 23), C(63, 127, 55), broad * .48f + grain * .36f);
                    if (detail > .68f) c = Mix(c, C(116, 167, 82), .32f);
                    if (detail < .25f) c = Mix(c, C(2, 24, 14), .36f);
                }
                else if (type == "mountain")
                {
                    float ridge = Math.Abs(Fbm(nx * 8.6f, ny * 15.4f, 4, 5581) - .5f) * 2f;
                    float height = broad * .42f + ridge * .46f + grain * .16f;
                    c = Mix(C(47, 56, 55), C(153, 158, 146), height);
                    if (height > .82f && y < 370) c = Mix(c, C(229, 232, 222), .52f);
                    if (ridge > .88f) c = Mix(c, C(24, 31, 32), .38f);
                }
                else if (type == "lake")
                {
                    float edge = Math.Max(0f, Math.Min(1f, (d - .82f) * 6f));
                    Color water = Mix(C(16, 89, 147), C(78, 184, 214), broad * .48f + grain * .2f);
                    Color shore = Mix(C(151, 134, 82), C(219, 194, 124), grain * .55f);
                    c = Mix(water, shore, edge);
                    if (detail > .84f && edge < .32f) c = Mix(c, C(205, 241, 246), .22f);
                }
                else if (type == "wasteland")
                {
                    c = Mix(C(82, 61, 39), C(163, 124, 73), broad * .55f + grain * .28f);
                    if (detail < .24f) c = Mix(c, C(38, 29, 22), .3f);
                    if (detail > .83f) c = Mix(c, C(205, 159, 92), .22f);
                }
                else
                {
                    float cd = (float)Math.Sqrt((lx / 168f) * (lx / 168f) + (ly / 130f) * (ly / 130f));
                    c = Mix(C(92, 73, 55), C(142, 108, 73), broad * .4f + grain * .3f);
                    if (cd < .9f) c = Mix(c, C(48, 39, 34), .62f);
                    if (cd < .56f) c = Mix(c, C(18, 17, 16), .68f);
                    if (cd > .83f && cd < 1.2f) c = Mix(c, C(151, 114, 76), .55f);
                    if (cd < .26f && grain > .48f) c = Mix(c, C(210, 88, 39), .25f);
                }
                bmp.SetPixel(ox + x, y, Color.FromArgb(alpha, c.R, c.G, c.B));
            }
        }
    }

    private static void AddNaturalStampDetails(Graphics g)
    {
        using (var p = new Pen(C(217, 246, 250, 82), 2.2f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 22; i++)
            {
                float x = 2 * Stamp + Rand(104, 382);
                float y = Rand(156, 348);
                float len = Rand(34, 92);
                g.DrawBezier(p, x, y, x + len * .28f, y - Rand(5, 12), x + len * .66f, y + Rand(4, 11), x + len, y + Rand(-3, 4));
            }
        }
        using (var dark = new Pen(C(25, 32, 32, 124), 4.2f))
        using (var light = new Pen(C(226, 229, 219, 74), 3.2f))
        {
            dark.StartCap = dark.EndCap = LineCap.Round;
            light.StartCap = light.EndCap = LineCap.Round;
            for (int i = 0; i < 18; i++)
            {
                float x = Stamp + Rand(86, 424);
                float y = Rand(126, 382);
                float sx = Rand(-38, 38);
                float sy = Rand(-76, -26);
                g.DrawLine(dark, x, y, x + sx, y + sy);
                if (i % 2 == 0) g.DrawLine(light, x + Rand(-8, 8), y + Rand(-8, 8), x + sx * .62f, y + sy * .62f);
            }
        }
        using (var p = new Pen(C(45, 33, 24, 150), 3.2f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 38; i++)
            {
                float x = 3 * Stamp + Rand(78, 434);
                float y = Rand(122, 400);
                g.DrawLine(p, x, y, x + Rand(-60, 58), y + Rand(18, 62));
                g.DrawLine(p, x, y, x + Rand(-42, 42), y + Rand(-52, -10));
            }
        }
        using (var p = new Pen(C(26, 22, 20, 130), 4.4f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 40; i++)
            {
                double a = i * Math.PI * 2 / 40.0 + Rand(-.1f, .1f);
                float x1 = 4 * Stamp + 256 + (float)Math.Cos(a) * Rand(120, 150);
                float y1 = 250 + (float)Math.Sin(a) * Rand(98, 128);
                float x2 = 4 * Stamp + 256 + (float)Math.Cos(a) * Rand(170, 225);
                float y2 = 250 + (float)Math.Sin(a) * Rand(142, 205);
                g.DrawLine(p, x1, y1, x2, y2);
            }
        }
        for (int i = 0; i < 420; i++)
        {
            FillEllipse(g, Rng.Next(2) == 0 ? C(238, 238, 224, 70) : C(21, 27, 27, 74), Stamp + Rand(44, 468), Rand(148, 438), Rand(1.5f, 6f), Rand(1.2f, 5f));
        }
        for (int i = 0; i < 260; i++)
        {
            FillEllipse(g, C(2, 19, 10, 46), Rand(48, 466), Rand(94, 436), Rand(2f, 8f), Rand(1.6f, 5f));
        }
    }

    private static void DrawForestStamp(Graphics g, int col)
    {
        float ox = col * Stamp;
        using (var shadow = new SolidBrush(C(0, 18, 9, 62)))
        using (var blob = BlobPath(ox + 256, 306, 212, 132, 46, .18f))
        {
            g.FillPath(shadow, blob);
        }
        for (int i = 0; i < 230; i++)
        {
            float x = ox + Rand(60, 452);
            float y = Rand(70, 425);
            float s = Rand(22, 58);
            float mask = EllipseMask((x - (ox + 256)) / 210f, (y - 250) / 170f);
            if (mask > 1.18f) continue;
            DrawTreeCrown(g, x, y, s, i);
        }
        using (var p = new Pen(C(8, 30, 16, 72), 5f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 38; i++)
            {
                float x = ox + Rand(72, 430);
                float y = Rand(126, 426);
                g.DrawLine(p, x, y, x + Rand(-26, 28), y + Rand(20, 52));
            }
        }
    }

    private static void DrawMountainStamp(Graphics g, int col)
    {
        float ox = col * Stamp;
        FillBlob(g, C(40, 48, 47, 88), ox + 260, 386, 226, 58, 28, .15f);
        DrawPeak(g, ox + 88, 414, 150, 248, C(93, 101, 96), C(230, 233, 224));
        DrawPeak(g, ox + 198, 430, 226, 336, C(63, 73, 73), C(244, 246, 237));
        DrawPeak(g, ox + 336, 424, 176, 286, C(82, 88, 82), C(215, 221, 211));
        DrawPeak(g, ox + 430, 396, 112, 188, C(101, 105, 94), C(206, 213, 204));
        using (var p = new Pen(C(25, 32, 32, 116), 6.5f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            g.DrawLine(p, ox + 199, 92, ox + 138, 426);
            g.DrawLine(p, ox + 202, 92, ox + 306, 430);
            g.DrawLine(p, ox + 336, 144, ox + 398, 426);
            g.DrawLine(p, ox + 88, 168, ox + 48, 414);
        }
        for (int i = 0; i < 300; i++)
        {
            FillEllipse(g, Rng.Next(2) == 0 ? C(28, 36, 36, 90) : C(158, 164, 153, 82), ox + Rand(38, 470), Rand(154, 438), Rand(2, 9), Rand(1.2f, 6));
        }
    }

    private static void DrawLakeStamp(Graphics g, int col)
    {
        float ox = col * Stamp;
        FillBlob(g, C(190, 170, 108, 178), ox + 258, 272, 222, 142, 54, .23f);
        using (var waterPath = BlobPath(ox + 258, 265, 192, 114, 54, .18f))
        using (var brush = new LinearGradientBrush(new RectangleF(ox + 62, 120, 392, 270), C(74, 188, 218, 245), C(14, 86, 145, 250), 90f))
        {
            g.FillPath(brush, waterPath);
        }
        using (var p = new Pen(C(222, 248, 250, 174), 5.5f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 10; i++)
            {
                float y = 150 + i * 22 + Rand(-2, 3);
                g.DrawBezier(p, ox + 98, y, ox + 146, y - 18, ox + 184, y + 18, ox + 234, y);
                g.DrawBezier(p, ox + 222, y + 8, ox + 272, y - 16, ox + 324, y + 18, ox + 398, y + 2);
            }
        }
        for (int i = 0; i < 50; i++)
        {
            FillEllipse(g, C(214, 196, 130, 130), ox + Rand(42, 454), Rand(150, 392), Rand(13, 46), Rand(6, 20));
        }
    }

    private static void DrawWastelandStamp(Graphics g, int col)
    {
        float ox = col * Stamp;
        FillBlob(g, C(139, 109, 70, 240), ox + 258, 276, 222, 148, 54, .28f);
        FillBlob(g, C(93, 71, 48, 126), ox + 254, 270, 162, 104, 36, .24f);
        for (int i = 0; i < 320; i++)
        {
            FillEllipse(g, Rng.Next(2) == 0 ? C(71, 53, 35, 115) : C(190, 150, 92, 116), ox + Rand(46, 462), Rand(96, 430), Rand(2, 9), Rand(1.2f, 6));
        }
        using (var p = new Pen(C(45, 33, 25, 178), 5f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 40; i++)
            {
                float x = ox + Rand(78, 434);
                float y = Rand(118, 392);
                g.DrawLine(p, x, y, x + Rand(-66, 66), y + Rand(20, 70));
                g.DrawLine(p, x, y, x + Rand(-46, 46), y + Rand(-56, -10));
            }
        }
    }

    private static void DrawCraterStamp(Graphics g, int col)
    {
        float ox = col * Stamp;
        FillEllipse(g, C(0, 0, 0, 58), ox + 84, 356, 350, 70);
        FillEllipse(g, C(113, 88, 65, 234), ox + 78, 78, 364, 326);
        FillEllipse(g, C(72, 56, 47, 244), ox + 112, 112, 300, 260);
        FillEllipse(g, C(34, 30, 29, 255), ox + 148, 150, 226, 188);
        FillEllipse(g, C(17, 17, 16, 252), ox + 188, 186, 148, 112);
        FillEllipse(g, C(219, 91, 41, 86), ox + 214, 212, 98, 46);
        using (var p = new Pen(C(28, 23, 21, 138), 5.2f))
        {
            p.StartCap = LineCap.Round;
            p.EndCap = LineCap.Round;
            for (int i = 0; i < 42; i++)
            {
                double a = i * Math.PI * 2 / 42.0 + Rand(-.1f, .1f);
                float x1 = ox + 260 + (float)Math.Cos(a) * Rand(126, 156);
                float y1 = 244 + (float)Math.Sin(a) * Rand(102, 136);
                float x2 = ox + 260 + (float)Math.Cos(a) * Rand(172, 230);
                float y2 = 244 + (float)Math.Sin(a) * Rand(144, 212);
                g.DrawLine(p, x1, y1, x2, y2);
            }
        }
        for (int i = 0; i < 230; i++)
        {
            double a = Rng.NextDouble() * Math.PI * 2;
            float r = Rand(78, 220);
            FillEllipse(g, Rng.Next(2) == 0 ? C(158, 124, 88, 120) : C(15, 14, 13, 116), ox + 260 + (float)Math.Cos(a) * r, 244 + (float)Math.Sin(a) * r * .78f, Rand(2, 9), Rand(1.5f, 7));
        }
    }

    private static void DrawTreeCrown(Graphics g, float x, float y, float size, int variant)
    {
        FillEllipse(g, C(3, 19, 10, 58), x - size * .48f, y + size * .12f, size * .96f, size * .44f);
        FillRect(g, C(83, 55, 34, 175), x - size * .04f, y + size * .11f, size * .08f, size * .32f);
        Color dark = variant % 3 == 0 ? C(18, 67, 33, 248) : variant % 3 == 1 ? C(25, 86, 42, 248) : C(14, 76, 37, 248);
        Color mid = variant % 3 == 0 ? C(47, 132, 57, 235) : variant % 3 == 1 ? C(61, 146, 64, 232) : C(42, 122, 70, 232);
        FillEllipse(g, dark, x - size * .5f, y - size * .54f, size, size);
        FillEllipse(g, mid, x - size * .34f, y - size * .42f, size * .72f, size * .68f);
        FillEllipse(g, C(134, 188, 92, 188), x - size * .15f, y - size * .36f, size * .32f, size * .28f);
    }

    private static void DrawPeak(Graphics g, float x, float baseY, float width, float height, Color rock, Color snow)
    {
        PointF top = P(x, baseY - height);
        PointF left = P(x - width * .5f, baseY);
        PointF right = P(x + width * .5f, baseY);
        FillPolygon(g, rock, top, left, right);
        FillPolygon(g, C(31, 39, 39, 95), top, P(x, baseY), right);
        FillPolygon(g, C(152, 160, 153, 116), P(x - width * .16f, baseY - height * .42f), left, P(x, baseY));
        FillPolygon(g, snow, top, P(x - width * .18f, baseY - height * .58f), P(x + width * .08f, baseY - height * .49f), P(x + width * .24f, baseY - height * .62f));
    }

    private static GraphicsPath BlobPath(float cx, float cy, float rx, float ry, int count, float wobble)
    {
        PointF[] pts = new PointF[count];
        for (int i = 0; i < count; i++)
        {
            double a = Math.PI * 2 * i / count;
            float r = 1f + Rand(-wobble, wobble);
            pts[i] = P(cx + (float)Math.Cos(a) * rx * r, cy + (float)Math.Sin(a) * ry * r);
        }
        var path = new GraphicsPath();
        path.AddClosedCurve(pts, .52f);
        return path;
    }

    private static void FillBlob(Graphics g, Color color, float cx, float cy, float rx, float ry, int count, float wobble)
    {
        using (var path = BlobPath(cx, cy, rx, ry, count, wobble))
        using (var brush = new SolidBrush(color))
        {
            g.FillPath(brush, path);
        }
    }

    private static float EllipseMask(float x, float y)
    {
        return x * x + y * y;
    }

    private static float Fbm(float x, float y, int octaves, int seed)
    {
        float sum = 0f;
        float amp = .5f;
        float freq = 1f;
        float norm = 0f;
        for (int i = 0; i < octaves; i++)
        {
            sum += ValueNoise(x * freq, y * freq, seed + i * 113) * amp;
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

    private static float Smooth(float t)
    {
        return t * t * (3f - 2f * t);
    }

    private static float Lerp(float a, float b, float t)
    {
        return a + (b - a) * t;
    }

    private static Color Mix(Color a, Color b, float t)
    {
        t = Math.Max(0f, Math.Min(1f, t));
        return Color.FromArgb(
            (int)(a.A + (b.A - a.A) * t),
            (int)(a.R + (b.R - a.R) * t),
            (int)(a.G + (b.G - a.G) * t),
            (int)(a.B + (b.B - a.B) * t));
    }

    private static Color Shade(Color c, float delta)
    {
        return Color.FromArgb(c.A, Clamp(c.R + delta), Clamp(c.G + delta), Clamp(c.B + delta));
    }

    private static int Clamp(float v)
    {
        return (int)Math.Max(0, Math.Min(255, v));
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

    private static PointF P(float x, float y)
    {
        return new PointF(x, y);
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
[NaturalTerrainAssetGenerator]::Generate($resolvedOutDir)
Write-Host "Generated natural terrain assets in $resolvedOutDir"
