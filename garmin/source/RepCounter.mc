import Toybox.Lang;
import Toybox.Math;
import Toybox.Sensor;
import Toybox.System;

// Detects reps as peaks in wrist acceleration.
// The signal is a fast-moving average minus a slow baseline; a rep is counted when it rises above an
// adaptive threshold (45% of recent swing), and the detector re-arms once it falls back toward zero.
class RepCounter {
    hidden var callback;
    hidden var running = false;
    hidden var fast = 1000.0;
    hidden var slow = 1000.0;
    hidden var amp = 150.0;
    hidden var armed = true;
    hidden var lastRep = 0;
    hidden var warm = 0;

    // Minimum time between reps, in ms. Stops one rep counting twice.
    const MIN_GAP = 650;
    // Smallest swing (milli-g) that can count as a rep.
    const MIN_THRESHOLD = 90.0;

    function initialize(cb) {
        callback = cb;
    }

    function start() {
        if (running) {
            return;
        }
        running = true;
        armed = true;
        warm = 0;
        fast = 1000.0;
        slow = 1000.0;
        amp = 150.0;
        lastRep = System.getTimer();
        Sensor.registerSensorDataListener(method(:onData), {
            :period => 1,
            :accelerometer => { :enabled => true, :sampleRate => 25 }
        });
    }

    function stop() {
        if (!running) {
            return;
        }
        running = false;
        Sensor.unregisterSensorDataListener();
    }

    function onData(data) {
        var acc = data.accelerometerData;
        if (acc == null) {
            return;
        }
        var xs = acc.x;
        var ys = acc.y;
        var zs = acc.z;
        if (xs == null || ys == null || zs == null) {
            return;
        }
        var n = xs.size();
        var now = System.getTimer();
        for (var k = 0; k < n; k++) {
            var x = xs[k].toFloat();
            var y = ys[k].toFloat();
            var z = zs[k].toFloat();
            var m = Math.sqrt(x * x + y * y + z * z);
            fast += 0.35 * (m - fast);
            slow += 0.03 * (m - slow);
            var sig = fast - slow;
            var a = sig < 0 ? -sig : sig;
            amp = amp * 0.996;
            if (a > amp) {
                amp = a;
            }
            warm += 1;
            if (warm < 25) {
                continue;
            }
            var hi = amp * 0.45;
            if (hi < MIN_THRESHOLD) {
                hi = MIN_THRESHOLD;
            }
            // Samples arrive in one-second batches at 25 Hz (40 ms apart).
            var t = now - (n - 1 - k) * 40;
            if (armed && sig > hi && t - lastRep > MIN_GAP) {
                armed = false;
                lastRep = t;
                callback.invoke();
            } else if (!armed && sig < hi * 0.25) {
                armed = true;
            }
        }
    }
}
