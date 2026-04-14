const User = require("../models/User");
const WorkerProfile = require("../models/WorkerProfile");
const Job = require("../models/Job");
const Conversation = require("../models/Conversation");
const Notification = require("../models/Notification");
const NotificationOutbox = require("../models/NotificationOutbox");

async function softDeleteUserById(userId) {
  const user = await User.findOne({ _id: userId, isDeleted: false }).select("_id role");
  if (!user) {
    return null;
  }

  const now = new Date();

  await User.updateOne(
    { _id: userId, isDeleted: false },
    { $set: { isDeleted: true, deletedAt: now } }
  );

  await WorkerProfile.updateMany(
    { userId },
    {
      $set: {
        isDeleted: true,
        deletedAt: now,
        verificationStatus: "rejected",
        rejectionReason: "Account deactivated"
      }
    }
  );

  await Job.updateMany(
    {
      $or: [{ customerId: userId }, { workerId: userId }],
      isArchived: false
    },
    {
      $set: {
        isArchived: true,
        archivedAt: now,
        archivedReason: "linked_user_deleted"
      }
    }
  );

  await Job.updateMany(
    {
      $or: [{ customerId: userId }, { workerId: userId }],
      status: { $in: ["pending", "requested", "accepted"] }
    },
    {
      $set: {
        status: "cancelled",
        rejectionReason: "Booking archived because linked user was deleted"
      }
    }
  );

  await Conversation.updateMany(
    { $or: [{ customerId: userId }, { workerId: userId }] },
    {
      $set: {
        isDisabled: true,
        disabledAt: now,
        disabledReason: "linked_user_deleted"
      }
    }
  );

  await Notification.updateMany(
    { userId, isHidden: { $ne: true } },
    {
      $set: {
        isHidden: true,
        hiddenAt: now,
        hiddenReason: "linked_user_deleted"
      }
    }
  );

  await NotificationOutbox.updateMany(
    {
      userId,
      status: { $in: ["pending", "failed", "processing"] }
    },
    {
      $set: {
        status: "dead",
        deadLetterReason: "linked_user_deleted",
        nextAttemptAt: null,
        lockedAt: null,
        lockedBy: ""
      }
    }
  );

  return { _id: user._id, role: user.role, isDeleted: true, deletedAt: now };
}

async function restoreUserById(userId) {
  const user = await User.findOne({ _id: userId, isDeleted: true }).select("_id role");
  if (!user) {
    return null;
  }

  await User.updateOne(
    { _id: userId, isDeleted: true },
    { $set: { isDeleted: false, deletedAt: null } }
  );

  if (user.role === "worker") {
    await WorkerProfile.updateMany(
      { userId },
      {
        $set: {
          isDeleted: false,
          deletedAt: null,
          verificationStatus: "pending",
          rejectionReason: ""
        }
      }
    );
  }

  await Conversation.updateMany(
    {
      $or: [{ customerId: userId }, { workerId: userId }],
      isDisabled: true,
      disabledReason: "linked_user_deleted"
    },
    {
      $set: {
        isDisabled: false,
        disabledAt: null,
        disabledReason: ""
      }
    }
  );

  await Notification.updateMany(
    { userId, isHidden: true, hiddenReason: "linked_user_deleted" },
    {
      $set: {
        isHidden: false,
        hiddenAt: null,
        hiddenReason: ""
      }
    }
  );

  return { _id: user._id, role: user.role, isDeleted: false, deletedAt: null };
}

module.exports = {
  softDeleteUserById,
  restoreUserById
};
