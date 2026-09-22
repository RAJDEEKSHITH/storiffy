import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";

const ErrorPage = () => {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-red-50 text-red-500">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-slate-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          The page could not be loaded. Please try again.
        </p>
        <Button
          className="mt-5 bg-blue-600 hover:bg-blue-700"
          onClick={() => navigate(-1)}
        >
          Go back
        </Button>
      </div>
    </main>
  );
};

export default ErrorPage;
