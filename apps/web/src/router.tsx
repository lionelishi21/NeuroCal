import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { Lab } from "./routes/Lab";
import { Today } from "./routes/Today";

const rootRoute = createRootRoute({ component: Outlet });

const todayRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Today });
const labRoute = createRoute({ getParentRoute: () => rootRoute, path: "/lab", component: Lab });

export const router = createRouter({ routeTree: rootRoute.addChildren([todayRoute, labRoute]) });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
