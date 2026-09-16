import { createBrowserRouter } from "react-router-dom";

import { protectedRoutes } from "./ProtectedRoutes";
import { publicRoutes } from "./PublicRoutes";

const allRoutes = [
  ...protectedRoutes,
  ...publicRoutes,
];

const router = createBrowserRouter(allRoutes);

export default router;