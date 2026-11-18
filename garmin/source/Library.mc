import Toybox.Lang;

// Exercises and workouts stored on the watch, so it works without the phone.
module Library {
    // [name, type ("reps"/"time"), sets, target reps or seconds, rest s, rep profile (see RepCounter)]
    const EXERCISES = [
        ["Push-Up", "reps", 3, 12, 60, 0],
        ["Knee Push-Up", "reps", 3, 12, 60, 0],
        ["Diamond Push-Up", "reps", 3, 8, 75, 0],
        ["Pike Push-Up", "reps", 3, 8, 75, 0],
        ["Tricep Dip", "reps", 3, 10, 60, 0],
        ["Bench Press", "reps", 4, 8, 120, 0],
        ["Dumbbell Bench Press", "reps", 3, 10, 90, 0],
        ["Overhead Press", "reps", 4, 8, 120, 0],
        ["Dumbbell Shoulder Press", "reps", 3, 10, 90, 0],
        ["Arnold Press", "reps", 3, 10, 75, 0],
        ["Pull-Up", "reps", 4, 6, 120, 2],
        ["Chin-Up", "reps", 4, 6, 120, 2],
        ["Inverted Row", "reps", 3, 10, 75, 2],
        ["Bent-Over Row", "reps", 4, 8, 90, 2],
        ["Dumbbell Row", "reps", 3, 10, 75, 2],
        ["Lat Pulldown", "reps", 3, 10, 90, 2],
        ["Seated Cable Row", "reps", 3, 10, 90, 2],
        ["Bicep Curl", "reps", 3, 12, 60, 3],
        ["Hammer Curl", "reps", 3, 12, 60, 3],
        ["Tricep Extension", "reps", 3, 12, 60, 3],
        ["Skull Crusher", "reps", 3, 10, 75, 3],
        ["Lateral Raise", "reps", 3, 15, 60, 3],
        ["Front Raise", "reps", 3, 12, 60, 3],
        ["Rear Delt Fly", "reps", 3, 15, 60, 3],
        ["Shrug", "reps", 3, 15, 60, 3],
        ["Bodyweight Squat", "reps", 3, 20, 60, 1],
        ["Goblet Squat", "reps", 3, 12, 75, 1],
        ["Back Squat", "reps", 5, 5, 180, 1],
        ["Front Squat", "reps", 4, 6, 150, 1],
        ["Lunge", "reps", 3, 12, 60, 1],
        ["Bulgarian Split Squat", "reps", 3, 10, 75, 1],
        ["Step-Up", "reps", 3, 12, 60, 1],
        ["Deadlift", "reps", 5, 5, 180, 1],
        ["Romanian Deadlift", "reps", 3, 10, 90, 1],
        ["Glute Bridge", "reps", 3, 15, 45, 1],
        ["Hip Thrust", "reps", 4, 10, 90, 1],
        ["Calf Raise", "reps", 3, 20, 45, 1],
        ["Crunch", "reps", 3, 20, 45, 4],
        ["Sit-Up", "reps", 3, 15, 45, 4],
        ["Leg Raise", "reps", 3, 12, 45, 4],
        ["Russian Twist", "reps", 3, 20, 45, 4],
        ["V-Up", "reps", 3, 12, 60, 4],
        ["Jumping Jack", "reps", 3, 30, 30, 5],
        ["Burpee", "reps", 3, 10, 60, 5],
        ["Jump Squat", "reps", 3, 12, 60, 5],
        ["Mountain Climber", "reps", 3, 30, 45, 5],
        ["High Knees", "reps", 3, 30, 30, 5],
        ["Kettlebell Swing", "reps", 3, 15, 60, 5],
        ["Plank", "time", 3, 45, 45, 4],
        ["Side Plank", "time", 3, 30, 30, 4],
        ["Hollow Hold", "time", 3, 30, 45, 4],
        ["Wall Sit", "time", 3, 45, 60, 1],
        ["Dead Hang", "time", 3, 30, 60, 2]
    ];

    // [title, [exercise names...]]
    const WORKOUTS = [
        ["Full Body", ["Push-Up", "Bodyweight Squat", "Inverted Row", "Lunge", "Plank"]],
        ["Upper Body", ["Push-Up", "Pull-Up", "Pike Push-Up", "Tricep Dip", "Bicep Curl"]],
        ["Lower Body", ["Bodyweight Squat", "Lunge", "Glute Bridge", "Calf Raise", "Wall Sit"]],
        ["Push Day", ["Bench Press", "Overhead Press", "Dumbbell Bench Press", "Lateral Raise", "Tricep Extension"]],
        ["Pull Day", ["Pull-Up", "Bent-Over Row", "Lat Pulldown", "Rear Delt Fly", "Hammer Curl"]],
        ["Leg Day", ["Back Squat", "Romanian Deadlift", "Bulgarian Split Squat", "Hip Thrust", "Calf Raise"]],
        ["Dumbbell Full Body", ["Goblet Squat", "Dumbbell Bench Press", "Dumbbell Row", "Dumbbell Shoulder Press", "Romanian Deadlift"]],
        ["Arms", ["Bicep Curl", "Tricep Extension", "Hammer Curl", "Skull Crusher", "Diamond Push-Up"]],
        ["Core Blast", ["Crunch", "Leg Raise", "Russian Twist", "V-Up", "Plank"]],
        ["HIIT Cardio", ["Jumping Jack", "Burpee", "Mountain Climber", "Jump Squat", "High Knees"]],
        ["Push-Up Challenge", ["Push-Up", "Push-Up", "Knee Push-Up"]]
    ];

    function find(name) {
        for (var i = 0; i < EXERCISES.size(); i++) {
            if (EXERCISES[i][0].equals(name)) {
                return EXERCISES[i];
            }
        }
        return null;
    }

    // Rep profile for an exercise name sent by the phone (matched on keywords).
    function profileFor(name) {
        var ex = find(name);
        if (ex != null) {
            return ex[5];
        }
        var n = name.toLower();
        if (has(n, "jump") || has(n, "burpee") || has(n, "climber") || has(n, "knees") || has(n, "swing") || has(n, "skater")) {
            return 5;
        }
        if (has(n, "curl") || has(n, "raise") || has(n, "extension") || has(n, "kickback") || has(n, "fly") || has(n, "shrug") || has(n, "crusher")) {
            return has(n, "leg") || has(n, "calf") ? (has(n, "calf") ? 1 : 4) : 3;
        }
        if (has(n, "pull") || has(n, "chin") || has(n, "row")) {
            return 2;
        }
        if (has(n, "squat") || has(n, "lunge") || has(n, "deadlift") || has(n, "bridge") || has(n, "thrust") || has(n, "step")) {
            return 1;
        }
        if (has(n, "crunch") || has(n, "sit-up") || has(n, "twist") || has(n, "v-up")) {
            return 4;
        }
        return 0;
    }

    function has(s, part) {
        return s.find(part) != null;
    }
}
