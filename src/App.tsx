import { useEffect, useState } from "react";
import ComingSoonPage from "./pages/ComingSoonPage";
import StatsPage from "./pages/StatsPage";
import SortearPage from "./pages/SortearPage";

/** Rutas internas reconocidas (path o hash). Cambiá el valor para mover la URL. */
const STATS_PATHS = new Set<string>([
  "/contador",
  "/stats",
  "/dashboard",
]);

const SORTEO_PATHS = new Set<string>([
  "/sorteo",
  "/sorteos",
  "/sortear",
  "/raffle",
]);

type Route = "stats" | "sorteo" | "home";

function getRouteKey(): Route {
  if (typeof window === "undefined") return "home";
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (STATS_PATHS.has(path)) return "stats";
  if (SORTEO_PATHS.has(path)) return "sorteo";
  const hash = window.location.hash.replace(/^#/, "").replace(/\/+$/, "");
  const hashKey = hash.startsWith("/") ? hash : `/${hash}`;
  if (hash && STATS_PATHS.has(hashKey)) return "stats";
  if (hash && SORTEO_PATHS.has(hashKey)) return "sorteo";
  return "home";
}

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => getRouteKey());
  useEffect(() => {
    const onChange = () => setRoute(getRouteKey());
    window.addEventListener("popstate", onChange);
    window.addEventListener("hashchange", onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener("hashchange", onChange);
    };
  }, []);
  return route;
}

function App() {
  const route = useRoute();
  if (route === "stats") return <StatsPage />;
  if (route === "sorteo") return <SortearPage />;
  return <ComingSoonPage />;
}

export default App;
