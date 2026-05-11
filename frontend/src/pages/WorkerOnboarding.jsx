import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Button from "../components/Button";

const REQUEST_TIMEOUT_MS = 20000;

const STEPS = [
  { title: "Basic Info", description: "Tell us about yourself" },
  { title: "Role & Category", description: "Your skills and experience" },
  { title: "Certificates", description: "Upload verification certificates (required)" },
  { title: "Review", description: "Confirm and submit" }
];

function WorkerOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [profileId, setProfileId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [certificates, setCertificates] = useState([]);
  const [certificateFiles, setCertificateFiles] = useState([]);

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

  const getErrorMessage = (error, fallbackMessage) => {
    if (error?.code === "ECONNABORTED") {
      return "Request timed out. Please check server status and try again.";
    }
    if (error?.response?.data?.message) {
      return error.response.data.message;
    }
    if (error?.response?.data?.error) {
      return error.response.data.error;
    }
    if (error?.message) {
      return error.message;
    }
    return fallbackMessage;
  };

  const syncDocumentState = useCallback((items) => {
    const list = Array.isArray(items) ? items : [];
    const certificateDocuments = list.filter((doc) => doc.documentType === "certificate");
    setCertificates(certificateDocuments);
  }, []);


  const loadWorkerDocuments = useCallback(async () => {
    try {
      const workerUserId = user?._id;
      const response = workerUserId
        ? await api.get(`/documents/${workerUserId}`)
        : await api.get("/documents/my");
      syncDocumentState(response.data);
    } catch (error) {
      syncDocumentState([]);
    }
  }, [user?._id, syncDocumentState]);


  const loadExistingProfile = useCallback(async () => {
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
    } catch {
      // Worker may not have a profile yet.
    } finally {
      setInitialLoading(false);
      // If profile already exists and is fully filled (has bio), redirect to dashboard
      if (profileId || form.bio) {
        navigate("/requests/inbox");
      }
    }
  }, []);


  useEffect(() => {
    loadExistingProfile();
  }, [loadExistingProfile]);


  useEffect(() => {
    loadWorkerDocuments();
  }, [loadWorkerDocuments]);


  const buildWorkerPayload = () => ({
    ...form,
    skills: form.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
    hourlyRate: Number(form.hourlyRate) || 0,
    age: Number(form.age),
    experience: Number(form.experience)
  });

  const ensureProfileExists = async () => {
    if (profileId) {
      return profileId;
    }

    const payload = buildWorkerPayload();
    const { data } = await api.post("/workers/profile", payload, { timeout: REQUEST_TIMEOUT_MS });
    setProfileId(data?._id || "");
    return data?._id || "";
  };

  const validateStep = (step) => {
    switch (step) {
      case 0:
        if (!form.age || !form.location || !form.phone) {
          setMessage("Please fill in Age, Location, and Phone number.");
          return false;
        }
        setMessage("");
        return true;
      case 1:
        if (!form.category || !form.experience || !form.hourlyRate || !form.bio) {
          setMessage("Please fill in Category, Experience, Hourly Rate, and Bio.");
          return false;
        }
        setMessage("");
        return true;
      case 2:
        if (certificates.length < 1) {
          setMessage("Please upload at least one certificate before proceeding.");
          return false;
        }
        setMessage("");
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const submitProfile = async () => {
    setLoading(true);
    setMessage("");

    try {
      const profileData = buildWorkerPayload();
      const { data } = await api.post("/workers/profile", profileData, { timeout: REQUEST_TIMEOUT_MS });

      if (data?._id) {
        setProfileId(data._id);
      }
      setMessage("Profile submitted successfully.");
    } catch (error) {
      setMessage(getErrorMessage(error, "Could not save profile."));
    } finally {
      setLoading(false);
      // Redirect to inbox after successful submission
      setTimeout(() => {
        navigate("/requests/inbox");
      }, 1500);
    }
  };

  const uploadCertificate = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", "certificate");
    formData.append("type", "certificate");

    const response = await api.post("/documents/upload", formData, { timeout: REQUEST_TIMEOUT_MS });
    return response.data;
  };

  const submitCertificates = async () => {
    if (certificateFiles.length === 0) return;

    setLoading(true);
    setMessage("");

    try {
      await ensureProfileExists();
      for (const file of certificateFiles) {
        await uploadCertificate(file);
      }
      await loadWorkerDocuments();
      setCertificateFiles([]);
      setMessage("Certificates uploaded successfully.");
    } catch (error) {
      setMessage(getErrorMessage(error, "Could not upload certificates."));
    } finally {
      setLoading(false);
    }
  };

  const removeDocument = async (documentId) => {
    try {
      await api.delete(`/documents/${documentId}`);
      await loadWorkerDocuments();
      setMessage("Certificate removed successfully.");
    } catch (error) {
      setMessage(error.response?.data?.error || "Could not remove certificate.");
    }
  };

  const removeCertificateFile = (index) => {
    setCertificateFiles((prev) => prev.filter((_, i) => i !== index));
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

        <div className="mb-8">
          <div className="mb-2 flex justify-between text-sm text-slate-400">
            {STEPS.map((step, index) => (
              <span key={index} className={index <= currentStep ? "text-cyan-400" : ""}>
                {step.title}
              </span>
            ))}
          </div>
          <div className="h-2 w-full rounded-full bg-slate-700">
            <div
              className="h-2 rounded-full bg-cyan-400 transition-all duration-300"
              style={{ width: `${progressWidth}%` }}
            />
          </div>
          <p className="mt-2 text-slate-300">{STEPS[currentStep].description}</p>
        </div>

        <div className="min-h-[400px]">
          {currentStep === 0 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-white">Basic Information</h2>
              <div className="grid gap-4">
                <input
                  type="number"
                  placeholder="Age (18-80)"
                  value={form.age}
                  onChange={(event) => setForm({ ...form, age: event.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                />
                <input
                  placeholder="Location (e.g., Bangalore)"
                  value={form.location}
                  onChange={(event) => setForm({ ...form, location: event.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                />
                <input
                  placeholder="Phone number"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                />
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-white">Role & Category</h2>
              <div className="grid gap-4">
                <select
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
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
                  onChange={(event) => setForm({ ...form, experience: event.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                />
                <input
                  type="number"
                  placeholder="Hourly rate (Rs)"
                  value={form.hourlyRate}
                  onChange={(event) => setForm({ ...form, hourlyRate: event.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                />
                <input
                  placeholder="Skills (comma separated)"
                  value={form.skills}
                  onChange={(event) => setForm({ ...form, skills: event.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                />
                <textarea
                  placeholder="Bio"
                  value={form.bio}
                  onChange={(event) => setForm({ ...form, bio: event.target.value })}
                  className="min-h-28 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-white">Upload Certificates</h2>
              <p className="mb-6 text-slate-400">Upload at least one certificate for verification.</p>

              <div>
                <h3 className="mb-3 flex items-center text-lg font-semibold text-white">
                  <span className="mr-3 h-2 w-2 rounded-full bg-red-500"></span>
                  Certificates (Required)
                </h3>
                <p className="mb-4 text-sm text-slate-400">Upload certificates, licenses, or qualifications.</p>

                <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg"
                    multiple
                    onChange={(event) => setCertificateFiles(Array.from(event.target.files || []))}
                    className="mb-4 w-full rounded-xl border border-dashed border-white/20 bg-slate-800 p-4 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-600 file:px-4 file:py-2 file:text-white hover:file:bg-cyan-500"
                  />

                  {certificateFiles.length > 0 && (
                    <div className="mb-4 space-y-2">
                      <p className="text-sm font-medium text-cyan-300">Selected Files:</p>
                      {certificateFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded border border-cyan-500/20 bg-cyan-900/20 p-2">
                          <span className="text-sm text-cyan-300">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeCertificateFile(index)}
                            className="text-sm text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    onClick={submitCertificates}
                    disabled={certificateFiles.length === 0 || loading}
                    variant="secondary"
                    size="small"
                    className="w-full"
                  >
                    {loading ? "Uploading..." : `Upload ${certificateFiles.length} Certificate${certificateFiles.length !== 1 ? "s" : ""}`}
                  </Button>
                </div>

                {certificates.length > 0 && (
                  <div className="mt-4">
                    <h4 className="mb-2 text-sm font-semibold text-white">Uploaded Certificates</h4>
                    <div className="space-y-2">
                      {certificates.map((doc) => (
                        <div key={doc._id} className="rounded-lg border border-cyan-500/20 bg-cyan-900/20 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-cyan-300">{doc.originalName}</p>
                              <p className="text-xs capitalize text-cyan-400">Status: {doc.status}</p>
                              {(doc.rejectionReason || doc.reviewNote) && (
                                <p className="mt-1 text-xs text-rose-300">
                                  Reason: {doc.rejectionReason || doc.reviewNote}
                                </p>
                              )}
                            </div>
                            <Button
                              onClick={() => removeDocument(doc._id)}
                              variant="danger"
                              size="small"
                              className="text-xs"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-white">Review Your Profile</h2>
              <div className="space-y-4 text-slate-300">
                <div>
                  <p><strong>Age:</strong> {form.age}</p>
                  <p><strong>Location:</strong> {form.location}</p>
                  <p><strong>Phone:</strong> {form.phone}</p>
                </div>

                <div>
                  <p><strong>Category:</strong> {form.category}</p>
                  <p><strong>Experience:</strong> {form.experience} years</p>
                  <p><strong>Hourly Rate:</strong> Rs {form.hourlyRate}</p>
                </div>

                <div>
                  <p><strong>Skills:</strong> {form.skills}</p>
                  <p><strong>Bio:</strong> {form.bio}</p>
                </div>

                <div>
                  <p className="mb-2"><strong>Documents:</strong></p>
                  <div className="ml-4 space-y-2">
                    <div className="flex items-center">
                      <span className={`mr-2 h-2 w-2 rounded-full ${certificates.length > 0 ? "bg-blue-500" : "bg-red-500"}`}></span>
                      <span>Certificates: {certificates.length} uploaded</span>
                    </div>
                  </div>
                </div>
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

        {message && (
          <p className={`mt-6 rounded-2xl border px-4 py-3 ${message.includes("Please") ? "border-rose-300/30 bg-rose-500/10 text-rose-300" : "border-emerald-300/30 bg-emerald-500/10 text-emerald-300"}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default WorkerOnboarding;
