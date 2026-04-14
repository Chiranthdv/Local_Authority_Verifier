import { useEffect, useState } from "react";
import api from "../lib/api";
import Button from "../components/Button";
import Modal from "../components/Modal";

function AdminDashboard() {
  const [tab, setTab] = useState("pending");
  const [pendingWorkers, setPendingWorkers] = useState([]);
  const [users, setUsers] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [loadingApplication, setLoadingApplication] = useState(false);
  const [loadingApplicationWorkerId, setLoadingApplicationWorkerId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState("");

  const loadDashboardData = async () => {
    try {
      const [adminRes, usersRes] = await Promise.all([
        api.get("/admin/dashboard"),
        api.get("/users")
      ]);
      setPendingWorkers(adminRes.data?.pendingApplications || []);
      setDashboardStats(adminRes.data?.stats || null);
      setUsers(usersRes.data || []);
    } catch (loadError) {
      setPendingWorkers([]);
      setDashboardStats(null);
      setUsers([]);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const openApplication = async (workerId) => {
    setLoadingApplication(true);
    setLoadingApplicationWorkerId(workerId);
    setError("");
    setRejectReason("");
    try {
      const { data } = await api.get(`/workers/applications/${workerId}`);
      setSelectedApplication(data);
    } catch (applicationError) {
      setError("Could not load worker application details.");
      setSelectedApplication(null);
    } finally {
      setLoadingApplication(false);
      setLoadingApplicationWorkerId("");
    }
  };

  const refreshSelectedApplication = async (workerId) => {
    const { data } = await api.get(`/workers/applications/${workerId}`);
    setSelectedApplication(data);
  };

  const handleApproveDocument = async (docId) => {
    if (!selectedApplication) return;
    try {
      await api.patch(`/documents/${docId}/approve`);
      await refreshSelectedApplication(selectedApplication._id);
      await loadDashboardData();
    } catch (actionError) {
      setError(actionError.response?.data?.error || "Could not approve document.");
    }
  };

  const handleRejectDocument = async (docId) => {
    if (!selectedApplication) return;
    try {
      await api.patch(`/documents/${docId}/reject`, { reason: "Please re-upload a clear or valid file." });
      await refreshSelectedApplication(selectedApplication._id);
      await loadDashboardData();
    } catch (actionError) {
      setError(actionError.response?.data?.error || "Could not reject document.");
    }
  };

  const handleApproveWorker = async (workerId) => {
    try {
      await api.put(`/admin/approve/${workerId}`);
      setPendingWorkers((current) => current.filter((worker) => worker._id !== workerId));
      setSelectedApplication(null);
      await loadDashboardData();
    } catch (actionError) {
      setError(
        actionError.response?.data?.message ||
        actionError.response?.data?.error ||
        actionError.message ||
        "Could not approve worker."
      );
    }
  };

  const handleRejectWorker = async (workerId) => {
    if (!rejectReason.trim()) {
      setError("Rejection reason is required.");
      return;
    }
    try {
      await api.patch(`/workers/${workerId}/reject`, { reason: rejectReason.trim() });
      setPendingWorkers((current) => current.filter((worker) => worker._id !== workerId));
      setSelectedApplication(null);
      setRejectReason("");
      await loadDashboardData();
    } catch (actionError) {
      setError(actionError.response?.data?.error || "Could not reject worker.");
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      setUsers((current) => current.filter((user) => user._id !== id));
      setPendingWorkers((current) => current.filter((worker) => worker.workerUserId !== id));
      if (selectedApplication?.userId?._id === id) {
        setSelectedApplication(null);
      }
    } catch (actionError) {
      setError("Could not delete user.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {dashboardStats && (
        <div className="mb-6 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pending Workers</p>
            <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.workerVerification?.pending || 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Approved Workers</p>
            <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.workerVerification?.approved || 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pending Documents</p>
            <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.documents?.pending || 0}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Open Jobs</p>
            <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.jobs?.open || 0}</p>
          </div>
        </div>
      )}

      <div className="mb-6 flex gap-3">
        <Button
          onClick={() => setTab("pending")}
          variant={tab === "pending" ? "primary" : "secondary"}
          size="small"
        >
          Pending Workers
        </Button>
        <Button
          onClick={() => setTab("users")}
          variant={tab === "users" ? "primary" : "secondary"}
          size="small"
        >
          All Users
        </Button>
      </div>

      {error && <p className="mb-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-rose-200">{error}</p>}

      {tab === "pending" && (
        <div className="space-y-4">
          {pendingWorkers.map((worker) => (
            <div key={worker._id} className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">{worker.name || "Worker"}</h2>
                  <p className="mt-1 text-slate-300">{worker.category} | {worker.location}</p>
                  <p className="mt-1 text-slate-400">Age: {worker.age || "NA"} | Experience: {worker.experience || 0} years</p>
                  <p className="mt-2 text-slate-400">{worker.bio || "No bio provided."}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
                  <p>Docs: {worker.documentSummary?.total || 0}</p>
                  <p className="mt-1">Approved: {worker.documentSummary?.approved || 0}</p>
                  <p className="mt-1">Pending: {worker.documentSummary?.pending || 0}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  onClick={() => openApplication(worker._id)}
                  variant="secondary"
                  size="small"
                  disabled={loadingApplication && loadingApplicationWorkerId === worker._id}
                >
                  {loadingApplication && loadingApplicationWorkerId === worker._id ? "Loading..." : "View Application"}
                </Button>
                <Button
                  onClick={() => handleApproveWorker(worker._id)}
                  variant="success"
                  size="small"
                >
                  Approve Worker
                </Button>
              </div>
            </div>
          ))}
          {pendingWorkers.length === 0 && <p className="text-slate-400">No pending workers right now.</p>}
        </div>
      )}

      {tab === "users" && (
        <div className="overflow-hidden rounded-3xl border border-white/10">
          <table className="min-w-full bg-white/5 text-left">
            <thead className="bg-slate-900/80 text-slate-300">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="border-t border-white/10 text-slate-200">
                  <td className="px-4 py-3">{user.name}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3 capitalize">{user.role}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDeleteUser(user._id)} className="rounded-full bg-rose-400 px-3 py-1 text-sm text-slate-950">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={!!selectedApplication}
        onClose={() => setSelectedApplication(null)}
        title="Application Review"
        size="large"
      >
        {selectedApplication && (
          <>
            <div className="mb-4">
              <p className="text-slate-300">{selectedApplication.userId?.name} ({selectedApplication.userId?.email})</p>
              <p className="mt-1 text-slate-400">Role: {selectedApplication.category} | Area: {selectedApplication.location} | Age: {selectedApplication.age || "NA"}</p>
            </div>

            <div className="mb-6 rounded-2xl bg-white/5 p-4 text-slate-300">
              <p className="text-sm text-slate-400">Bio</p>
              <p className="mt-2">{selectedApplication.bio || "No bio provided."}</p>
            </div>

            <div className="mb-6">
              <h4 className="text-lg font-semibold text-white mb-3">Uploaded Documents</h4>
              {selectedApplication.documents?.length === 0 && (
                <p className="text-slate-400">No documents uploaded yet.</p>
              )}
              {selectedApplication.documents?.length > 0 && (
                <div className="space-y-3">
                  {selectedApplication.documents.map((doc) => (
                    <div key={doc._id} className="rounded-2xl bg-white/5 p-4 text-sm text-slate-300">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="capitalize">{doc.documentType.replace("_", " ")}</p>
                          <p className="mt-1">Status: <span className="capitalize">{doc.status}</span></p>
                          {doc.reviewNote && <p className="mt-1 text-rose-300">Note: {doc.reviewNote}</p>}
                        </div>
                        <div className="flex gap-2">
                          {doc.downloadUrl && (
                            <Button
                              as="a"
                              href={doc.downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              variant="secondary"
                              size="small"
                            >
                              View
                            </Button>
                          )}
                          <Button
                            onClick={() => handleApproveDocument(doc._id)}
                            variant="success"
                            size="small"
                          >
                            Approve
                          </Button>
                          <Button
                            onClick={() => handleRejectDocument(doc._id)}
                            variant="danger"
                            size="small"
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 p-4">
              <label className="block text-sm text-slate-300 mb-2">Rejection reason (required to reject worker)</label>
              <textarea
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Enter reason for rejection"
                className="mb-3 min-h-24 w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => handleApproveWorker(selectedApplication._id)}
                  variant="success"
                >
                  Approve Worker
                </Button>
                <Button
                  onClick={() => handleRejectWorker(selectedApplication._id)}
                  variant="danger"
                >
                  Reject Worker
                </Button>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

export default AdminDashboard;

