import Toybox.Lang;
import Toybox.Time;
import Toybox.Time.Gregorian;
import Toybox.Application.Storage;
import Toybox.WatchUi;

// START/ENTER starts or finishes a set (or skips rest). UP/DOWN fix the count. Tapping the screen adds a rep.
// With no workout from the phone, START opens the on-watch menu: workouts, exercises and history.
class RepRiseDelegate extends WatchUi.BehaviorDelegate {
    hidden var model;

    function initialize(m) {
        BehaviorDelegate.initialize();
        model = m;
    }

    function onSelect() {
        if (model.finished) {
            model.dismissSummary();
        } else if (model.counting) {
            model.finishSet();
        } else if (model.restLeft() > 0) {
            model.skipRest();
            model.startSet();
        } else if (model.active) {
            model.startSet();
        } else {
            openMainMenu(model);
        }
        WatchUi.requestUpdate();
        return true;
    }

    function onMenu() {
        if (!model.counting && !model.active) {
            openMainMenu(model);
            return true;
        }
        return false;
    }

    function onBack() {
        if (model.finished) {
            model.dismissSummary();
            WatchUi.requestUpdate();
            return true;
        }
        if (model.local) {
            if (model.counting) {
                model.finishSet();
                WatchUi.requestUpdate();
                return true;
            }
            var dialog = new WatchUi.Confirmation("End workout?");
            WatchUi.pushView(dialog, new EndWorkoutDelegate(model), WatchUi.SLIDE_IMMEDIATE);
            return true;
        }
        return false;
    }

    function onPreviousPage() {
        if (model.counting) {
            model.adjust(1);
            return true;
        }
        return false;
    }

    function onNextPage() {
        if (model.counting) {
            model.adjust(-1);
            return true;
        }
        return false;
    }

    function onTap(evt) {
        if (model.counting && !model.type.equals("time")) {
            model.adjust(1);
            return true;
        }
        return false;
    }
}

function openMainMenu(model) {
    var menu = new WatchUi.Menu2({ :title => "RepRise" });
    menu.addItem(new WatchUi.MenuItem("Workouts", Library.WORKOUTS.size() + " saved on watch", :workouts, {}));
    menu.addItem(new WatchUi.MenuItem("Exercises", Library.EXERCISES.size() + " exercises", :exercises, {}));
    menu.addItem(new WatchUi.MenuItem("Free set", "Count any exercise", :free, {}));
    menu.addItem(new WatchUi.MenuItem("History", "Workouts done on watch", :history, {}));
    WatchUi.pushView(menu, new MainMenuDelegate(model), WatchUi.SLIDE_UP);
}

class MainMenuDelegate extends WatchUi.Menu2InputDelegate {
    hidden var model;

    function initialize(m) {
        Menu2InputDelegate.initialize();
        model = m;
    }

    function onSelect(item) {
        var id = item.getId();
        if (id == :workouts) {
            var menu = new WatchUi.Menu2({ :title => "Workouts" });
            for (var i = 0; i < Library.WORKOUTS.size(); i++) {
                var w = Library.WORKOUTS[i];
                menu.addItem(new WatchUi.MenuItem(w[0], w[1].size() + " exercises", i, {}));
            }
            WatchUi.pushView(menu, new WorkoutMenuDelegate(model), WatchUi.SLIDE_LEFT);
        } else if (id == :exercises) {
            var menu = new WatchUi.Menu2({ :title => "Exercises" });
            for (var i = 0; i < Library.EXERCISES.size(); i++) {
                var e = Library.EXERCISES[i];
                var goal = e[1].equals("time") ? e[3] + "s" : e[3] + " reps";
                menu.addItem(new WatchUi.MenuItem(e[0], e[2] + " x " + goal, i, {}));
            }
            WatchUi.pushView(menu, new ExerciseMenuDelegate(model), WatchUi.SLIDE_LEFT);
        } else if (id == :free) {
            WatchUi.popView(WatchUi.SLIDE_DOWN);
            model.startSet();
        } else if (id == :history) {
            var menu = new WatchUi.Menu2({ :title => "History" });
            var hist = Storage.getValue("history");
            if (hist instanceof Array && hist.size() > 0) {
                for (var i = hist.size() - 1; i >= 0; i--) {
                    var h = hist[i];
                    var d = Gregorian.info(new Time.Moment(h[3]), Time.FORMAT_SHORT);
                    var when = d.day + "/" + d.month;
                    menu.addItem(new WatchUi.MenuItem(h[0], when + " · " + h[1] + " reps · " + h[2] + " sets", i, {}));
                }
            } else {
                menu.addItem(new WatchUi.MenuItem("No workouts yet", "Finish one on the watch", :none, {}));
            }
            WatchUi.pushView(menu, new WatchUi.Menu2InputDelegate(), WatchUi.SLIDE_LEFT);
        }
    }
}

class WorkoutMenuDelegate extends WatchUi.Menu2InputDelegate {
    hidden var model;

    function initialize(m) {
        Menu2InputDelegate.initialize();
        model = m;
    }

    function onSelect(item) {
        var w = Library.WORKOUTS[item.getId() as Number];
        var rows = [];
        for (var i = 0; i < w[1].size(); i++) {
            var ex = Library.find(w[1][i]);
            if (ex != null) {
                rows.add(ex);
            }
        }
        if (rows.size() > 0) {
            model.startLocal(rows, w[0]);
        }
        WatchUi.popView(WatchUi.SLIDE_IMMEDIATE);
        WatchUi.popView(WatchUi.SLIDE_DOWN);
    }
}

class ExerciseMenuDelegate extends WatchUi.Menu2InputDelegate {
    hidden var model;

    function initialize(m) {
        Menu2InputDelegate.initialize();
        model = m;
    }

    function onSelect(item) {
        var ex = Library.EXERCISES[item.getId() as Number];
        model.startLocal([ex], ex[0]);
        WatchUi.popView(WatchUi.SLIDE_IMMEDIATE);
        WatchUi.popView(WatchUi.SLIDE_DOWN);
    }
}

class EndWorkoutDelegate extends WatchUi.ConfirmationDelegate {
    hidden var model;

    function initialize(m) {
        ConfirmationDelegate.initialize();
        model = m;
    }

    function onResponse(response) {
        if (response == WatchUi.CONFIRM_YES) {
            model.endLocal();
            WatchUi.requestUpdate();
        }
        return true;
    }
}
