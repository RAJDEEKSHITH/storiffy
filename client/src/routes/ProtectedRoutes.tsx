import ProtectedRoute from "../components/ProtectedRoute";
import Home from "../pages/Home";

export const protectedRoutes = [
  {
    element: <ProtectedRoute />,

    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/:id",
        element: <Home />,
      },
    ],
  },
];