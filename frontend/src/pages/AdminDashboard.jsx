import { useEffect, useState } from "react";
import api from "../lib/api";

function AdminDashboard() {
  const [tab, setTab] = useState("pending");
  const [pendingWorkers, setPendingWorkers] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.get("/workers/pending").then(({ data }) => setPendingWorkers(data)).catch(() => setPendingWorkers([]));
    api.get("/users").then(({ data }) => setUsers(data)).catch(() => setUsers([]));
  }, []);

  const handleAction = async (id, action) => {
    await api.patch(`/workers/${id}/${action}`);
    setPendingWorkers((current) => current.filter((worker) => worker._id !== id));
  };

  const handleDeleteUser = async (id) => {
    await api.delete(`/users/${id}`);
    setUsers((current) => current.filter((user) => user._id !== id));
    setPendingWorkers((current) => current.filter((worker) => worker.userId?._id !== id));
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex gap-3">
        <button onClick={() => setTab("pending")} className={`rounded-full px-5 py-2 ${tab === "pending" ? "bg-cyan-400 text-slate-950" : "border border-white/10 text-slate-300"}`}>Pending Workers</button>
        <button onClick={() => setTab("users")} className={`rounded-full px-5 py-2 ${tab === "users" ? "bg-cyan-400 text-slate-950" : "border border-white/10 text-slate-300"}`}>All Users</button>
      </div>

      {tab === "pending" && (
        <div className="space-y-4">
          {pendingWorkers.map((worker) => (
            <div key={worker._id} className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">{worker.userId?.name}</h2>
              <p className="mt-2 text-slate-300">{worker.category} • {worker.location}</p>
              <p className="mt-2 text-slate-400">{worker.bio || "No bio provided."}</p>
              <p className="mt-2 text-slate-400">{worker.skills?.join(", ") || "No skills listed."}</p>
              <div className="mt-4 flex gap-3">
                <button onClick={() => handleAction(worker._id, "approve")} className="rounded-full bg-emerald-400 px-4 py-2 text-slate-950">Approve</button>
                <button onClick={() => handleAction(worker._id, "reject")} className="rounded-full bg-rose-400 px-4 py-2 text-slate-950">Reject</button>
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
    </div>
  );
}

export default AdminDashboard;
