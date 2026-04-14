import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

function getInitials(name) {
  if (!name) return "TL";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getVerificationBadge(verificationStatus) {
  if (!verificationStatus) return null;

  switch (verificationStatus) {
    case "approved":
      return (
        <span
          className="rounded-full bg-green-500/15 px-3 py-1 text-green-300"
          title="This worker has been verified by admin"
        >
          ✅ Verified
        </span>
      );
    case "pending":
      return (
        <span className="rounded-full bg-yellow-500/15 px-3 py-1 text-yellow-300">
          ⏳ Pending Verification
        </span>
      );
    case "rejected":
      return (
        <span className="rounded-full bg-red-500/15 px-3 py-1 text-red-300">
          ❌ Not Verified
        </span>
      );
    default:
      return null;
  }
}

function WorkerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [publicWorker, setPublicWorker] = useState(null);
  const [privateWorker, setPrivateWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [timeSlots, setTimeSlots] = useState([]);
  const [requestForm, setRequestForm] = useState({
    serviceDate: "",
    timeSlotCode: "",
    address: "",
    description: ""
  });

  const worker = privateWorker || publicWorker;

  const loadWorker = async () => {
    try {
      setLoading(true);
      setPrivateWorker(null);

      const publicRes = await api.get(`/workers/public/${id}`);
      setPublicWorker(publicRes.data);

      if (user?.role === "customer" || user?.role === "admin" || user?.role === "worker") {
        try {
          const privateRes = await api.get(`/workers/private/${id}`);
          setPrivateWorker(privateRes.data);
        } catch (error) {
          setPrivateWorker(null);
        }
      }
    } catch (error) {
      setPublicWorker(null);
      setPrivateWorker(null);
    } finally {
      setLoading(false);
    }
  };

  const loadTimeSlots = async () => {
    try {
      const { data } = await api.get("/jobs/time-slots");
      const slots = Array.isArray(data) ? data : [];
      setTimeSlots(slots);
      if (slots.length && !requestForm.timeSlotCode) {
        setRequestForm((current) => ({ ...current, timeSlotCode: slots[0].code }));
      }
    } catch (error) {
      setTimeSlots([]);
    }
  };

  useEffect(() => {
    loadWorker();
    loadTimeSlots();
  }, [id, user?.role]);

  if (loading) {
    return <div className="mx-auto min-h-[50vh] max-w-6xl animate-pulse rounded-3xl bg-slate-800/60" />;
  }

  if (!worker) {
    return <div className="text-center text-slate-300">Worker not found.</div>;
  }

  const certificates = Array.isArray(privateWorker?.certificates) ? privateWorker.certificates : [];
  const reviews = Array.isArray(privateWorker?.reviews) ? privateWorker.reviews : [];

  const submitRequest = async (event) => {
    event.preventDefault();
    setSubmittingRequest(true);
    setRequestError("");
    setRequestMessage("");

    try {
      if (!privateWorker?.workerUserId) {
        setRequestError("Login as customer to send booking requests.");
        return;
      }

      await api.post("/jobs", {
        workerId: privateWorker.workerUserId,
        serviceDate: requestForm.serviceDate,
        timeSlotCode: requestForm.timeSlotCode,
        address: requestForm.address,
        description: requestForm.description
      });
      setRequestMessage("Service request sent to worker.");
      setRequestForm((current) => ({ ...current, address: "", description: "" }));
      setShowRequestModal(false);
    } catch (error) {
      setRequestError(error.response?.data?.error || "Could not send request");
    } finally {
      setSubmittingRequest(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <section className="grid gap-8 rounded-[2rem] border border-white/10 bg-white/5 p-8 lg:grid-cols-[280px_1fr]">
        <div className="flex h-72 w-full items-center justify-center rounded-[2rem] bg-gradient-to-br from-cyan-500/20 to-sky-500/5 text-6xl font-semibold text-cyan-200">
          {getInitials(worker.name)}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-semibold text-white">{worker.name}</h1>
            {privateWorker && getVerificationBadge(privateWorker.verificationStatus)}
          </div>
          <p className="mt-3 text-slate-300">{worker.category} | {worker.area} | Rs {worker.hourlyRate || 0}/hr</p>
          <p className="mt-2 text-slate-300">Experience: {worker.experience || 0} years</p>
          {user?.role === "customer" && privateWorker?.phone && <p className="mt-3 text-cyan-300">Phone: {privateWorker.phone}</p>}
          {user?.role === "customer" && privateWorker?.phone && <p className="mt-1 text-xs text-slate-400">Call manually using this phone number.</p>}
          <p className="mt-6 max-w-3xl leading-7 text-slate-300">{worker.bio || "This worker has not added a bio yet."}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-900/70 p-4">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Rating</p>
              <p className="mt-2 text-2xl text-white">{worker.rating ? `★ ${worker.rating}` : "No reviews yet"}</p>
              <p className="mt-2 text-slate-400">{worker.reviewCount || 0} total reviews</p>
            </div>
          </div>

          {user?.role === "customer" && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button onClick={() => setShowRequestModal(true)} className="rounded-full bg-cyan-400 px-4 py-2 font-medium text-slate-950">
                Request Service
              </button>
              <button
                onClick={() => {
                  if (!privateWorker?.workerUserId) {
                    setRequestError("Login as customer to start chat.");
                    return;
                  }
                  navigate(`/chats?workerId=${privateWorker.workerUserId}`);
                }}
                className="rounded-full border border-cyan-300/40 px-4 py-2 text-cyan-200"
              >
                Chat with Worker
              </button>
              <span className="text-sm text-slate-400">
                Rate this worker after job completion from{" "}
                <Link to="/requests/my" className="text-cyan-300">My Requests</Link>.
              </span>
            </div>
          )}
          {requestMessage && <p className="mt-3 text-emerald-300">{requestMessage}</p>}
          {requestError && <p className="mt-3 text-rose-300">{requestError}</p>}
        </div>
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-semibold text-white">Certificates</h2>
          <div className="mt-4 space-y-3">
            {certificates.length === 0 && <p className="text-slate-400">Certificates are visible after secure private access.</p>}
            {certificates.map((certificate) => (
              <article key={certificate._id} className="rounded-2xl bg-slate-900/70 p-4">
                <p className="font-medium text-white">{certificate.originalName || "Worker Certificate"}</p>
                <p className="mt-2 text-sm text-slate-400">
                  Verified on {new Date(certificate.reviewedAt || certificate.createdAt).toLocaleDateString()}
                </p>
                {certificate.downloadUrl && (
                  <a
                    href={certificate.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-cyan-300"
                  >
                    View Certificate
                  </a>
                )}
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-semibold text-white">Reviews</h2>
          <div className="mt-4 space-y-4">
            {reviews.length === 0 && <p className="text-slate-400">No reviews yet or login required for detailed review list.</p>}
            {reviews.map((review) => (
              <article key={review._id} className="rounded-2xl bg-slate-900/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-white">{review.customerId?.name || "Anonymous"}</p>
                  <p className="text-amber-300">{`★`.repeat(review.rating)}{`☆`.repeat(5 - review.rating)}</p>
                </div>
                <p className="mt-2 text-slate-300">{review.comment || "No written feedback."}</p>
                <p className="mt-3 text-sm text-slate-500">{new Date(review.createdAt).toLocaleDateString()}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <form onSubmit={submitRequest} className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-900 p-6">
            <h3 className="text-2xl font-semibold text-white">Send Service Request</h3>
            <label className="mt-4 block text-sm text-slate-300">
              Service Date
              <input
                type="date"
                value={requestForm.serviceDate}
                onChange={(event) => setRequestForm((current) => ({ ...current, serviceDate: event.target.value }))}
                required
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
              />
            </label>
            <label className="mt-4 block text-sm text-slate-300">
              Time Slot
              <select
                value={requestForm.timeSlotCode}
                onChange={(event) => setRequestForm((current) => ({ ...current, timeSlotCode: event.target.value }))}
                required
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
              >
                {timeSlots.map((slot) => (
                  <option key={slot.code} value={slot.code}>{slot.label}</option>
                ))}
              </select>
            </label>
            <label className="mt-4 block text-sm text-slate-300">
              Address
              <textarea
                value={requestForm.address}
                onChange={(event) => setRequestForm((current) => ({ ...current, address: event.target.value }))}
                required
                className="mt-2 min-h-20 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
              />
            </label>
            <label className="mt-4 block text-sm text-slate-300">
              Description
              <textarea
                value={requestForm.description}
                onChange={(event) => setRequestForm((current) => ({ ...current, description: event.target.value }))}
                className="mt-2 min-h-20 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
              />
            </label>
            <div className="mt-5 flex gap-3">
              <button disabled={submittingRequest} className="rounded-full bg-cyan-400 px-5 py-2 font-medium text-slate-950 disabled:opacity-60">
                {submittingRequest ? "Sending..." : "Send Request"}
              </button>
              <button type="button" onClick={() => setShowRequestModal(false)} className="rounded-full border border-white/10 px-5 py-2 text-slate-300">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default WorkerProfile;
