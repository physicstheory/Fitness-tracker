import Toybox.Lang;
import Toybox.Math;
import Toybox.Sensor;
import Toybox.System;

// Counts reps from the accelerometer while rejecting walking, fidgeting and checking the watch.
//
// 1. Gravity is tracked with a slow average; only movement ALONG gravity (up/down) is used for reps.
// 2. A rep is one full down-and-up cycle of the smoothed vertical signal, with hysteresis.
// 3. A cycle only counts if its timing, size and wrist angle fit the exercise profile, it isn't
//    mostly sideways (arm swing), and the signal isn't jolty (footsteps).
// 4. Nothing counts until two matching cycles in a row are seen; both are then added at once.
//    One-off movements (raising the wrist to look at the watch) never reach that bar.
class RepCounter {
    // Profiles: [min rep ms, max rep ms, min up/down swing in milli-g, bouncy (1 = jumping moves)]
    static const PROFILES = [
        [900, 6000, 160, 0],   // 0 press: push-ups, dips, bench, overhead press
        [1000, 7000, 120, 0],  // 1 legs: squats, lunges, deadlifts, bridges
        [1000, 6000, 150, 0],  // 2 pull: pull-ups, rows, pulldowns
        [800, 5000, 180, 0],   // 3 arms: curls, extensions, raises
        [800, 5000, 120, 0],   // 4 core: crunches, sit-ups, leg raises
        [400, 3000, 250, 1]    // 5 cardio: jumping jacks, burpees, jump squats
    ];

    hidden var callback;
    hidden var running = false;
    hidden var minP = 900;
    hidden var maxP = 6000;
    hidden var minAmp = 160.0;
    hidden var bouncy = false;

    hidden var gx = 0.0;
    hidden var gy = 0.0;
    hidden var gz = 0.0;
    hidden var hasG = false;
    hidden var sv = 0.0;
    hidden var q = 0.0;
    hidden var jolt = 0.0;
    hidden var sabs = 0.0;
    hidden var hs = 0.0;
    hidden var t = 0;

    hidden var phase = 0;
    hidden var lo = 0.0;
    hidden var hi = 0.0;
    hidden var hmax = 0.0;
    hidden var cycStart = 0;
    hidden var lastCyc = -1;
    hidden var ux = 0.0;
    hidden var uy = 0.0;
    hidden var uz = 1.0;
    hidden var sx = 0.0;
    hidden var sy = 0.0;
    hidden var sz = 1.0;
    hidden var rx = 0.0;
    hidden var ry = 0.0;
    hidden var rz = 1.0;

    hidden var pending = 0;
    hidden var confirmed = false;
    hidden var bad = 0;
    hidden var ampRef = 160.0;
    hidden var perRef = 0;

    // Calibration: every clean down-and-up cycle is reported to learnCb(p2p, period) instead of counted.
    hidden var learnCb = null;

    hidden var lastStep = -9999;
    hidden var steps = 0;
    hidden var stepArmed = true;

    function initialize(cb) {
        callback = cb;
    }

    function setProfile(id) {
        if (id < 0 || id >= PROFILES.size()) {
            id = 0;
        }
        var p = PROFILES[id];
        minP = p[0];
        maxP = p[1];
        minAmp = p[2].toFloat();
        bouncy = p[3] == 1;
    }

    // A profile learned from the user's own reps (see Store.calibration).
    function setCustom(cal) {
        minP = cal[0];
        maxP = cal[1];
        minAmp = cal[2].toFloat();
    }

    // Loose limits that accept any deliberate up-and-down movement, for calibration.
    function setLearn(cb) {
        learnCb = cb;
        if (cb != null) {
            minP = 300;
            maxP = 8000;
            minAmp = 60.0;
        }
    }

    function start() {
        if (running) {
            return;
        }
        running = true;
        hasG = false;
        sv = 0.0;
        q = 0.0;
        jolt = 0.0;
        sabs = 0.0;
        hs = 0.0;
        t = 0;
        phase = 0;
        lastCyc = -1;
        pending = 0;
        confirmed = false;
        bad = 0;
        ampRef = minAmp;
        perRef = 0;
        lastStep = -9999;
        steps = 0;
        stepArmed = true;
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

    function onData(data as Sensor.SensorData) as Void {
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
        for (var k = 0; k < xs.size(); k++) {
            sample(xs[k].toFloat(), ys[k].toFloat(), zs[k].toFloat());
        }
    }

    hidden function sample(x, y, z) {
        t += 40;
        if (!hasG) {
            gx = x;
            gy = y;
            gz = z;
            hasG = true;
        }
        gx += 0.04 * (x - gx);
        gy += 0.04 * (y - gy);
        gz += 0.04 * (z - gz);
        var gn = Math.sqrt(gx * gx + gy * gy + gz * gz);
        if (gn < 1) {
            gn = 1.0;
        }
        ux = gx / gn;
        uy = gy / gn;
        uz = gz / gn;
        var dx = x - gx;
        var dy = y - gy;
        var dz = z - gz;
        var p = dx * ux + dy * uy + dz * uz;
        sv += 0.2 * (p - sv);
        q += 0.5 * (p - q);
        var sharp = p - q;
        jolt += 0.08 * (abs(sharp) - jolt);
        sabs += 0.05 * (abs(sv) - sabs);

        // Sideways movement (arm swing).
        var hx = dx - p * ux;
        var hy = dy - p * uy;
        var hz = dz - p * uz;
        hs += 0.2 * (Math.sqrt(hx * hx + hy * hy + hz * hz) - hs);

        // Footsteps: sharp spikes 0.35-0.8 s apart.
        if (stepArmed && sharp > 40 && sharp > 0.5 * sabs) {
            stepArmed = false;
            var gap = t - lastStep;
            lastStep = t;
            if (gap >= 350 && gap <= 800) {
                steps = steps < 8 ? steps + 1 : 8;
            } else if (gap > 800) {
                steps = steps > 2 ? steps - 2 : 0;
            }
        } else if (sharp < 8) {
            stepArmed = true;
        }
        if (t - lastStep > 1500) {
            steps = 0;
        }

        // Ignore the first moment (pressing START moves the wrist).
        if (t < 1200) {
            return;
        }
        if (!bouncy && (steps >= 3 || (jolt > 35 && jolt > 0.3 * sabs))) {
            pending = 0;
            phase = 0;
            return;
        }

        var th = minAmp * 0.35;
        if (ampRef * 0.3 > th) {
            th = ampRef * 0.3;
        }
        if (phase == 0) {
            if (sv < -th) {
                phase = 1;
                lo = sv;
                hi = sv;
                hmax = 0.0;
                cycStart = t;
                sx = ux;
                sy = uy;
                sz = uz;
            }
        } else {
            if (sv < lo) {
                lo = sv;
            }
            if (sv > hi) {
                hi = sv;
            }
            if (hs > hmax) {
                hmax = hs;
            }
            if (phase == 1 && sv > th) {
                phase = 2;
            }
            if (phase == 2 && sv < th * 0.3) {
                phase = 0;
                cycle();
            }
        }
        if (lastCyc >= 0 && t - lastCyc > maxP * 1.6 && (confirmed || pending > 0)) {
            confirmed = false;
            pending = 0;
        }
    }

    hidden function cycle() {
        var dur = t - cycStart;
        var p2p = hi - lo;
        var recent = lastCyc >= 0 && t - lastCyc <= maxP * 1.6;
        var per = lastCyc >= 0 ? t - lastCyc : dur;
        var ok = dur >= minP * 0.6 && dur <= maxP && p2p >= minAmp && hmax < 0.45 * p2p;
        if (recent && per < minP) {
            ok = false;
        }
        // Same rhythm as the reps so far.
        if (confirmed && perRef > 0 && recent && (per < 0.45 * perRef || per > 2.5 * perRef)) {
            ok = false;
        }
        if ((pending > 0 || confirmed) && (p2p < 0.45 * ampRef || p2p > 2.5 * ampRef)) {
            ok = false;
        }
        // Same wrist angle as the reps so far (not looking at the watch).
        var dot = confirmed ? ux * rx + uy * ry + uz * rz : ux * sx + uy * sy + uz * sz;
        if (dot < 0.77) {
            ok = false;
        }
        lastCyc = t;
        if (!ok) {
            if (confirmed) {
                bad += 1;
                if (bad >= 2) {
                    confirmed = false;
                    pending = 0;
                }
            } else {
                pending = 0;
            }
            return;
        }
        bad = 0;
        if (learnCb != null) {
            learnCb.invoke(p2p, recent ? per : dur * 2);
            return;
        }
        if (recent) {
            perRef = perRef == 0 ? per : (perRef * 0.7 + per * 0.3).toNumber();
        }
        if (pending == 0 && !confirmed) {
            ampRef = p2p;
        } else {
            ampRef = ampRef * 0.7 + p2p * 0.3;
        }
        if (confirmed) {
            callback.invoke();
        } else {
            pending += 1;
            if (pending >= 2) {
                confirmed = true;
                rx = ux;
                ry = uy;
                rz = uz;
                for (var i = 0; i < pending; i++) {
                    callback.invoke();
                }
                pending = 0;
            }
        }
    }

    hidden function abs(v) {
        return v < 0 ? -v : v;
    }
}
