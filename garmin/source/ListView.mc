import Toybox.Graphics;
import Toybox.Lang;
import Toybox.System;
import Toybox.WatchUi;

// A scrolling list of cards: the selected card sits in the middle, the ones above and below fade out.
// Items are [label, subtitle, kind]; kind: 0 normal, 1 primary action, 2 ticked, 3 unticked, 4 delete.
class ListView extends WatchUi.View {
    var title;
    var items;
    var sel = 0;
    // Rebuilds the items when the list comes back into view (after an edit underneath it).
    var refresher = null;

    function initialize(t, list) {
        View.initialize();
        title = t;
        items = list;
    }

    function onShow() {
        if (refresher != null && refresher has :refresh) {
            refresher.refresh();
        }
    }

    function setItems(list) {
        items = list;
        if (sel >= items.size()) {
            sel = items.size() - 1;
        }
        if (sel < 0) {
            sel = 0;
        }
        WatchUi.requestUpdate();
    }

    function move(d) {
        if (items.size() == 0) {
            return;
        }
        sel = (sel + d + items.size()) % items.size();
        WatchUi.requestUpdate();
    }

    function onUpdate(dc) {
        Ui.clear(dc);
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        Ui.label(dc, cx, h * 0.12, Ui.fCaps, title.toUpper(), Ui.ORANGE);

        var cardH = (h * 0.22).toNumber();
        var gap = (h * 0.035).toNumber();
        var mid = h / 2 + (h * 0.02).toNumber();
        for (var d = -1; d <= 1; d++) {
            var i = sel + d;
            if (i < 0 || i >= items.size()) {
                continue;
            }
            var cy = mid + d * (cardH + gap);
            drawCard(dc, w, cx, cy, cardH, items[i], d == 0);
        }

        // Scroll position dots on the right edge.
        if (items.size() > 1) {
            var n = items.size() > 7 ? 7 : items.size();
            var pos = items.size() > 7 ? (sel * (n - 1)) / (items.size() - 1) : sel;
            var y0 = h / 2 - (n - 1) * 5;
            for (var k = 0; k < n; k++) {
                dc.setColor(k == pos ? Ui.ORANGE : Ui.TRACK, Graphics.COLOR_TRANSPARENT);
                dc.fillCircle(w - (w * 0.045).toNumber(), y0 + k * 10, k == pos ? 3 : 2);
            }
        }
    }

    hidden function drawCard(dc, w, cx, cy, ch, item, focused) {
        var kind = item[2];
        var cw = focused ? (w * 0.80).toNumber() : (w * 0.66).toNumber();
        var hgt = focused ? ch : (ch * 0.78).toNumber();
        var x = cx - cw / 2;
        var y = cy - hgt / 2;
        var fill = focused ? Ui.CARD_HI : Ui.CARD;
        if (focused && kind == 1) {
            fill = Ui.ORANGE;
        }
        dc.setColor(fill, Graphics.COLOR_TRANSPARENT);
        dc.fillRoundedRectangle(x, y, cw, hgt, 16);
        if (focused && kind != 1) {
            dc.setColor(kind == 4 ? 0xFF4D5E : Ui.ORANGE, Graphics.COLOR_TRANSPARENT);
            dc.setPenWidth(2);
            dc.drawRoundedRectangle(x, y, cw, hgt, 16);
            dc.setPenWidth(1);
        }

        var textX = x + 16;
        var textW = cw - 32;
        // Tick box for multi-select lists.
        if (kind == 2 || kind == 3) {
            var r = 9;
            var bx = x + cw - 16 - r;
            if (kind == 2) {
                dc.setColor(Ui.ORANGE, Graphics.COLOR_TRANSPARENT);
                dc.fillCircle(bx, cy, r);
                dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
                dc.setPenWidth(2);
                dc.drawLine(bx - 4, cy, bx - 1, cy + 3);
                dc.drawLine(bx - 1, cy + 3, bx + 4, cy - 3);
                dc.setPenWidth(1);
            } else {
                dc.setColor(Ui.MUTED, Graphics.COLOR_TRANSPARENT);
                dc.drawCircle(bx, cy, r);
            }
            textW -= 2 * r + 6;
        }

        var labelColor = !focused ? Ui.MUTED : kind == 1 ? Graphics.COLOR_WHITE : kind == 4 ? 0xFF4D5E : Graphics.COLOR_WHITE;
        var sub = item[1];
        var fonts = focused ? [Ui.fTitle, Ui.fBody, Ui.fSmall] : [Ui.fBody, Ui.fSmall];
        if (sub != null && sub.length() > 0 && focused) {
            var lh = dc.getFontHeight(Ui.fBody);
            Ui.fit(dc, textX, cy - lh / 2 + 2, item[0], textW, labelColor, [Ui.fBody, Ui.fSmall], Ui.LEFT);
            Ui.fit(dc, textX, cy + lh / 2 + 2, sub, textW, kind == 1 ? Graphics.COLOR_WHITE : Ui.MUTED, [Ui.fSmall], Ui.LEFT);
        } else {
            Ui.fit(dc, textX, cy, item[0], textW, labelColor, fonts, Ui.LEFT);
        }
    }
}

// Scroll with UP/DOWN or swipes, START or tap to pick, BACK to leave.
class ListDelegate extends WatchUi.BehaviorDelegate {
    hidden var view;
    hidden var handler;

    function initialize(v, h) {
        BehaviorDelegate.initialize();
        view = v;
        handler = h;
    }

    function onNextPage() {
        view.move(1);
        return true;
    }

    function onPreviousPage() {
        view.move(-1);
        return true;
    }

    function onSelect() {
        if (view.items.size() > 0) {
            handler.onPick(view.sel);
        }
        return true;
    }

    function onTap(evt) {
        var y = evt.getCoordinates()[1];
        var h = System.getDeviceSettings().screenHeight;
        if (y < h * 0.36) {
            view.move(-1);
        } else if (y > h * 0.64) {
            view.move(1);
        } else {
            onSelect();
        }
        return true;
    }

    function onBack() {
        Nav.pop();
        return true;
    }
}
