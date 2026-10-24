import Toybox.Lang;
import Toybox.WatchUi;

// START/ENTER starts or finishes a set (or skips rest). UP/DOWN fix the count. Tapping the screen adds a rep.
class RepRiseDelegate extends WatchUi.BehaviorDelegate {
    hidden var model;

    function initialize(m) {
        BehaviorDelegate.initialize();
        model = m;
    }

    function onSelect() {
        if (model.counting) {
            model.finishSet();
        } else {
            model.skipRest();
            model.startSet();
        }
        WatchUi.requestUpdate();
        return true;
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
