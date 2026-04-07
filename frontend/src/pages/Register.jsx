import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

function Register() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "customer" });
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
      await api.post("/auth/register", form);
      const { data } = await api.post("/auth/login", { email: form.email, password: form.password });
      await login(data.token);

      if (form.role === "worker") {
        navigate("/worker/onboarding");
      } else {
        navigate("/");
      }
    } catch (error) {
      const message = error.response?.data?.error || "Cannot connect to backend server";
      setErrors({
        name: message === "All fields are required" ? "Please fill all fields" : "",
        email: message === "Email already registered" ? "This email is already registered" : "",
        password: message === "All fields are required" ? "Please fill all fields" : "",
        form: message !== "Email already registered" ? message : ""
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <form onSubmit={handleSubmit} className="w-full rounded-[2rem] border border-white/10 bg-black/40 p-8 shadow-2xl backdrop-blur-xl">
        <h1 className="text-3xl font-semibold text-white">Create Account</h1>
        <p className="mt-2 text-slate-400">Join as a customer or worker.</p>

        <label className="mt-6 block text-sm text-slate-300">
          Name
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" />
          {errors.name && <span className="mt-2 block text-rose-300">{errors.name}</span>}
        </label>

        <label className="mt-4 block text-sm text-slate-300">
          Email
          <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" />
          {errors.email && <span className="mt-2 block text-rose-300">{errors.email}</span>}
        </label>

        <label className="mt-4 block text-sm text-slate-300">
          Password
          <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" />
          {errors.password && <span className="mt-2 block text-rose-300">{errors.password}</span>}
        </label>

        <label className="mt-4 block text-sm text-slate-300">
          Role
          <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3">
            <option value="customer">Customer</option>
            <option value="worker">Worker</option>
          </select>
        </label>

        {errors.form && <p className="mt-4 text-sm text-rose-300">{errors.form}</p>}

        <button disabled={loading} className="mt-6 w-full rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60">
          {loading ? "Creating account..." : "Register"}
        </button>
      </form>
    </div>
  );
}

export default Register;
