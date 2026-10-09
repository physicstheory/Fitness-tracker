import { useEffect } from "react";
import { BarChart3, Dumbbell, Home, MessageCircle, Target } from "lucide-react";
import { NavProvider, useNav, type Route, type Tab } from "./nav";
import { Today } from "./screens/Today";
import { Programs, ProgramDetail } from "./screens/Programs";
import { Goals } from "./screens/Goals";
import { Progress } from "./screens/Progress";
import { Coach } from "./screens/Coach";
import { Workout } from "./screens/Workout";
import { Import } from "./screens/Import";
import { Settings } from "./screens/Settings";
import { ExerciseDetail, Library } from "./screens/Exercises";

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "today", label: "Today", icon: Home },
  { id: "programs", label: "Programs", icon: Dumbbell },
  { id: "goals", label: "Goals", icon: Target },
  { id: "progress", label: "Progress", icon: BarChart3 },
  { id: "coach", label: "Coach", icon: MessageCircle },
];

function RouteView({ route }: { route: Route }) {
  switch (route.name) {
    case "program":
      return <ProgramDetail id={route.id} />;
    case "workout":
      return <Workout programId={route.programId} dayId={route.dayId} exerciseId={route.exerciseId} />;
    case "import":
      return <Import />;
    case "exercise":
      return <ExerciseDetail id={route.id} />;
    case "library":
      return <Library />;
    case "settings":
      return <Settings notice={route.notice} />;
  }
}

let spotifyHandled = false;

function Shell({ spotifyReturn }: { spotifyReturn?: { notice?: string } }) {
  const { tab, setTab, stack, push } = useNav();
  // Back from Spotify sign-in: show the music settings.
  useEffect(() => {
    if (!spotifyReturn || spotifyHandled) return;
    spotifyHandled = true;
    push({ name: "settings", notice: spotifyReturn.notice });
  }, [spotifyReturn, push]);
  return (
    <div className="app">
      {tab === "today" && <Today />}
      {tab === "programs" && <Programs />}
      {tab === "goals" && <Goals />}
      {tab === "progress" && <Progress />}
      {tab === "coach" && <Coach />}
      <nav className="nav">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)} aria-current={tab === id}>
            <Icon size={22} strokeWidth={tab === id ? 2.5 : 2} />
            {label}
          </button>
        ))}
      </nav>
      {stack.map((r, i) => (
        <RouteView key={i + r.name} route={r} />
      ))}
    </div>
  );
}

export default function App({ spotifyReturn }: { spotifyReturn?: { notice?: string } }) {
  return (
    <NavProvider>
      <Shell spotifyReturn={spotifyReturn} />
    </NavProvider>
  );
}
