import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Tab = "today" | "programs" | "goals" | "progress" | "coach";

export type Route =
  | { name: "program"; id: string }
  | { name: "workout"; programId?: string; dayId?: string; exerciseId?: string }
  | { name: "import" }
  | { name: "exercise"; id: string }
  | { name: "library" }
  | { name: "settings" };

interface Nav {
  tab: Tab;
  setTab: (t: Tab) => void;
  stack: Route[];
  push: (r: Route) => void;
  pop: () => void;
  replace: (r: Route) => void;
  reset: () => void;
}

const NavContext = createContext<Nav | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>("today");
  const [stack, setStack] = useState<Route[]>([]);

  // Hook the phone's back button / gesture into the overlay stack.
  useEffect(() => {
    const onPop = () => setStack((s) => s.slice(0, -1));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const push = useCallback((r: Route) => {
    history.pushState({ overlay: true }, "");
    setStack((s) => [...s, r]);
  }, []);
  const pop = useCallback(() => history.back(), []);
  const replace = useCallback((r: Route) => setStack((s) => [...s.slice(0, -1), r]), []);
  const reset = useCallback(() => {
    setStack((s) => {
      if (s.length) history.go(-s.length);
      return s;
    });
  }, []);
  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    window.scrollTo({ top: 0 });
  }, []);

  const value = useMemo(() => ({ tab, setTab, stack, push, pop, replace, reset }), [tab, setTab, stack, push, pop, replace, reset]);
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error("useNav outside NavProvider");
  return nav;
}
