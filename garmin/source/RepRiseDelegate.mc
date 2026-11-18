import Toybox.Lang;
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
