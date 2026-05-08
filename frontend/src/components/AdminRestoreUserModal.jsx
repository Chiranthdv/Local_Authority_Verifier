import React from "react";
import Modal from "./Modal";
import Button from "./Button";

function AdminRestoreUserModal({ isOpen, user, restoring, onClose, onConfirm }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Restore User"
      size="small"
    >
      <p className="text-slate-300">
        Restore <span className="font-semibold text-white">{user?.name || "this user"}</span> and re-enable their account?
      </p>
      {user?.deletedAt && (
        <p className="mt-2 text-sm text-slate-400">
          Deleted on {new Date(user.deletedAt).toLocaleString()}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <Button onClick={onConfirm} variant="success" loading={restoring}>
          Restore User
        </Button>
        <Button onClick={onClose} variant="secondary" disabled={restoring}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

export default AdminRestoreUserModal;
