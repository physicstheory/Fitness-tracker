import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

class RepRiseView extends WatchUi.View {
    hidden var model;
    const ORANGE = 0xFF5A36;
    const CENTER = Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER;

    function initialize(m) {
        View.initialize();
        model = m;
    }

    function onUpdate(dc) {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        // Connection dot: green when the phone link is live.
        dc.setColor(model.online ? Graphics.COLOR_GREEN : Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.fillCircle(cx, (h * 0.08).toNumber(), 4);

        var rest = model.restLeft();
        if (model.counting) {
            drawCounting(dc, w, h, cx);
        } else if (rest > 0) {
            label(dc, cx, h * 0.24, Graphics.FONT_SMALL, "REST", Graphics.COLOR_LT_GRAY);
            label(dc, cx, h * 0.48, Graphics.FONT_NUMBER_HOT, clock(rest), Graphics.COLOR_WHITE);
            label(dc, cx, h * 0.70, Graphics.FONT_XTINY, model.active ? "Next: " + model.name : "", Graphics.COLOR_LT_GRAY);
            label(dc, cx, h * 0.84, Graphics.FONT_XTINY, "START to go", ORANGE);
        } else if (model.active) {
            label(dc, cx, h * 0.22, Graphics.FONT_XTINY, "Exercise " + model.exercise + "/" + model.exercises, Graphics.COLOR_LT_GRAY);
            label(dc, cx, h * 0.36, Graphics.FONT_SMALL, model.name, Graphics.COLOR_WHITE);
            label(dc, cx, h * 0.52, Graphics.FONT_MEDIUM, "Set " + model.setNo + " of " + model.sets, ORANGE);
            var goal = model.target == 0 ? "Max effort" : model.type.equals("time") ? "Hold " + model.target.toString() + "s" : model.target.toString() + " reps";
            label(dc, cx, h * 0.66, Graphics.FONT_SMALL, goal, Graphics.COLOR_WHITE);
            label(dc, cx, h * 0.84, Graphics.FONT_XTINY, "START to begin", ORANGE);
        } else {
            label(dc, cx, h * 0.26, Graphics.FONT_MEDIUM, "RepRise", ORANGE);
            label(dc, cx, h * 0.44, Graphics.FONT_SMALL, "Code " + model.code, Graphics.COLOR_WHITE);
            label(dc, cx, h * 0.60, Graphics.FONT_XTINY, model.online ? "Start a workout on your phone" : "Enter the code in RepRise", Graphics.COLOR_LT_GRAY);
            label(dc, cx, h * 0.70, Graphics.FONT_XTINY, model.online ? "" : "Settings > Garmin watch", Graphics.COLOR_LT_GRAY);
            label(dc, cx, h * 0.84, Graphics.FONT_XTINY, "START: free set", ORANGE);
        }
    }

    hidden function drawCounting(dc, w, h, cx) {
        var isTime = model.type.equals("time");
        var value = isTime ? model.holdSeconds() : model.reps;
        // Progress ring toward the target.
        if (model.target > 0) {
            var frac = value.toFloat() / model.target;
            if (frac > 1.0) {
                frac = 1.0;
            }
            dc.setPenWidth(6);
            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawCircle(cx, h / 2, cx - 5);
            if (frac > 0) {
                dc.setColor(ORANGE, Graphics.COLOR_TRANSPARENT);
                if (frac >= 1.0) {
                    dc.drawCircle(cx, h / 2, cx - 5);
                } else {
                    var end = 90 - (360 * frac).toNumber();
                    if (end < 0) {
                        end += 360;
                    }
                    dc.drawArc(cx, h / 2, cx - 5, Graphics.ARC_CLOCKWISE, 90, end);
                }
            }
            dc.setPenWidth(1);
        }
        label(dc, cx, h * 0.24, Graphics.FONT_XTINY, model.name.length() > 0 ? model.name : "Free set", Graphics.COLOR_LT_GRAY);
        label(dc, cx, h * 0.50, Graphics.FONT_NUMBER_THAI_HOT, isTime ? clock(value) : value.toString(), ORANGE);
        var sub = model.target > 0 ? (isTime ? "of " + model.target + "s" : "of " + model.target) : "max effort";
        label(dc, cx, h * 0.72, Graphics.FONT_SMALL, sub, Graphics.COLOR_WHITE);
        label(dc, cx, h * 0.84, Graphics.FONT_XTINY, isTime ? "START = stop" : "UP/DOWN fix · START done", Graphics.COLOR_LT_GRAY);
    }

    hidden function label(dc, x, y, font, text, color) {
        dc.setColor(color, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x, y.toNumber(), font, text, CENTER);
    }

    hidden function clock(sec) {
        return (sec / 60).format("%d") + ":" + (sec % 60).format("%02d");
    }
}
