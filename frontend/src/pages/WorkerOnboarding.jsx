import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Button from "../components/Button";

const STEPS = [
  { title: "Basic Info", description: "Tell us about yourself" },
  { title: "Role & Category", description: "Your skills and experience" },
  { title: "Documents", description: "Upload verification documents" },
  { title: "Review", description: "Confirm and submit" }
];

function WorkerOnboarding() {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [profileId, setProfileId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [form, setForm] = useState({
    bio: "",
    skills: "",
    hourlyRate: "",
    age: "",
    experience: "",
    category: "plumber",
    location: "",
    phone: ""
  });
  const [documentFile, setDocumentFile] = useState(null);
  const [documentType, setDocumentType] = useState("id_proof");

  const loadMyDocuments = async () => {
    try {
      const { data } = await api.get("/documents/my");
      setDocuments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load documents:", error);
      setDocuments([]);
    }
  };

  const loadExistingProfile = async () => {
    try {
      const { data } = await api.get("/workers/me/profile");
      setProfileId(data._id);
      setForm({
        bio: data.bio || "",
        skills: Array.isArray(data.skills) ? data.skills.join(", ") : "",
        hourlyRate: data.hourlyRate || "",
        age: data.age || "",
        experience: data.experience || "",
        category: data.category || "plumber",
        location: data.location || "",
        phone: data.phone || ""
      });
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadExistingProfile();
    loadMyDocuments();
  }, []);

  const validateStep = (step) => {
    switch (step) {
      case 0:
        return form.age && form.location && form.phone;
      case 1:
        return form.category && form.experience && form.hourlyRate && form.bio;
      case 2:
        return documents.length > 0;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    } else {
      setMessage("Please fill all required fields.");
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const submitProfile = async () => {
    setLoading(true);
    setMessage("");

    try {
      const payload = {
        ...form,
        skills: form.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
        hourlyRate: Number(form.hourlyRate) || 0,
        age: Number(form.age),
        experience: Number(form.experience)
      };

      if (profileId) {
        await api.patch(`/workers/${profileId}`, payload);
        setMessage("Profile updated successfully!");
      } else {
        const { data } = await api.post("/workers", payload);
        setProfileId(data._id);
        setMessage("Profile created successfully!");
      }
    } catch (error) {
      setMessage(error.response?.data?.error || "Could not save profile.");
    } finally {
      setLoading(false);
    }
  };

  const submitDocument = async () => {
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
      setMessage("Document uploaded!");
    } catch (error) {
      setMessage(error.response?.data?.error || "Could not upload document.");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return <div className="mx-auto min-h-[50vh] max-w-3xl animate-pulse rounded-[2rem] bg-white/5" />;
  }

  const progressWidth = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-white">Worker Verification Profile</h1>
          <p className="mt-2 text-slate-400">
            {user?.name ? `${user.name}, let's get you verified.` : "Let's get you verified."}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            {STEPS.map((step, index) => (
              <span key={index} className={index <= currentStep ? "text-cyan-400" : ""}>
                {step.title}
              </span>
            ))}
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-cyan-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressWidth}%` }}
            ></div>
          </div>
          <p className="mt-2 text-slate-300">{STEPS[currentStep].description}</p>
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {currentStep === 0 && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Basic Information</h2>
              <div className="grid gap-4">
                <input
                  type="number"
                  placeholder="Age (18-80)"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                />
                <input
                  placeholder="Location (e.g., Bangalore)"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                />
                <input
                  placeholder="Phone number"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                />
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Role & Category</h2>
              <div className="grid gap-4">
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                >
                  <option value="plumber">Plumber</option>
                  <option value="electrician">Electrician</option>
                  <option value="carpenter">Carpenter</option>
                  <option value="cleaner">Cleaner</option>
                  <option value="painter">Painter</option>
                  <option value="mechanic">Mechanic</option>
                  <option value="gardener">Gardener</option>
                </select>
                <input
                  type="number"
                  placeholder="Years of experience"
                  value={form.experience}
                  onChange={(e) => setForm({ ...form, experience: e.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                />
                <input
                  type="number"
                  placeholder="Hourly rate (Rs)"
                  value={form.hourlyRate}
                  onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                />
                <input
                  placeholder="Skills (comma separated)"
                  value={form.skills}
                  onChange={(e) => setForm({ ...form, skills: e.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                />
                <textarea
                  placeholder="Bio"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  className="min-h-28 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Upload Documents</h2>
              <p className="text-slate-400 mb-4">Upload ID proof and certificates for verification.</p>
              <div className="grid gap-4">
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                >
                  <option value="id_proof">ID Proof</option>
                  <option value="certificate">Certificate</option>
                </select>
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                  className="rounded-2xl border border-dashed border-white/20 p-4 bg-slate-900"
                />
                <Button
                  onClick={submitDocument}
                  disabled={!documentFile || loading}
                  variant="warning"
                  size="small"
                  loading={loading}
                >
                  {loading ? "Uploading..." : "Upload Document"}
                </Button>
              </div>
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white">Uploaded Documents</h3>
                {documents.length === 0 && <p className="mt-3 text-slate-400">No documents uploaded yet.</p>}
                {documents.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {documents.map((doc) => (
                      <div key={doc._id} className="rounded-xl bg-white/5 p-3 text-sm text-slate-300">
                        <p className="capitalize">{doc.documentType.replace("_", " ")}</p>
                        <p className="mt-1">Status: <span className="capitalize">{doc.status}</span></p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Review Your Profile</h2>
              <div className="space-y-4 text-slate-300">
                <p><strong>Age:</strong> {form.age}</p>
                <p><strong>Location:</strong> {form.location}</p>
                <p><strong>Phone:</strong> {form.phone}</p>
                <p><strong>Category:</strong> {form.category}</p>
                <p><strong>Experience:</strong> {form.experience} years</p>
                <p><strong>Hourly Rate:</strong> Rs {form.hourlyRate}</p>
                <p><strong>Skills:</strong> {form.skills}</p>
                <p><strong>Bio:</strong> {form.bio}</p>
                <p><strong>Documents:</strong> {documents.length} uploaded</p>
              </div>
              <Button
                onClick={submitProfile}
                disabled={loading}
                variant="success"
                loading={loading}
                className="mt-6"
              >
                {loading ? "Submitting..." : "Submit Profile"}
              </Button>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="mt-8 flex justify-between">
          <Button
            onClick={handleBack}
            disabled={currentStep === 0}
            variant="secondary"
            size="small"
          >
            Back
          </Button>
          {currentStep < STEPS.length - 1 ? (
            <Button
              onClick={handleNext}
              variant="primary"
              size="small"
            >
              Next
            </Button>
          ) : null}
        </div>

        {message && <p className="mt-6 text-slate-200">{message}</p>}
      </div>
    </div>
  );
}

export default WorkerOnboarding;
