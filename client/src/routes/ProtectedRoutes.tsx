import Home from "../pages/Home";
import Share from "../pages/Share";
import Trash from "../pages/Trash";
import ErrorPage from "../pages/ErrorPage";
import ProtectedRoute from "../components/ProtectedRoute";
import RootDirectoryRedirect from "../components/RootDirectoryRedirect";

export const protectedRoutes = [
  {
    element: <ProtectedRoute />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: "/",
        element: <RootDirectoryRedirect />,
      },
      {
        path: "/share",
        element: <Share />,
      },
      {
        path: "/trash",
        element: <Trash />,
      },
      {
        path: "/:id",
        element: <Home />,
      },
    ],
  },
];
