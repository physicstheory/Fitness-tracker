import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;
import Toybox.WatchUi;

// Dark, orange-accented screens that match the RepRise phone app.
class RepRiseView extends WatchUi.View {
    hidden var model;
    hidden var logo;

    const BG = 0x0B0D12;
    const CARD = 0x1A1E27;
    const TRACK = 0x262B36;
    const MUTED = 0x8B93A7;
    const ORANGE = 0xFF5A36;
    const AMBER = 0xFFA726;
    const GREEN = 0x2FB67C;
    const CENTER = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;

    function initialize(m) {
        View.initialize();
        model = m;
    }

    function onLayout(dc) {
        logo = WatchUi.loadResource(Rez.Drawables.Logo);
    }

    function onUpdate(dc) {
        var w = dc.getWidth();
        var h = dc.getHeight();
        if (dc has :setAntiAlias) {
            dc.setAntiAlias(true);
        }
        dc.setColor(BG, BG);
        dc.clear();

        var rest = model.restLeft();
        if (model.counting) {
            drawCounting(dc, w, h);
        } else if (rest > 0) {
            drawRest(dc, w, h, rest);
        } else if (model.active) {
            drawReady(dc, w, h);
        } else {
            drawIdle(dc, w, h);
        }
    }

    // ----- Screens -----

    hidden function drawIdle(dc, w, h) {
        var cx = w / 2;
        var small = Graphics.FONT_XTINY;
        var wordFont = Graphics.FONT_TINY;
        var codeFont = Graphics.FONT_NUMBER_MILD;
        var smallH = dc.getFontHeight(small);
        var wordH = dc.getFontHeight(wordFont);
        var codeH = (dc.getFontHeight(codeFont) * 0.8).toNumber();
        var cardH = smallH + codeH + 10;
        var pillH = smallH + 8;
        var logoH = logo != null ? logo.getHeight() + 6 : 0;
        // Stack everything in a column centred on the screen; drop the logo if it won't fit.
        var total = logoH + wordH + 8 + cardH + 10 + smallH + 10 + pillH;
        if (total > h * 0.86) {
            total -= logoH;
            logoH = 0;
        }
        var y = (h - total) / 2;
        if (logoH > 0) {
            dc.drawBitmap(cx - logo.getWidth() / 2, y, logo);
            y += logoH;
        }

        // "Rep" in white, "Rise" in orange, like the app's wordmark.
        var w1 = dc.getTextWidthInPixels("Rep", wordFont);
        var w2 = dc.getTextWidthInPixels("Rise", wordFont);
        var x0 = cx - (w1 + w2) / 2;
        var my = y + wordH / 2;
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x0, my, wordFont, "Rep", Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);
        dc.setColor(ORANGE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x0 + w1, my, wordFont, "Rise", Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);
        y += wordH + 8;

        // Pairing code card.
        var cardW = (w * 0.50).toNumber();
        dc.setColor(CARD, Graphics.COLOR_TRANSPARENT);
        dc.fillRoundedRectangle(cx - cardW / 2, y, cardW, cardH, 14);
        label(dc, cx, y + 5 + smallH / 2, small, "PAIR CODE", MUTED);
        label(dc, cx, y + 5 + smallH + codeH / 2, codeFont, model.code, Graphics.COLOR_WHITE);
        y += cardH + 10;

        statusLine(dc, cx, y + smallH / 2, model.online ? "Linked" : "Enter code in app", model.online);
        y += smallH + 10;
        pill(dc, cx, y + pillH / 2, "START  free set", ORANGE, Graphics.COLOR_WHITE);
    }

    hidden function drawReady(dc, w, h) {
        var cx = w / 2;
        dc.setColor(model.online ? GREEN : TRACK, Graphics.COLOR_TRANSPARENT);
        dc.fillCircle(cx, (h * 0.075).toNumber(), 4);

        label(dc, cx, h * 0.17, Graphics.FONT_XTINY, "EXERCISE " + model.exercise + "/" + model.exercises, MUTED);
        fitLabel(dc, cx, h * 0.29, model.name, w * 0.80, Graphics.COLOR_WHITE);
        setDots(dc, cx, h * 0.40, model.setNo - 1, model.sets);

        var isTime = model.type.equals("time");
        if (model.target == 0) {
            label(dc, cx, h * 0.57, Graphics.FONT_LARGE, "MAX", ORANGE);
        } else {
            label(dc, cx, h * 0.56, Graphics.FONT_NUMBER_HOT, model.target.toString(), ORANGE);
        }
        label(dc, cx, h * 0.71, Graphics.FONT_XTINY, isTime ? "SECOND HOLD" : model.target == 0 ? "REPS · MAX EFFORT" : "REPS", MUTED);
        pill(dc, cx, h * 0.86, "START  set " + model.setNo + "/" + model.sets, ORANGE, Graphics.COLOR_WHITE);
    }

    hidden function drawCounting(dc, w, h) {
        var cx = w / 2;
        var cy = h / 2;
        var isTime = model.type.equals("time");
        var value = isTime ? model.holdSeconds() : model.reps;
        var frac = model.target > 0 ? value.toFloat() / model.target : 0.0;
        ring(dc, cx, cy, cx - 9, frac, 10);

        var title = model.name.length() > 0 ? model.name : "Free set";
        fitSmall(dc, cx, h * 0.23, title, w * 0.62, MUTED);
        if (model.sets > 0) {
            label(dc, cx, h * 0.32, Graphics.FONT_XTINY, "SET " + model.setNo + " OF " + model.sets, ORANGE);
        }
        var done = model.target > 0 && value >= model.target;
        label(dc, cx, h * 0.51, Graphics.FONT_NUMBER_THAI_HOT, isTime ? clock(value) : value.toString(), done ? ORANGE : Graphics.COLOR_WHITE);
        var sub = model.target > 0 ? (isTime ? "of " + clock(model.target) : "of " + model.target + " reps") : "max effort";
        label(dc, cx, h * 0.68, Graphics.FONT_TINY, sub, MUTED);
        label(dc, cx, h * 0.79, Graphics.FONT_XTINY, "START  done", MUTED);
    }

    hidden function drawRest(dc, w, h, rest) {
        var cx = w / 2;
        var cy = h / 2;
        var total = model.restTotal > 0 ? model.restTotal : rest;
        ring(dc, cx, cy, cx - 9, rest.toFloat() / total, 10);

        label(dc, cx, h * 0.25, Graphics.FONT_XTINY, "REST", ORANGE);
        label(dc, cx, h * 0.43, Graphics.FONT_NUMBER_MEDIUM, clock(rest), Graphics.COLOR_WHITE);
        if (model.active) {
            label(dc, cx, h * 0.59, Graphics.FONT_XTINY, "UP NEXT · SET " + model.setNo + "/" + model.sets, MUTED);
            fitSmall(dc, cx, h * 0.68, model.name, w * 0.66, Graphics.COLOR_WHITE);
        }
        pill(dc, cx, h * 0.82, "START  skip", CARD, ORANGE);
    }

    // ----- Pieces -----

    // Progress ring with an orange-to-amber gradient and rounded ends.
    hidden function ring(dc, cx, cy, r, frac, pen) {
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
        // Rounded caps.
        var capR = pen / 2;
        dc.setColor(ORANGE, Graphics.COLOR_TRANSPARENT);
        dc.fillCircle(cx, cy - r, capR);
        var end = Math.toRadians(90.0 - sweep);
        dc.setColor(AMBER, Graphics.COLOR_TRANSPARENT);
        dc.fillCircle(cx + (r * Math.cos(end)).toNumber(), cy - (r * Math.sin(end)).toNumber(), capR);
    }

    hidden function setDots(dc, cx, y, done, total) {
        var n = total > 10 ? 10 : total;
        if (n <= 0) {
            return;
        }
        var r = dc.getWidth() / 52;
        if (r < 4) {
            r = 4;
        }
        var gap = r * 3;
        var x0 = cx - (n - 1) * gap / 2;
        for (var i = 0; i < n; i++) {
            var x = x0 + i * gap;
            if (i < done) {
                dc.setColor(ORANGE, Graphics.COLOR_TRANSPARENT);
                dc.fillCircle(x, y.toNumber(), r);
            } else if (i == done) {
                dc.setColor(ORANGE, Graphics.COLOR_TRANSPARENT);
                dc.setPenWidth(2);
                dc.drawCircle(x, y.toNumber(), r);
                dc.setPenWidth(1);
            } else {
                dc.setColor(TRACK, Graphics.COLOR_TRANSPARENT);
                dc.fillCircle(x, y.toNumber(), r);
            }
        }
    }

    hidden function pill(dc, cx, y, text, fill, color) {
        var font = Graphics.FONT_XTINY;
        var pw = dc.getTextWidthInPixels(text, font) + 32;
        var ph = dc.getFontHeight(font) + 8;
        var top = y.toNumber() - ph / 2;
        dc.setColor(fill, Graphics.COLOR_TRANSPARENT);
        dc.fillRoundedRectangle(cx - pw / 2, top, pw, ph, ph / 2);
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, top + ph / 2, font, text, CENTER);
    }

    hidden function statusLine(dc, cx, y, text, ok) {
        var font = Graphics.FONT_XTINY;
        var tw = dc.getTextWidthInPixels(text, font);
        var x0 = cx - (tw + 14) / 2;
        dc.setColor(ok ? GREEN : MUTED, Graphics.COLOR_TRANSPARENT);
        dc.fillCircle(x0 + 4, y.toNumber(), 4);
        dc.setColor(ok ? Graphics.COLOR_WHITE : MUTED, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x0 + 14, y.toNumber(), font, text, Graphics.TEXT_JUSTIFY_LEFT | Graphics.TEXT_JUSTIFY_VCENTER);
    }

    // Exercise name in the biggest font that fits.
    hidden function fitLabel(dc, cx, y, text, maxW, color) {
        var fonts = [Graphics.FONT_MEDIUM, Graphics.FONT_SMALL, Graphics.FONT_TINY, Graphics.FONT_XTINY];
        fitIn(dc, cx, y, text, maxW, color, fonts);
    }

    hidden function fitSmall(dc, cx, y, text, maxW, color) {
        var fonts = [Graphics.FONT_SMALL, Graphics.FONT_TINY, Graphics.FONT_XTINY];
        fitIn(dc, cx, y, text, maxW, color, fonts);
    }

    hidden function fitIn(dc, cx, y, text, maxW, color, fonts) {
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
        label(dc, cx, y, font, text, color);
    }

    hidden function label(dc, x, y, font, text, color) {
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x, y.toNumber(), font, text, CENTER);
    }

    hidden function mix(a, b, t) {
        var r = ((a >> 16) & 0xFF) + ((((b >> 16) & 0xFF) - ((a >> 16) & 0xFF)) * t).toNumber();
        var g = ((a >> 8) & 0xFF) + ((((b >> 8) & 0xFF) - ((a >> 8) & 0xFF)) * t).toNumber();
        var bl = (a & 0xFF) + (((b & 0xFF) - (a & 0xFF)) * t).toNumber();
        return (r << 16) | (g << 8) | bl;
    }

    hidden function norm(a) {
        while (a < 0) {
            a += 360.0;
        }
        while (a >= 360) {
            a -= 360.0;
        }
        return a;
    }

    hidden function clock(sec) {
        return (sec / 60).format("%d") + ":" + (sec % 60).format("%02d");
    }
}
