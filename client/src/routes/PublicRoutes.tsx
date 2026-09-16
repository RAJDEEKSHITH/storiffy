import Login from "../pages/Login";
import Register from "../pages/Register";
import PublicRoute from "../components/PublicRoute";

export const publicRoutes = [{
  element: <PublicRoute />,
  children: [
    {
      path: "/login",
      element: <Login />,
    },
    {
      path: "/register",
      element: <Register />,
    },
  ],
}];