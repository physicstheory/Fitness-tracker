import Toybox.Application.Storage;
import Toybox.Lang;
import Toybox.Time;
import Toybox.Time.Gregorian;
import Toybox.WatchUi;

// Every on-watch menu. Each handler gives the list items and reacts to a pick.

function openMainMenu(model) {
    Nav.pushList("RepRise", new MainHandler(model));
}

function schemeText(type, sets, target, rest) {
    var goal = target == 0 ? "max" : type.equals("time") ? target + "s" : target.toString();
    return sets + " x " + goal + " · " + rest + "s rest";
}

class MainHandler {
    var view;
    hidden var model;

    function initialize(m) {
        model = m;
    }

    function items() {
        var mine = Store.myWorkouts().size();
        return [
            ["Workouts", Library.WORKOUTS.size() + " ready to go", 1],
            ["My workouts", mine == 0 ? "Build your own" : mine + " saved", 0],
            ["Exercises", Library.EXERCISES.size() + " · edit & calibrate", 0],
            ["Rep counter", "Just count, no target", 0],
            ["History", "Done on this watch", 0]
        ];
    }

    function refresh() {
        view.setItems(items());
    }

    function onPick(i) {
        if (i == 0) {
            Nav.pushList("Workouts", new WorkoutsHandler(model));
        } else if (i == 1) {
            Nav.pushList("My workouts", new MyWorkoutsHandler(model));
        } else if (i == 2) {
            Nav.pushList("Exercises", new ExercisesHandler(model, false));
        } else if (i == 3) {
            Nav.pushList("Rep counter", new ExercisesHandler(model, true));
        } else {
            Nav.pushList("History", new HistoryHandler());
        }
    }
}

class WorkoutsHandler {
    var view;
    hidden var model;

    function initialize(m) {
        model = m;
    }

    function items() {
        var list = [];
        for (var i = 0; i < Library.WORKOUTS.size(); i++) {
            var w = Library.WORKOUTS[i];
            list.add([w[0], w[1].size() + " exercises", 0]);
        }
        return list;
    }

    function onPick(i) {
        var w = Library.WORKOUTS[i];
        var rows = [];
        for (var k = 0; k < w[1].size(); k++) {
            var ex = Store.exercise(w[1][k]);
            if (ex != null) {
                rows.add(ex);
            }
        }
        Nav.popAll();
        model.startLocal(rows, w[0]);
    }
}

class MyWorkoutsHandler {
    var view;
    hidden var model;

    function initialize(m) {
        model = m;
    }

    function items() {
        var list = [["New workout", "Pick exercises", 1]];
        var mine = Store.myWorkouts();
        for (var i = 0; i < mine.size(); i++) {
            list.add([mine[i][0], mine[i][1].size() + " exercises", 0]);
        }
        return list;
    }

    function refresh() {
        view.setItems(items());
    }

    function onPick(i) {
        if (i == 0) {
            Nav.pushList("Pick exercises", new PickerHandler(-1));
        } else {
            Nav.pushList("My workout", new DetailHandler(model, i - 1));
        }
    }
}

// Multi-select exercises; saves a new workout (index -1) or adds to an existing one.
class PickerHandler {
    var view;
    hidden var target;
    hidden var picked = [];

    function initialize(t) {
        target = t;
    }

    function items() {
        var list = [["Save", picked.size() == 0 ? "Tick exercises below" : picked.size() + " picked", 1]];
        for (var i = 0; i < Library.EXERCISES.size(); i++) {
            var name = Library.EXERCISES[i][0];
            list.add([name, "", picked.indexOf(name) >= 0 ? 2 : 3]);
        }
        return list;
    }

    function onPick(i) {
        if (i > 0) {
            var name = Library.EXERCISES[i - 1][0];
            if (picked.indexOf(name) >= 0) {
                picked.remove(name);
            } else {
                picked.add(name);
            }
            view.setItems(items());
            return;
        }
        if (picked.size() == 0) {
            return;
        }
        var entries = [];
        for (var k = 0; k < picked.size(); k++) {
            var ex = Store.exercise(picked[k]);
            entries.add([ex[0], ex[2], ex[3], ex[4]]);
        }
        var mine = Store.myWorkouts();
        if (target < 0) {
            mine.add(["My Workout " + (mine.size() + 1), entries]);
        } else {
            mine[target][1].addAll(entries);
        }
        Store.saveMyWorkouts(mine);
        Nav.pop();
    }
}

class DetailHandler {
    var view;
    hidden var model;
    hidden var idx;

    function initialize(m, i) {
        model = m;
        idx = i;
    }

    hidden function workout() {
        var mine = Store.myWorkouts();
        return idx < mine.size() ? mine[idx] : null;
    }

    function items() {
        var w = workout();
        if (w == null) {
            return [["Deleted", "", 0]];
        }
        var entries = w[1];
        var list = [["Start", w[0], 1]];
        for (var i = 0; i < entries.size(); i++) {
            var e = entries[i];
            var base = Library.find(e[0]);
            list.add([e[0], schemeText(base != null ? base[1] : "reps", e[1], e[2], e[3]), 0]);
        }
        list.add(["Add exercises", "", 0]);
        list.add(["Delete workout", "", 4]);
        return list;
    }

    function refresh() {
        view.setItems(items());
    }

    function onPick(i) {
        var w = workout();
        if (w == null) {
            Nav.pop();
            return;
        }
        var n = w[1].size();
        if (i == 0) {
            var rows = Store.rowsFor(w[1]);
            if (rows.size() > 0) {
                Nav.popAll();
                model.startLocal(rows, w[0]);
            }
        } else if (i <= n) {
            var e = w[1][i - 1];
            var base = Library.find(e[0]);
            var v = new SetupView(e[0], base != null && base[1].equals("time"), e[1], e[2], e[3], "START  save");
            Nav.push(v, new SetupDelegate(v, new WorkoutItemEdit(idx, i - 1)));
        } else if (i == n + 1) {
            Nav.pushList("Add exercises", new PickerHandler(idx));
        } else {
            var mine = Store.myWorkouts();
            var kept = [];
            for (var k = 0; k < mine.size(); k++) {
                if (k != idx) {
                    kept.add(mine[k]);
                }
            }
            Store.saveMyWorkouts(kept);
            Nav.pop();
        }
    }
}

// Saves sets/reps/rest for one exercise in one of my workouts.
class WorkoutItemEdit {
    hidden var w;
    hidden var e;

    function initialize(wi, ei) {
        w = wi;
        e = ei;
    }

    function onSetup(values) {
        var mine = Store.myWorkouts();
        var entry = mine[w][1][e];
        mine[w][1][e] = [entry[0], values[0], values[1], values[2]];
        Store.saveMyWorkouts(mine);
        Nav.pop();
    }
}

class ExerciseEdit {
    hidden var name;

    function initialize(n) {
        name = n;
    }

    function onSetup(values) {
        Store.saveExercise(name, values[0], values[1], values[2]);
        Nav.pop();
    }
}

// All exercises; in counter mode picking one just counts reps with no target.
class ExercisesHandler {
    var view;
    hidden var model;
    hidden var counterMode;

    function initialize(m, c) {
        model = m;
        counterMode = c;
    }

    function items() {
        var list = [];
        for (var i = 0; i < Library.EXERCISES.size(); i++) {
            var base = Library.EXERCISES[i];
            if (counterMode && base[1].equals("time")) {
                continue;
            }
            var ex = Store.exercise(base[0]);
            var cal = Store.calibration(base[0]) != null ? " · tuned" : "";
            list.add([ex[0], counterMode ? (cal.length() > 0 ? "Tuned to you" : "Count reps") : schemeText(ex[1], ex[2], ex[3], ex[4]) + cal, 0]);
        }
        return list;
    }

    function refresh() {
        view.setItems(items());
    }

    function onPick(i) {
        var name = view.items[i][0];
        if (counterMode) {
            var base = Library.find(name);
            Nav.popAll();
            model.startLocal([[name, "reps", 1, 0, 0, base[5]]], name);
        } else {
            Nav.pushList(name, new ExerciseActions(model, name));
        }
    }
}

class ExerciseActions {
    var view;
    hidden var model;
    hidden var name;

    function initialize(m, n) {
        model = m;
        name = n;
    }

    function items() {
        var ex = Store.exercise(name);
        var list = [["Start", schemeText(ex[1], ex[2], ex[3], ex[4]), 1], ["Edit sets & reps", "", 0]];
        if (ex[1].equals("reps")) {
            var tuned = Store.calibration(name) != null;
            list.add(["Calibrate counting", tuned ? "Tuned to you · redo" : "Teach it your reps", 0]);
            if (tuned) {
                list.add(["Reset calibration", "", 4]);
            }
        }
        return list;
    }

    function refresh() {
        view.setItems(items());
    }

    function onPick(i) {
        var ex = Store.exercise(name);
        if (i == 0) {
            Nav.popAll();
            model.startLocal([ex], name);
        } else if (i == 1) {
            var v = new SetupView(name, ex[1].equals("time"), ex[2], ex[3], ex[4], "START  save");
            Nav.push(v, new SetupDelegate(v, new ExerciseEdit(name)));
        } else if (i == 2) {
            var c = new CalibrateView(name, ex[5]);
            Nav.push(c, new CalibrateDelegate(c));
        } else {
            Store.clearCalibration(name);
            refresh();
        }
    }
}

class HistoryHandler {
    var view;

    function initialize() {
    }

    function items() {
        var list = [];
        var hist = Storage.getValue("history");
        if (hist instanceof Array) {
            for (var i = hist.size() - 1; i >= 0; i--) {
                var h = hist[i];
                var d = Gregorian.info(new Time.Moment(h[3]), Time.FORMAT_SHORT);
                list.add([h[0], d.day + "/" + d.month + " · " + h[1] + " reps · " + h[2] + " sets", 0]);
            }
        }
        if (list.size() == 0) {
            list.add(["No workouts yet", "Finish one on the watch", 0]);
        }
        return list;
    }

    function onPick(i) {
    }
}
