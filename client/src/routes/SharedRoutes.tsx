import SharedResourcePage from "../pages/SharedAccess";

export const sharedRoutes = [
  {
    path: "/share/public/:token/*",
    element: <SharedResourcePage accessType="public" />,
  },
  {
    path: "/share/restricted/:token/*",
    element: <SharedResourcePage accessType="restricted" />,
  },
];