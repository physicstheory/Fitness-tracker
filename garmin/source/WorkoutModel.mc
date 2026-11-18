import Toybox.Application.Storage;
import Toybox.Attention;
import Toybox.Communications;
import Toybox.Lang;
import Toybox.Math;
import Toybox.PersistedContent;
import Toybox.System;
import Toybox.Time;
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
    // Length of the current rest, for the countdown ring.
    var restTotal = 60;
    var exercise = 0;
    var exercises = 0;
    var nextName = "";

    // Offline workouts run from the watch's own library (Library.mc).
    var local = false;
    var finished = false;
    var title = "";
    var sessionReps = 0;
    var sessionSets = 0;
    hidden var plan = [];
    hidden var sessionStart = 0;

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
        if (Config.DEMO > 0) {
            demo(Config.DEMO);
        }
    }

    // Fixed sample states for simulator screenshots (Config.DEMO): 1 ready, 2 counting, 3 resting, 4 summary.
    hidden function demo(state) {
        busy = true;
        online = true;
        active = true;
        name = "Push-Up";
        setNo = 2;
        sets = 4;
        setIndex = 1;
        target = 12;
        exercise = 1;
        exercises = 5;
        lastSync = System.getTimer() + 3600000;
        if (state == 2) {
            counting = true;
            reps = 8;
        } else if (state == 4) {
            active = false;
            finished = true;
            title = "Full Body";
            sessionReps = 146;
            sessionSets = 15;
            sessionStart = System.getTimer() - 1680000;
        } else if (state == 3) {
            setNo = 3;
            restTotal = 90;
            restEnd = System.getTimer() + 52000;
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

    function onTick() as Void {
        if (Config.DEMO > 0) {
            WatchUi.requestUpdate();
            return;
        }
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
            counter.setProfile(local ? plan[exIndex][5] : Library.profileFor(name));
            counter.start();
        }
        vibe(150);
    }

    function finishSet() {
        var result = type.equals("time") ? holdSeconds() : reps;
        counting = false;
        counter.stop();
        reps = 0;
        if (local) {
            sessionReps += result;
            sessionSets += 1;
            if (!advanceLocal()) {
                endLocal();
                vibe(600);
                return;
            }
        } else {
            sendEvent("set", result);
        }
        restTotal = restSec;
        restEnd = System.getTimer() + restSec * 1000;
        vibe(300);
    }

    // ----- Offline workouts -----

    // rows: exercise rows from Library.EXERCISES.
    function startLocal(rows, workoutTitle) {
        plan = rows;
        local = true;
        finished = false;
        active = true;
        title = workoutTitle;
        sessionReps = 0;
        sessionSets = 0;
        sessionStart = System.getTimer();
        restEnd = 0;
        exIndex = 0;
        setIndex = 0;
        loadLocal();
    }

    hidden function loadLocal() {
        var row = plan[exIndex];
        name = row[0];
        type = row[1];
        sets = row[2];
        target = row[3];
        restSec = row[4];
        setNo = setIndex + 1;
        exercise = exIndex + 1;
        exercises = plan.size();
        nextName = exIndex + 1 < plan.size() ? plan[exIndex + 1][0] : "";
    }

    // Moves to the next set or exercise; false when the workout is over.
    hidden function advanceLocal() {
        setIndex += 1;
        if (setIndex >= plan[exIndex][2]) {
            setIndex = 0;
            exIndex += 1;
            if (exIndex >= plan.size()) {
                return false;
            }
        }
        loadLocal();
        return true;
    }

    // Finish (or abandon) the offline workout and save it to the watch's history.
    function endLocal() {
        if (sessionSets > 0) {
            var hist = Storage.getValue("history");
            if (!(hist instanceof Array)) {
                hist = [];
            }
            var mins = (System.getTimer() - sessionStart) / 60000;
            hist.add([title, sessionReps, sessionSets, Time.now().value(), mins]);
            if (hist.size() > 20) {
                hist = hist.slice(hist.size() - 20, null);
            }
            Storage.setValue("history", hist);
        }
        finished = sessionSets > 0;
        local = false;
        active = false;
        restEnd = 0;
        counting = false;
        counter.stop();
        name = "";
    }

    function dismissSummary() {
        finished = false;
    }

    function workoutMinutes() {
        return (System.getTimer() - sessionStart) / 60000;
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

    function onPlan(responseCode as Number, data as Null or Dictionary or String or PersistedContent.Iterator) as Void {
        busy = false;
        if (responseCode == 200 && data instanceof Dictionary) {
            online = true;
            lastSync = System.getTimer();
            if (local || finished) {
                // An offline workout is running; don't let the phone's plan replace it.
                WatchUi.requestUpdate();
                return;
            }
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
                    restTotal = restSec > left ? restSec : left;
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

    function onSent(responseCode as Number, data as Null or Dictionary or String or PersistedContent.Iterator) as Void {
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
