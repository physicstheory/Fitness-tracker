import Toybox.Attention;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

// Learns how YOU move for one exercise: do 4 slow, full reps and the counter keeps your rep speed and size.
class CalibrateView extends WatchUi.View {
    const NEEDED = 4;
    var name;
    var profile;
    var amps = [];
    var pers = [];
    var done = false;
    var started = false;
    hidden var counter;

    function initialize(n, prof) {
        View.initialize();
        name = n;
        profile = prof;
        counter = new RepCounter(null);
    }

    function begin() {
        started = true;
        amps = [];
        pers = [];
        done = false;
        counter.setProfile(profile);
        counter.setLearn(method(:onCycle));
        counter.start();
        buzz(150);
        WatchUi.requestUpdate();
    }

    function onCycle(p2p, per) as Void {
        if (done) {
            return;
        }
        amps.add(p2p);
        pers.add(per);
        buzz(60);
        if (amps.size() >= NEEDED) {
            finish();
        }
        WatchUi.requestUpdate();
    }

    hidden function finish() {
        counter.stop();
        done = true;
        // Skip the first cycle (getting into position) when we have enough.
        var a = median(amps.slice(1, null));
        var p = median(pers.slice(1, null));
        var minP = (p * 0.55).toNumber();
        var maxP = (p * 2.4).toNumber();
        var minAmp = (a * 0.45).toNumber();
        Store.saveCalibration(name, [minP < 300 ? 300 : minP, maxP > 9000 ? 9000 : maxP, minAmp < 60 ? 60 : minAmp]);
        buzz(400);
    }

    function onHide() {
        counter.stop();
    }

    hidden function median(list) {
        var s = list.slice(0, null);
        for (var i = 1; i < s.size(); i++) {
            var v = s[i];
            var j = i - 1;
            while (j >= 0 && s[j] > v) {
                s[j + 1] = s[j];
                j -= 1;
            }
            s[j + 1] = v;
        }
        return s[s.size() / 2];
    }

    hidden function buzz(ms) {
        if (Attention has :vibrate) {
            Attention.vibrate([new Attention.VibeProfile(60, ms)]);
        }
    }

    function onUpdate(dc) {
        Ui.clear(dc);
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        Ui.ring(dc, cx, h / 2, cx - 9, amps.size().toFloat() / NEEDED, 10);
        Ui.label(dc, cx, h * 0.24, Ui.fCaps, "CALIBRATE", Ui.ORANGE);
        Ui.fit(dc, cx, h * 0.33, name, w * 0.62, Graphics.COLOR_WHITE, [Ui.fTitle, Ui.fBody, Ui.fSmall], Ui.CENTER);
        if (done) {
            Ui.label(dc, cx, h * 0.52, Ui.fTitle, "Learned", Ui.ORANGE);
            Ui.label(dc, cx, h * 0.64, Ui.fSmall, "Counting now fits your reps", Ui.MUTED);
            Ui.pill(dc, cx, h * 0.80, "START  done", Ui.ORANGE, Graphics.COLOR_WHITE);
        } else if (started) {
            Ui.label(dc, cx, h * 0.52, Ui.fBig, amps.size() + "/" + NEEDED, Graphics.COLOR_WHITE);
            Ui.label(dc, cx, h * 0.68, Ui.fSmall, "Slow, full reps", Ui.MUTED);
        } else {
            Ui.label(dc, cx, h * 0.50, Ui.fSmall, "Get into position, press START,", Ui.MUTED);
            Ui.label(dc, cx, h * 0.58, Ui.fSmall, "then do " + NEEDED + " slow, full reps", Ui.MUTED);
            Ui.pill(dc, cx, h * 0.76, "START", Ui.ORANGE, Graphics.COLOR_WHITE);
        }
    }
}

class CalibrateDelegate extends WatchUi.BehaviorDelegate {
    hidden var view;

    function initialize(v) {
        BehaviorDelegate.initialize();
        view = v;
    }

    function onSelect() {
        if (view.done) {
            Nav.pop();
        } else if (!view.started) {
            view.begin();
        }
        return true;
    }

    function onBack() {
        Nav.pop();
        return true;
    }
}
