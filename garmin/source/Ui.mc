import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;
import Toybox.WatchUi;

// Colours and drawing pieces shared by every screen, matching the RepRise phone app.
module Ui {
    const BG = 0x0B0D12;
    const CARD = 0x1A1E27;
    const CARD_HI = 0x262B36;
    const TRACK = 0x262B36;
    const MUTED = 0x8B93A7;
    const ORANGE = 0xFF5A36;
    const AMBER = 0xFFA726;
    const GREEN = 0x2FB67C;
    const CENTER = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;
    const LEFT = Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER;

    // The phone app's typefaces as bitmap fonts (see garmin/tools/make_fonts.py):
    // Unbounded for numbers, titles and small caps, Manrope for body text.
    var fHuge;
    var fBig;
    var fTitle;
    var fCaps;
    var fBody;
    var fSmall;

    function loadFonts() {
        fHuge = WatchUi.loadResource(Rez.Fonts.Huge);
        fBig = WatchUi.loadResource(Rez.Fonts.Big);
        fTitle = WatchUi.loadResource(Rez.Fonts.Title);
        fCaps = WatchUi.loadResource(Rez.Fonts.Caps);
        fBody = WatchUi.loadResource(Rez.Fonts.Body);
        fSmall = WatchUi.loadResource(Rez.Fonts.Small);
    }

    function clear(dc) {
        if (dc has :setAntiAlias) {
            dc.setAntiAlias(true);
        }
        dc.setColor(BG, BG);
        dc.clear();
    }

    function label(dc, x, y, font, text, color) {
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x, y.toNumber(), font, text, CENTER);
    }

    function pill(dc, cx, y, text, fill, color) {
        var font = Ui.fCaps;
        text = text.toUpper();
        var pw = dc.getTextWidthInPixels(text, font) + 32;
        var ph = dc.getFontHeight(font) + 8;
        var top = y.toNumber() - ph / 2;
        dc.setColor(fill, Graphics.COLOR_TRANSPARENT);
        dc.fillRoundedRectangle(cx - pw / 2, top, pw, ph, ph / 2);
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, top + ph / 2, font, text, CENTER);
    }

    // Text in the biggest of the given fonts that fits maxW, shortened with "..." if needed.
    function fit(dc, x, y, text, maxW, color, fonts, justify) {
        var font = fonts[fonts.size() - 1];
        for (var i = 0; i < fonts.size(); i++) {
            if (dc.getTextWidthInPixels(text, fonts[i]) <= maxW) {
                font = fonts[i];
                break;
            }
        }
        var base = text;
        var n = base.length();
        while (n > 3 && dc.getTextWidthInPixels(text, font) > maxW) {
            n -= 1;
            text = base.substring(0, n) + "...";
        }
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x, y.toNumber(), font, text, justify);
    }

    // Progress ring with an orange-to-amber gradient and rounded ends.
    function ring(dc, cx, cy, r, frac, pen) {
        if (frac > 1.0) {
            frac = 1.0;
        }
        dc.setPenWidth(pen);
        dc.setColor(TRACK, Graphics.COLOR_TRANSPARENT);
        dc.drawCircle(cx, cy, r);
        if (frac <= 0.0) {
            dc.setPenWidth(1);
            return;
        }
        var steps = (frac * 48).toNumber();
        if (steps < 1) {
            steps = 1;
        }
        var sweep = 360.0 * frac;
        for (var i = 0; i < steps; i++) {
            var a0 = 90.0 - sweep * i / steps;
            var a1 = 90.0 - sweep * (i + 1) / steps - 0.8;
            dc.setColor(mix(ORANGE, AMBER, i.toFloat() / steps), Graphics.COLOR_TRANSPARENT);
            dc.drawArc(cx, cy, r, Graphics.ARC_CLOCKWISE, norm(a0), norm(a1));
        }
        dc.setPenWidth(1);
        var capR = pen / 2;
        dc.setColor(ORANGE, Graphics.COLOR_TRANSPARENT);
        dc.fillCircle(cx, cy - r, capR);
        var end = Math.toRadians(90.0 - sweep);
        dc.setColor(AMBER, Graphics.COLOR_TRANSPARENT);
        dc.fillCircle(cx + (r * Math.cos(end)).toNumber(), cy - (r * Math.sin(end)).toNumber(), capR);
    }

    // Small orange-to-amber bar along the top of a card, like the phone app's accents.
    function accentBar(dc, x, y, w, h) {
        var n = 12;
        for (var i = 0; i < n; i++) {
            dc.setColor(mix(ORANGE, AMBER, i.toFloat() / n), Graphics.COLOR_TRANSPARENT);
            dc.fillRectangle(x + w * i / n, y, w / n + 1, h);
        }
    }

    function mix(a, b, t) {
        var r = ((a >> 16) & 0xFF) + ((((b >> 16) & 0xFF) - ((a >> 16) & 0xFF)) * t).toNumber();
        var g = ((a >> 8) & 0xFF) + ((((b >> 8) & 0xFF) - ((a >> 8) & 0xFF)) * t).toNumber();
        var bl = (a & 0xFF) + (((b & 0xFF) - (a & 0xFF)) * t).toNumber();
        return (r << 16) | (g << 8) | bl;
    }

    function norm(a) {
        while (a < 0) {
            a += 360.0;
        }
        while (a >= 360) {
            a -= 360.0;
        }
        return a;
    }

    function clock(sec) {
        return (sec / 60).format("%d") + ":" + (sec % 60).format("%02d");
    }

    function goalText(type, target) {
        if (target == 0) {
            return "max";
        }
        return type.equals("time") ? target + "s" : target.toString();
    }
}
