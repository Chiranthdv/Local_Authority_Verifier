import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import Button from "../components/Button";
import Modal from "../components/Modal";
import AdminRestoreUserModal from "../components/AdminRestoreUserModal";

function StatsSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {["stat-1", "stat-2", "stat-3", "stat-4"].map((id) => (
        <div
          key={`stats-skeleton-${id}`}
          className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/5"
        />
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 5 }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10">
      <div className="space-y-3 bg-white/5 p-4">
        {["r1", "r2", "r3", "r4", "r5", "r6"].slice(0, rows).map((rowId) => (
          <div
            key={`table-skeleton-${rowId}`}
            className="h-14 animate-pulse rounded-2xl border border-white/10 bg-white/5"
          />
        ))}
      </div>
    </div>
  );
}

function ErrorBanner({ message, onRetry, retrying }) {
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-rose-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry ? (
          <Button onClick={onRetry} variant="secondary" size="small" disabled={retrying}>
            {retrying ? "Retrying..." : "Retry"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.03] px-6 py-10 text-center">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  );
}

function UserStatusPill({ isDeleted }) {
  if (isDeleted) {
    return (
      <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs text-rose-200">
        Deleted
      </span>
    );
  }

  return (
    <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-200">
      Active
    </span>
  );
}

function AdminDashboard() {
  const [tab, setTab] = useState("pending");
  const [pendingWorkers, setPendingWorkers] = useState([]);
  const [users, setUsers] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [loadingApplication, setLoadingApplication] = useState(false);
  const [loadingApplicationWorkerId, setLoadingApplicationWorkerId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [documentRejectModal, setDocumentRejectModal] = useState({
    open: false,
    docId: "",
    reason: ""
  });
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [includeDeletedUsers, setIncludeDeletedUsers] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [actionError, setActionError] = useState("");
  const [restoringUser, setRestoringUser] = useState(false);
  const [processingWorkerId, setProcessingWorkerId] = useState("");
  const [processingDocumentId, setProcessingDocumentId] = useState("");

  const filteredUsers = useMemo(() => {
    if (includeDeletedUsers) {
      return users;
    }

    return users.filter((user) => !user.isDeleted);
  }, [includeDeletedUsers, users]);

  const loadDashboardData = async ({ retry = false } = {}) => {
    try {
      if (retry) {
        setRetrying(true);
      } else {
        setLoadingDashboard(true);
        setLoadingUsers(true);
      }

      setDashboardError("");

      const [adminRes, usersRes] = await Promise.all([
        api.get("/admin/dashboard"),
        api.get("/users", {
          params: { includeDeleted: true }
        })
      ]);

      setPendingWorkers(adminRes.data?.pendingApplications || []);
      setDashboardStats(adminRes.data?.stats || null);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch (loadError) {
      setDashboardError(loadError.response?.data?.error || "Could not load the admin dashboard.");
    } finally {
      setLoadingDashboard(false);
      setLoadingUsers(false);
      setRetrying(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const openApplication = async (workerId) => {
    setLoadingApplication(true);
    setLoadingApplicationWorkerId(workerId);
    setActionError("");
    setRejectReason("");

    try {
      const { data } = await api.get(`/workers/applications/${workerId}`);
      setSelectedApplication(data);
    } catch (applicationError) {
      setSelectedApplication(null);
      setActionError(applicationError.response?.data?.error || "Could not load worker application details.");
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
    if (!selectedApplication) {
      return;
    }

    try {
      setProcessingDocumentId(docId);
      setActionError("");
      await api.patch(`/documents/${docId}/approve`);
      await refreshSelectedApplication(selectedApplication._id);
      await loadDashboardData({ retry: true });
    } catch (error) {
      setActionError(error.response?.data?.error || "Could not approve document.");
    } finally {
      setProcessingDocumentId("");
    }
  };

  const handleRejectDocument = async () => {
    if (!selectedApplication || !documentRejectModal.docId) {
      return;
    }

    if (!documentRejectModal.reason.trim()) {
      setActionError("Document rejection reason is required.");
      return;
    }

    try {
      setProcessingDocumentId(documentRejectModal.docId);
      setActionError("");
      await api.patch(`/documents/${documentRejectModal.docId}/reject`, {
        reason: documentRejectModal.reason.trim()
      });
      setDocumentRejectModal({ open: false, docId: "", reason: "" });
      await refreshSelectedApplication(selectedApplication._id);
      await loadDashboardData({ retry: true });
    } catch (error) {
      setActionError(error.response?.data?.error || "Could not reject document.");
    } finally {
      setProcessingDocumentId("");
    }
  };

  const handleApproveWorker = async (workerId) => {
    try {
      setProcessingWorkerId(workerId);
      setActionError("");
      await api.put(`/admin/approve/${workerId}`);
      setSelectedApplication(null);
      await loadDashboardData({ retry: true });
    } catch (error) {
      setActionError(
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Could not approve worker."
      );
    } finally {
      setProcessingWorkerId("");
    }
  };

  const handleRejectWorker = async (workerId) => {
    if (!rejectReason.trim()) {
      setActionError("Rejection reason is required.");
      return;
    }

    try {
      setProcessingWorkerId(workerId);
      setActionError("");
      await api.patch(`/workers/${workerId}/reject`, {
        reason: rejectReason.trim()
      });
      setSelectedApplication(null);
      setRejectReason("");
      await loadDashboardData({ retry: true });
    } catch (error) {
      setActionError(error.response?.data?.error || "Could not reject worker.");
    } finally {
      setProcessingWorkerId("");
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      setActionError("");
      await api.delete(`/users/${userId}`);
      await loadDashboardData({ retry: true });
      if (selectedApplication?.userId?._id === userId) {
        setSelectedApplication(null);
      }
    } catch (error) {
      setActionError(error.response?.data?.error || "Could not delete user.");
    }
  };

  const handleRestoreUser = async () => {
    if (!restoreTarget?._id) {
      return;
    }

    try {
      setRestoringUser(true);
      setActionError("");
      await api.patch(`/users/${restoreTarget._id}/restore`);
      setRestoreTarget(null);
      await loadDashboardData({ retry: true });
    } catch (error) {
      setActionError(error.response?.data?.error || "Could not restore user.");
    } finally {
      setRestoringUser(false);
    }
  };

  const renderPendingWorkers = () => {
    if (loadingDashboard) {
      return <TableSkeleton rows={3} />;
    }

    if (pendingWorkers.length === 0) {
      return (
        <EmptyState
          title="No pending worker applications"
          description="New worker signups that need review will appear here."
        />
      );
    }

    return (
      <div className="space-y-4">
        {pendingWorkers.map((worker) => (
          <div key={worker._id} className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">{worker.name || "Worker"}</h2>
                <p className="mt-1 text-slate-300">{worker.category} | {worker.location}</p>
                <p className="mt-1 text-slate-400">
                  Age: {worker.age || "NA"} | Experience: {worker.experience || 0} years
                </p>
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
                disabled={processingWorkerId === worker._id}
              >
                {processingWorkerId === worker._id ? "Approving..." : "Approve Worker"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderUsersTable = () => {
    if (loadingUsers) {
      return <TableSkeleton rows={6} />;
    }

    if (filteredUsers.length === 0) {
      return (
        <EmptyState
          title="No users to display"
          description="Try enabling deleted users or create a few accounts before the demo."
        />
      );
    }

    return (
      <div className="overflow-hidden rounded-3xl border border-white/10">
        <table className="min-w-full bg-white/5 text-left">
          <thead className="bg-slate-900/80 text-slate-300">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user._id} className="border-t border-white/10 text-slate-200">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span>{user.name}</span>
                    {user.isDeleted ? (
                      <span className="rounded-full border border-rose-300/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-rose-200">
                        Soft Deleted
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3 capitalize">{user.role}</td>
                <td className="px-4 py-3">
                  <UserStatusPill isDeleted={user.isDeleted} />
                </td>
                <td className="px-4 py-3">
                  {user.isDeleted ? (
                    <button
                      onClick={() => setRestoreTarget(user)}
                      className="rounded-full bg-emerald-400 px-3 py-1 text-sm text-slate-950"
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDeleteUser(user._id)}
                      className="rounded-full bg-rose-400 px-3 py-1 text-sm text-slate-950"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="space-y-6">
        <ErrorBanner
          message={dashboardError}
          onRetry={() => loadDashboardData({ retry: true })}
          retrying={retrying}
        />
        <ErrorBanner message={actionError} />

        {loadingDashboard && <StatsSkeleton />}
        {!loadingDashboard && dashboardStats && (
          <div className="grid gap-3 md:grid-cols-4">
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

        <div className="flex flex-wrap items-center gap-3">
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
          {tab === "users" ? (
            <label className="ml-auto flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={includeDeletedUsers}
                onChange={(event) => setIncludeDeletedUsers(event.target.checked)}
              />
              Show deleted users
            </label>
          ) : null}
        </div>

        {tab === "pending" ? renderPendingWorkers() : renderUsersTable()}
      </div>

      <Modal
        isOpen={!!selectedApplication}
        onClose={() => setSelectedApplication(null)}
        title="Application Review"
        size="large"
      >
        {selectedApplication ? (
          <>
            <div className="mb-4">
              <p className="text-slate-300">
                {selectedApplication.userId?.name} ({selectedApplication.userId?.email})
              </p>
              <p className="mt-1 text-slate-400">
                Role: {selectedApplication.category} | Area: {selectedApplication.location} | Age: {selectedApplication.age || "NA"}
              </p>
            </div>

            <div className="mb-6 rounded-2xl bg-white/5 p-4 text-slate-300">
              <p className="text-sm text-slate-400">Bio</p>
              <p className="mt-2">{selectedApplication.bio || "No bio provided."}</p>
            </div>

            <div className="mb-6">
              <h4 className="mb-3 text-lg font-semibold text-white">Uploaded Documents</h4>
              {selectedApplication.documents?.length === 0 ? (
                <p className="text-slate-400">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-3">
                  {selectedApplication.documents?.map((doc) => (
                    <div key={doc._id} className="rounded-2xl bg-white/5 p-4 text-sm text-slate-300">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="capitalize">{doc.documentType.replace("_", " ")}</p>
                          <p className="mt-1">
                            Status: <span className="capitalize">{doc.status}</span>
                          </p>
                          {doc.rejectionReason || doc.reviewNote ? (
                            <p className="mt-1 text-rose-300">
                              Reason: {doc.rejectionReason || doc.reviewNote}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          {doc.downloadUrl ? (
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
                          ) : null}
                          <Button
                            onClick={() => handleApproveDocument(doc._id)}
                            variant="success"
                            size="small"
                            disabled={processingDocumentId === doc._id}
                          >
                            {processingDocumentId === doc._id ? "Approving..." : "Approve"}
                          </Button>
                          <Button
                            onClick={() => setDocumentRejectModal({
                              open: true,
                              docId: doc._id,
                              reason: doc.rejectionReason || ""
                            })}
                            variant="danger"
                            size="small"
                            disabled={processingDocumentId === doc._id}
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
              <label className="mb-2 block text-sm text-slate-300">
                Rejection reason (required to reject worker)
              </label>
              <textarea
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Enter reason for rejecting this worker application"
                className="mb-3 min-h-24 w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => handleApproveWorker(selectedApplication._id)}
                  variant="success"
                  disabled={processingWorkerId === selectedApplication._id}
                >
                  {processingWorkerId === selectedApplication._id ? "Approving..." : "Approve Worker"}
                </Button>
                <Button
                  onClick={() => handleRejectWorker(selectedApplication._id)}
                  variant="danger"
                  disabled={processingWorkerId === selectedApplication._id}
                >
                  {processingWorkerId === selectedApplication._id ? "Rejecting..." : "Reject Worker"}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal
        isOpen={documentRejectModal.open}
        onClose={() => setDocumentRejectModal({ open: false, docId: "", reason: "" })}
        title="Reject Document"
        size="small"
      >
        <label className="block text-sm text-slate-300">
          Rejection reason
          <textarea
            value={documentRejectModal.reason}
            onChange={(event) => setDocumentRejectModal((current) => ({
              ...current,
              reason: event.target.value
            }))}
            placeholder="Explain why this document was rejected"
            className="mt-2 min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100"
          />
        </label>
        <div className="mt-5 flex gap-3">
          <Button onClick={handleRejectDocument} variant="danger" disabled={!documentRejectModal.reason.trim()}>
            Reject Document
          </Button>
          <Button
            onClick={() => setDocumentRejectModal({ open: false, docId: "", reason: "" })}
            variant="secondary"
          >
            Cancel
          </Button>
        </div>
      </Modal>

      <AdminRestoreUserModal
        isOpen={!!restoreTarget}
        user={restoreTarget}
        restoring={restoringUser}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleRestoreUser}
      />
    </div>
  );
}

export default AdminDashboard;
