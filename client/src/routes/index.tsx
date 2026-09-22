import { createBrowserRouter } from "react-router-dom";

import { protectedRoutes } from "./ProtectedRoutes";
import { publicRoutes } from "./PublicRoutes";
import {sharedRoutes} from "./SharedRoutes"


const allRoutes = [
  ...protectedRoutes,
  ...publicRoutes,
  ...sharedRoutes,
];

const router = createBrowserRouter(allRoutes);

export default router;