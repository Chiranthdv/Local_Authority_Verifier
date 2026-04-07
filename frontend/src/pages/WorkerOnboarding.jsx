import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

function WorkerOnboarding() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [profileId, setProfileId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [existingProfile, setExistingProfile] = useState(null);
  const [form, setForm] = useState({
    bio: "",
    skills: "",
    hourlyRate: "",
    category: "plumber",
    location: "",
    phone: ""
  });
  const [file, setFile] = useState(null);

  const loadExistingProfile = async () => {
    try {
      const { data } = await api.get("/workers/me/profile");
      setExistingProfile(data);
      setProfileId(data._id);
      setForm({
        bio: data.bio || "",
        skills: Array.isArray(data.skills) ? data.skills.join(", ") : "",
        hourlyRate: data.hourlyRate || "",
        category: data.category || "plumber",
        location: data.location || "",
        phone: data.phone || ""
      });
      setStep(data.photoUrl ? 3 : 2);
    } catch (error) {
      setExistingProfile(null);
      setStep(1);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadExistingProfile();
  }, []);

  const submitProfile = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const payload = {
        ...form,
        skills: form.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
        hourlyRate: Number(form.hourlyRate)
      };

      if (profileId) {
        const { data } = await api.patch(`/workers/${profileId}`, payload);
        setExistingProfile((current) => ({ ...current, ...data }));
        setMessage("Profile details updated.");
      } else {
        const { data } = await api.post("/workers", payload);
        setProfileId(data._id);
        setExistingProfile(data);
        setMessage("Profile details saved.");
      }

      setStep(2);
    } catch (error) {
      const message = error.response?.data?.error || "Could not save profile.";

      if (message === "Worker profile already exists") {
        try {
          const { data } = await api.get("/workers/me/profile");
          setExistingProfile(data);
          setProfileId(data._id);

          const updated = await api.patch(`/workers/${data._id}`, payload);
          setExistingProfile((current) => ({ ...current, ...updated.data }));
          setStep(2);
          setMessage("Existing profile loaded and updated.");
          return;
        } catch (retryError) {
          setMessage("Your profile already exists. Please refresh once and try again.");
          return;
        }
      }

      setMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const submitPhoto = async (event) => {
    event.preventDefault();
    if (!file || !profileId) return;

    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post(`/workers/${profileId}/photo`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setExistingProfile((current) => ({ ...current, photoUrl: data.photoUrl }));
      setStep(3);
      setMessage("Profile photo uploaded. Your worker details are now visible to customers.");
    } catch (error) {
      setMessage(error.response?.data?.error || "Could not upload photo.");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return <div className="mx-auto min-h-[50vh] max-w-3xl animate-pulse rounded-[2rem] bg-white/5" />;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-white">Worker Profile</h1>
            <p className="mt-2 text-slate-400">
              {user?.name ? `${user.name}, manage your worker details here.` : "Manage your worker details here."}
            </p>
          </div>

          {existingProfile && (
            <div className="rounded-2xl bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
              <p>Status: <span className="capitalize text-cyan-300">{existingProfile.verificationStatus}</span></p>
              <p className="mt-1">Badge: {existingProfile.badgeLevel || "Rising"}</p>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm text-slate-400">Step {step === 3 ? 2 : step} of 2</p>

            <form onSubmit={submitProfile} className="mt-6 grid gap-4">
              <textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="Bio" className="min-h-32 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" />
              <input value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} placeholder="Skills (comma separated)" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" />
              <input type="number" value={form.hourlyRate} onChange={(event) => setForm({ ...form, hourlyRate: event.target.value })} placeholder="Hourly rate" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" />
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3">
                <option value="plumber">Plumber</option>
                <option value="electrician">Electrician</option>
                <option value="carpenter">Carpenter</option>
                <option value="cleaner">Cleaner</option>
                <option value="painter">Painter</option>
              </select>
              <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Location" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" />
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone number" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" />
              <button disabled={loading} className="rounded-2xl bg-cyan-400 px-5 py-3 font-medium text-slate-950 disabled:opacity-60">{loading ? "Saving..." : profileId ? "Update Details" : "Save Details"}</button>
            </form>

            {profileId && (
              <form onSubmit={submitPhoto} className="mt-6">
                <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} className="block w-full rounded-2xl border border-dashed border-white/20 p-6" />
                <button disabled={loading || !file} className="mt-4 rounded-2xl bg-emerald-400 px-5 py-3 font-medium text-slate-950 disabled:opacity-60">
                  {loading ? "Uploading..." : existingProfile?.photoUrl ? "Replace Photo" : "Upload Photo"}
                </button>
              </form>
            )}

            {message && <p className="mt-4 text-slate-300">{message}</p>}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-950/40 p-6">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Live Preview</p>
            <h2 className="mt-4 text-2xl font-semibold text-white">{user?.name || "Worker Name"}</h2>
            <p className="mt-2 text-slate-400">{form.category || "Category"} • {form.location || "Location"}</p>
            <p className="mt-4 text-slate-300">{form.bio || "Your bio will appear here for customers."}</p>
            <div className="mt-5 rounded-2xl bg-white/5 p-4 text-sm text-slate-300">
              <p>Skills: {form.skills || "No skills added yet"}</p>
              <p className="mt-2">Rate: {form.hourlyRate ? `₹${form.hourlyRate}/hr` : "Not added yet"}</p>
              <p className="mt-2">Phone: {form.phone || "Not added yet"}</p>
            </div>
            <p className="mt-5 text-sm text-slate-400">
              Customer pages auto-refresh, so saved worker details will appear there without a manual code change.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkerOnboarding;
