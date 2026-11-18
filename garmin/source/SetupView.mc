import Toybox.Graphics;
import Toybox.Lang;
import Toybox.System;
import Toybox.WatchUi;

// Edit sets, reps (or seconds) and rest. UP/DOWN change the highlighted value, START moves on.
class SetupView extends WatchUi.View {
    var name;
    var isTime;
    var values;
    var field = 0;
    var actionLabel;

    function initialize(n, time, sets, target, rest, action) {
        View.initialize();
        name = n;
        isTime = time;
        values = [sets, target, rest];
        actionLabel = action;
    }

    function change(d) {
        if (field > 2) {
            return;
        }
        var step = field == 0 ? 1 : field == 1 ? (isTime ? 5 : 1) : 15;
        var min = field == 0 ? 1 : field == 1 ? 0 : 0;
        var max = field == 0 ? 10 : field == 1 ? (isTime ? 600 : 100) : 300;
        var v = values[field] + d * step;
        values[field] = v < min ? min : v > max ? max : v;
        WatchUi.requestUpdate();
    }

    function onUpdate(dc) {
        Ui.clear(dc);
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        Ui.label(dc, cx, h * 0.13, Ui.fCaps, "EDIT", Ui.ORANGE);
        Ui.fit(dc, cx, h * 0.23, name, w * 0.70, Graphics.COLOR_WHITE, [Ui.fTitle, Ui.fBody, Ui.fSmall], Ui.CENTER);

        var labels = ["SETS", isTime ? "SECONDS" : "REPS", "REST"];
        var shown = [values[0].toString(), values[1] == 0 ? "max" : values[1].toString(), Ui.clock(values[2])];
        var rowH = (h * 0.15).toNumber();
        var rowW = (w * 0.70).toNumber();
        for (var i = 0; i < 3; i++) {
            var cy = (h * 0.40).toNumber() + i * (rowH + 6);
            var on = field == i;
            dc.setColor(on ? Ui.CARD_HI : Ui.CARD, Graphics.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(cx - rowW / 2, cy - rowH / 2, rowW, rowH, 12);
            if (on) {
                dc.setColor(Ui.ORANGE, Graphics.COLOR_TRANSPARENT);
                dc.setPenWidth(2);
                dc.drawRoundedRectangle(cx - rowW / 2, cy - rowH / 2, rowW, rowH, 12);
                dc.setPenWidth(1);
            }
            dc.setColor(Ui.MUTED, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx - rowW / 2 + 14, cy, Ui.fCaps, labels[i], Ui.LEFT);
            dc.setColor(on ? Ui.ORANGE : Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            var vx = cx + rowW / 2 - 14;
            dc.drawText(vx, cy, Ui.fTitle, shown[i], Graphics.TEXT_JUSTIFY_RIGHT | Graphics.TEXT_JUSTIFY_VCENTER);
            if (on) {
                // Up/down arrows hint.
                var ax = cx - rowW / 2 - 12;
                dc.setColor(Ui.ORANGE, Graphics.COLOR_TRANSPARENT);
                dc.fillPolygon([[ax, cy - 10], [ax - 5, cy - 4], [ax + 5, cy - 4]]);
                dc.fillPolygon([[ax, cy + 10], [ax - 5, cy + 4], [ax + 5, cy + 4]]);
            }
        }
        Ui.pill(dc, cx, h * 0.87, field > 2 ? actionLabel : "START  next", field > 2 ? Ui.ORANGE : Ui.CARD, field > 2 ? Graphics.COLOR_WHITE : Ui.ORANGE);
    }
}

class SetupDelegate extends WatchUi.BehaviorDelegate {
    hidden var view;
    hidden var handler;

    function initialize(v, h) {
        BehaviorDelegate.initialize();
        view = v;
        handler = h;
    }

    function onPreviousPage() {
        view.change(1);
        return true;
    }

    function onNextPage() {
        view.change(-1);
        return true;
    }

    function onSelect() {
        if (view.field < 3) {
            view.field += 1;
            WatchUi.requestUpdate();
        } else {
            handler.onSetup(view.values);
        }
        return true;
    }

    function onTap(evt) {
        var y = evt.getCoordinates()[1];
        var h = System.getDeviceSettings().screenHeight;
        if (y < h * 0.3) {
            view.change(1);
        } else if (y > h * 0.78) {
            onSelect();
        } else {
            // Tap a row to edit it.
            var rowH = h * 0.15 + 6;
            var i = ((y - (h * 0.40 - h * 0.075)) / rowH).toNumber();
            if (i >= 0 && i <= 2) {
                view.field = i;
                WatchUi.requestUpdate();
            }
        }
        return true;
    }

    function onBack() {
        if (view.field > 0) {
            view.field -= 1;
            WatchUi.requestUpdate();
        } else {
            Nav.pop();
        }
        return true;
    }
}
