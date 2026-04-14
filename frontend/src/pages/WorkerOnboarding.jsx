import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

function WorkerOnboarding() {
  const { user } = useAuth();
  const [profileId, setProfileId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [existingProfile, setExistingProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [form, setForm] = useState({
    bio: "",
    skills: "",
    hourlyRate: "",
    age: "",
    category: "plumber",
    location: "",
    phone: ""
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [documentFile, setDocumentFile] = useState(null);
  const [documentType, setDocumentType] = useState("id_proof");

  const loadMyDocuments = async () => {
    try {
      const { data } = await api.get("/documents/my");
      setDocuments(Array.isArray(data) ? data : []);
    } catch (error) {
      setDocuments([]);
    }
  };

  const loadExistingProfile = async () => {
    try {
      const { data } = await api.get("/workers/me/profile");
      setExistingProfile(data);
      setProfileId(data._id);
      setForm({
        bio: data.bio || "",
        skills: Array.isArray(data.skills) ? data.skills.join(", ") : "",
        hourlyRate: data.hourlyRate || "",
        age: data.age || "",
        category: data.category || "plumber",
        location: data.location || "",
        phone: data.phone || ""
      });
    } catch (error) {
      setExistingProfile(null);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadExistingProfile();
    loadMyDocuments();
  }, []);

  const submitProfile = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const payload = {
        ...form,
        skills: form.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
        hourlyRate: Number(form.hourlyRate) || 0,
        age: Number(form.age)
      };

      if (profileId) {
        const { data } = await api.patch(`/workers/${profileId}`, payload);
        setExistingProfile((current) => ({ ...current, ...data }));
        setMessage("Profile details updated and submitted for verification.");
      } else {
        const { data } = await api.post("/workers", payload);
        setProfileId(data._id);
        setExistingProfile(data);
        setMessage("Profile details saved. Upload documents for verification.");
      }
    } catch (error) {
      setMessage(error.response?.data?.error || "Could not save profile.");
    } finally {
      setLoading(false);
    }
  };

  const submitPhoto = async (event) => {
    event.preventDefault();
    if (!photoFile || !profileId) return;

    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", photoFile);
      const { data } = await api.post(`/workers/${profileId}/photo`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setExistingProfile((current) => ({ ...current, photoUrl: data.photoUrl }));
      setMessage("Profile photo uploaded.");
    } catch (error) {
      setMessage(error.response?.data?.error || "Could not upload photo.");
    } finally {
      setLoading(false);
    }
  };

  const submitDocument = async (event) => {
    event.preventDefault();
    if (!documentFile) return;

    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", documentFile);
      formData.append("documentType", documentType);
      await api.post("/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      setDocumentFile(null);
      await loadMyDocuments();
      await loadExistingProfile();
      setMessage("Document uploaded for admin verification.");
    } catch (error) {
      setMessage(error.response?.data?.error || "Could not upload document.");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return <div className="mx-auto min-h-[50vh] max-w-3xl animate-pulse rounded-[2rem] bg-white/5" />;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-white">Worker Verification Profile</h1>
            <p className="mt-2 text-slate-400">
              {user?.name ? `${user.name}, submit your details and documents for admin approval.` : "Submit your details and documents for admin approval."}
            </p>
          </div>

          {existingProfile && (
            <div className="rounded-2xl bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
              <p>Status: <span className="capitalize text-cyan-300">{existingProfile.verificationStatus}</span></p>
              {existingProfile.rejectionReason && (
                <p className="mt-1 text-rose-300">Reason: {existingProfile.rejectionReason}</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold text-white">Step 1: Worker Details</h2>
            <form onSubmit={submitProfile} className="mt-4 grid gap-4">
              <input type="number" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} placeholder="Age (18-80)" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" />
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3">
                <option value="plumber">Plumber</option>
                <option value="electrician">Electrician</option>
                <option value="carpenter">Carpenter</option>
                <option value="cleaner">Cleaner</option>
                <option value="painter">Painter</option>
                <option value="mechanic">Mechanic</option>
                <option value="gardener">Gardener</option>
              </select>
              <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Area / Location" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" />
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone number" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" />
              <input type="number" value={form.hourlyRate} onChange={(event) => setForm({ ...form, hourlyRate: event.target.value })} placeholder="Hourly rate (Rs)" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" />
              <input value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} placeholder="Skills (comma separated)" className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" />
              <textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="Bio" className="min-h-28 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" />
              <button disabled={loading} className="rounded-2xl bg-cyan-400 px-5 py-3 font-medium text-slate-950 disabled:opacity-60">
                {loading ? "Saving..." : profileId ? "Update Details" : "Save Details"}
              </button>
            </form>

            {profileId && (
              <form onSubmit={submitPhoto} className="mt-6">
                <h3 className="text-lg font-semibold text-white">Step 2: Profile Photo</h3>
                <input type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} className="mt-3 block w-full rounded-2xl border border-dashed border-white/20 p-4" />
                <button disabled={loading || !photoFile} className="mt-3 rounded-2xl bg-emerald-400 px-5 py-2 font-medium text-slate-950 disabled:opacity-60">
                  {loading ? "Uploading..." : existingProfile?.photoUrl ? "Replace Photo" : "Upload Photo"}
                </button>
              </form>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white">Step 3: Verification Documents</h2>
            <form onSubmit={submitDocument} className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <label className="text-sm text-slate-300">Document Type</label>
              <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3">
                <option value="id_proof">ID Proof</option>
                <option value="certificate">Certificate</option>
              </select>
              <input type="file" accept=".pdf,image/png,image/jpeg" onChange={(event) => setDocumentFile(event.target.files?.[0] || null)} className="mt-4 block w-full rounded-2xl border border-dashed border-white/20 p-4" />
              <button disabled={loading || !documentFile} className="mt-4 rounded-2xl bg-amber-300 px-5 py-2 font-medium text-slate-950 disabled:opacity-60">
                {loading ? "Uploading..." : "Upload Document"}
              </button>
            </form>

            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <h3 className="text-lg font-semibold text-white">Uploaded Documents</h3>
              {documents.length === 0 && <p className="mt-3 text-slate-400">No documents uploaded yet.</p>}
              {documents.length > 0 && (
                <div className="mt-3 space-y-3">
                  {documents.map((doc) => (
                    <div key={doc._id} className="rounded-xl bg-white/5 p-3 text-sm text-slate-300">
                      <p className="capitalize">{doc.documentType.replace("_", " ")}</p>
                      <p className="mt-1">Status: <span className="capitalize">{doc.status}</span></p>
                      {doc.reviewNote && <p className="mt-1 text-rose-300">Admin note: {doc.reviewNote}</p>}
                      {doc.downloadUrl && (
                        <a href={doc.downloadUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-cyan-300">
                          View file
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="mt-5 text-sm text-slate-400">
              Worker profile becomes public only after admin approves your documents and application.
            </p>
          </div>
        </div>

        {message && <p className="mt-6 text-slate-200">{message}</p>}
      </div>
    </div>
  );
}

export default WorkerOnboarding;
