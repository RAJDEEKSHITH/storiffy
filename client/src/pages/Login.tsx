import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";

import { loginUser } from "../api/authApi";
import { getErrorMessage } from "../lib/error";
import { setUser } from "../store/auth/authSlice";
import type { AppDispatch } from "../store/store";
import { toast } from "../components/ui/toast";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const Login = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setLoading(true);

    try {
      const user = await loginUser({
        email,
        password,
      });

      dispatch(setUser(user));

      toast.add({
        title: "Welcome back",
        type: "success",
      });

      const destination =
        (location.state as { from?: string } | null)?.from ??
        `/${user.rootDirectoryId}`;

      navigate(destination, { replace: true });
    } catch (error) {
      console.error("Login failed:", error);
      toast.add({
        title: "Unable to sign in",
        description: getErrorMessage(
          error,
          "Please check your credentials.",
        ),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md border-slate-200 bg-white shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-slate-900">
            Welcome back
          </CardTitle>
          <CardDescription>
            Sign in to your OmniSpace account
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="email">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading
                ? "Signing in..."
                : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link
              to="/register"
              state={location.state}
              className="font-medium text-blue-600 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
};

export default Login;
