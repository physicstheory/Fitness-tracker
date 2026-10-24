import Toybox.Application.Storage;
import Toybox.Attention;
import Toybox.Communications;
import Toybox.Lang;
import Toybox.Math;
import Toybox.System;
import Toybox.Timer;
import Toybox.WatchUi;

// Workout state on the watch, and the link to the RepRise server (through Garmin Connect on the phone).
class WorkoutModel {
    // 4-digit code the user enters in the RepRise phone app.
    var code = "";

    // Current exercise, as sent by the phone.
    var online = false;
    var active = false;
    var name = "";
    var type = "reps";
    var exIndex = 0;
    var setIndex = 0;
    var setNo = 1;
    var sets = 0;
    var target = 0;
    var restSec = 60;
    var exercise = 0;
    var exercises = 0;
    var nextName = "";

    // Local state.
    var counting = false;
    var reps = 0;
    hidden var restEnd = 0;
    hidden var holdStart = 0;
    hidden var lastSync = 0;
    hidden var counter;
    hidden var timer;
    hidden var busy = false;
    hidden var lastSentReps = -1;
    hidden var lastSentAt = 0;
    hidden var ticks = 0;

    function initialize() {
        counter = new RepCounter(method(:onRep));
        var saved = Storage.getValue("code");
        if (saved instanceof String) {
            code = saved;
        } else {
            Math.srand(System.getTimer());
            code = (1000 + (Math.rand() % 9000).abs()).format("%d");
            Storage.setValue("code", code);
        }
    }

    function start() {
        timer = new Timer.Timer();
        timer.start(method(:onTick), 1000, true);
        fetchPlan();
    }

    function stop() {
        if (timer != null) {
            timer.stop();
        }
        counter.stop();
    }

    function onTick() {
        ticks += 1;
        var now = System.getTimer();
        if (restEnd != 0 && now >= restEnd) {
            restEnd = 0;
            vibe(500);
        }
        if (counting) {
            // Stream the live count to the phone, at most every 1.5 s.
            if (reps != lastSentReps && now - lastSentAt > 1500) {
                sendEvent("reps", reps);
            }
        } else if (ticks % 3 == 0) {
            fetchPlan();
        }
        if (online && now - lastSync > 15000) {
            online = false;
        }
        WatchUi.requestUpdate();
    }

    // ----- Sets -----

    function startSet() {
        counting = true;
        reps = 0;
        restEnd = 0;
        lastSentReps = -1;
        holdStart = System.getTimer();
        if (!type.equals("time")) {
            counter.start();
        }
        vibe(150);
    }

    function finishSet() {
        counting = false;
        counter.stop();
        var result = reps;
        if (type.equals("time")) {
            result = holdSeconds();
        }
        sendEvent("set", result);
        restEnd = System.getTimer() + restSec * 1000;
        reps = 0;
        vibe(300);
    }

    function onRep() {
        reps += 1;
        vibe(40);
        WatchUi.requestUpdate();
    }

    function adjust(delta) {
        reps += delta;
        if (reps < 0) {
            reps = 0;
        }
        WatchUi.requestUpdate();
    }

    function holdSeconds() {
        return counting ? (System.getTimer() - holdStart) / 1000 : 0;
    }

    function restLeft() {
        if (restEnd == 0) {
            return 0;
        }
        var left = (restEnd - System.getTimer()) / 1000;
        return left > 0 ? left : 0;
    }

    function skipRest() {
        restEnd = 0;
    }

    function vibe(ms) {
        if (Attention has :vibrate) {
            Attention.vibrate([new Attention.VibeProfile(60, ms)]);
        }
    }

    // ----- Network -----

    function fetchPlan() {
        if (busy) {
            return;
        }
        busy = true;
        Communications.makeWebRequest(
            Config.SERVER_URL + "/api/watch/plan",
            { "code" => code },
            {
                :method => Communications.HTTP_REQUEST_METHOD_GET,
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
            },
            method(:onPlan)
        );
    }

    function onPlan(responseCode, data) {
        busy = false;
        if (responseCode == 200 && data instanceof Dictionary) {
            online = true;
            lastSync = System.getTimer();
            active = data["active"] == true;
            name = str(data["name"]);
            type = str(data["type"]);
            exIndex = num(data["i"]);
            setIndex = num(data["s"]);
            setNo = num(data["set"]);
            sets = num(data["sets"]);
            target = num(data["target"]);
            restSec = num(data["rest"]);
            exercise = num(data["exercise"]);
            exercises = num(data["exercises"]);
            nextName = str(data["next"]);
            // Pick up a rest the phone started (e.g. a set finished on the phone).
            if (str(data["phase"]).equals("rest") && restEnd == 0 && !counting) {
                var left = num(data["restLeft"]);
                if (left > 0) {
                    restEnd = System.getTimer() + left * 1000;
                }
            }
        } else {
            online = false;
        }
        WatchUi.requestUpdate();
    }

    function sendEvent(kind, value) {
        lastSentAt = System.getTimer();
        if (kind.equals("reps")) {
            lastSentReps = value;
        }
        Communications.makeWebRequest(
            Config.SERVER_URL + "/api/watch/event",
            { "code" => code, "type" => kind, "i" => exIndex, "s" => setIndex, "reps" => value },
            {
                :method => Communications.HTTP_REQUEST_METHOD_POST,
                :headers => { "Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON },
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
            },
            method(:onSent)
        );
        if (kind.equals("set")) {
            // Refresh soon so the next set or exercise shows up.
            ticks = 2;
        }
    }

    function onSent(responseCode, data) {
        if (responseCode == 200) {
            online = true;
            lastSync = System.getTimer();
        }
    }

    hidden function str(v) {
        if (v instanceof String) {
            return v;
        }
        return v == null ? "" : v.toString();
    }

    hidden function num(v) {
        if (v instanceof Number) {
            return v;
        }
        if (v instanceof Float || v instanceof Double || v instanceof Long) {
            return v.toNumber();
        }
        return 0;
    }
}
