import Toybox.Application.Storage;
import Toybox.Lang;

// Everything the user customises on the watch, kept in on-watch storage.
module Store {
    // An exercise row ([name, type, sets, target, rest, profile]) with the user's own sets/reps/rest.
    function exercise(name) {
        var base = Library.find(name);
        if (base == null) {
            return null;
        }
        var o = Storage.getValue("ex:" + name);
        if (o instanceof Array && o.size() == 3) {
            return [base[0], base[1], o[0], o[1], o[2], base[5]];
        }
        return base;
    }

    function saveExercise(name, sets, target, rest) {
        Storage.setValue("ex:" + name, [sets, target, rest]);
    }

    // My workouts: [[title, [[name, sets, target, rest], ...]], ...]
    function myWorkouts() {
        var w = Storage.getValue("myWorkouts");
        return w instanceof Array ? w : [];
    }

    function saveMyWorkouts(list) {
        Storage.setValue("myWorkouts", list);
    }

    // Exercise rows for one of my workouts.
    function rowsFor(entries) {
        var rows = [];
        for (var i = 0; i < entries.size(); i++) {
            var e = entries[i];
            var base = Library.find(e[0]);
            if (base != null) {
                rows.add([e[0], base[1], e[1], e[2], e[3], base[5]]);
            }
        }
        return rows;
    }

    // Rep counting learned from the user's own reps: [min rep ms, max rep ms, min swing mg].
    function calibration(name) {
        var c = Storage.getValue("cal:" + name);
        return c instanceof Array && c.size() == 3 ? c : null;
    }

    function saveCalibration(name, cal) {
        Storage.setValue("cal:" + name, cal);
    }

    function clearCalibration(name) {
        Storage.deleteValue("cal:" + name);
    }
}
