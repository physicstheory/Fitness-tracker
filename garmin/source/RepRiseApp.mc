import Toybox.Application;
import Toybox.Lang;
import Toybox.WatchUi;

// RepRise for Garmin: counts reps from wrist movement and syncs sets with the RepRise phone app.
class RepRiseApp extends Application.AppBase {
    var model;

    function initialize() {
        AppBase.initialize();
        model = new WorkoutModel();
    }

    function onStart(state) {
        model.start();
    }

    function onStop(state) {
        model.stop();
    }

    function getInitialView() {
        return [new RepRiseView(model), new RepRiseDelegate(model)];
    }
}
