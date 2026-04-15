import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Button from "../components/Button";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      let data;

      try {
        const response = await api.post("/auth/login", form);
        data = response.data;
      } catch (authError) {
        const authMessage =
          authError.response?.data?.error ||
          authError.response?.data?.message ||
          "";

        // Backend may enforce a dedicated admin login endpoint.
        if (authMessage === "Use /api/admin/login for admin access") {
          const adminResponse = await api.post("/admin/login", form);
          data = adminResponse.data;
        } else {
          throw authError;
        }
      }

      await login(data.token);

      const redirectTarget = location.state?.from;
      if (redirectTarget) {
        navigate(redirectTarget);
      } else if (data.role === "admin") {
        navigate("/admin/dashboard");
      } else if (data.role === "worker" && !data.hasProfile) {
        navigate("/worker/onboarding");
      } else {
        navigate("/");
      }
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Cannot connect to backend server";
      setErrors({
        email: message === "Invalid credentials" || message === "Email and password are required" ? message : "",
        password: message === "Invalid credentials" || message === "Email and password are required" ? message : "",
        form: message !== "Invalid credentials" && message !== "Email and password are required" ? message : ""
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <form onSubmit={handleSubmit} className="w-full rounded-[2rem] border border-white/10 bg-black/40 p-8 shadow-2xl backdrop-blur-xl">
        <h1 className="text-3xl font-semibold text-white">Sign In</h1>
        <p className="mt-2 text-slate-400">Access your hiring dashboard.</p>

        <label className="mt-6 block text-sm text-slate-300">
          Email
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
          />
          {errors.email && <span className="mt-2 block text-rose-300">{errors.email}</span>}
        </label>

        <label className="mt-4 block text-sm text-slate-300">
          Password
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
          />
          {errors.password && <span className="mt-2 block text-rose-300">{errors.password}</span>}
        </label>

        {errors.form && <p className="mt-4 text-sm text-rose-300">{errors.form}</p>}

        <Button
          type="submit"
          disabled={loading}
          loading={loading}
          className="mt-6 w-full"
        >
          {loading ? "Signing in..." : "Sign In"}
        </Button>

        <p className="mt-4 text-sm text-slate-400">
          Need an account? <button type="button" onClick={() => navigate("/register")} className="text-cyan-300">Register</button>
        </p>
      </form>
    </div>
  );
}

export default Login;
