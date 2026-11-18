import Toybox.Lang;
import Toybox.WatchUi;

// Keeps count of the menu screens pushed over the workout screen, so a workout can start from deep in a menu.
module Nav {
    var depth = 0;

    function push(view, delegate) {
        depth += 1;
        WatchUi.pushView(view, delegate, WatchUi.SLIDE_LEFT);
    }

    // A list screen driven by a handler with onPick(index), items() and optionally refresh().
    function pushList(title, handler) {
        var view = new ListView(title, handler.items());
        view.refresher = handler;
        handler.view = view;
        push(view, new ListDelegate(view, handler));
    }

    function pop() {
        if (depth > 0) {
            depth -= 1;
        }
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
    }

    function popAll() {
        while (depth > 0) {
            depth -= 1;
            WatchUi.popView(WatchUi.SLIDE_IMMEDIATE);
        }
    }
}
