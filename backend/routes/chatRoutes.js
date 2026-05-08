const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Job = require("../models/Job");
const WorkerProfile = require("../models/WorkerProfile");
const User = require("../models/User");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const { createActionCooldownMiddleware } = require("../middleware/actionCooldown");
const { chatIpLimiter, chatUserLimiter } = require("../middleware/rateLimiters");
const { emitToUser } = require("../services/realtime");
const { createNotification } = require("../utils/notifications");
const {
  parsePositiveInt,
  decodeCursor,
  encodeCursor,
  buildDescendingCursorFilter
} = require("../utils/cursorPagination");

function toPositiveInt(value, fallbackValue) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return parsed;
}

const CHAT_MESSAGE_COOLDOWN_MS = Number.parseInt(process.env.COOLDOWN_CHAT_MESSAGE_MS, 10) || 5000;
const CHAT_MESSAGE_MIN_LENGTH = toPositiveInt(process.env.CHAT_MESSAGE_MIN_LENGTH, 1);
const CHAT_MESSAGE_MAX_LENGTH = Math.max(CHAT_MESSAGE_MIN_LENGTH, toPositiveInt(process.env.CHAT_MESSAGE_MAX_LENGTH, 1000));
const CHAT_MAX_LINKS_PER_MESSAGE = toPositiveInt(process.env.CHAT_MAX_LINKS_PER_MESSAGE, 2);
const DEFAULT_CHAT_MESSAGES_LIMIT = 50;
const MAX_CHAT_MESSAGES_LIMIT = 100;
const DEFAULT_CHAT_BOOKING_STATUSES = ["accepted", "completed"];
const configuredBookingStatuses = (
  typeof process.env.CHAT_ALLOWED_BOOKING_STATUSES === "string"
    ? process.env.CHAT_ALLOWED_BOOKING_STATUSES.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean)
    : []
);
const CHAT_ALLOWED_BOOKING_STATUSES = configuredBookingStatuses.length
  ? configuredBookingStatuses
  : DEFAULT_CHAT_BOOKING_STATUSES;
const chatMessageCooldown = createActionCooldownMiddleware({
  cooldownMs: CHAT_MESSAGE_COOLDOWN_MS,
  actionTypeGenerator: (req) => {
    const conversationId = req.params?.conversationId;
    if (!conversationId) return "";
    return `chat:${conversationId}`;
  },
  message: "Please wait before sending another message in this conversation."
});

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function toObjectId(id) {
  return new mongoose.Types.ObjectId(id);
}

function getEntityId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
}

function getParticipantRole(user, conversation) {
  const userId = String(user?.userId || "");
  if (!userId) return "";
  if (getEntityId(conversation.customerId) === userId) return "customer";
  if (getEntityId(conversation.workerId) === userId) return "worker";
  return "";
}

function getOtherUserId(userId, conversation) {
  if (getEntityId(conversation.customerId) === String(userId)) return getEntityId(conversation.workerId);
  return getEntityId(conversation.customerId);
}

function isConversationDisabled(conversation) {
  return Boolean(conversation?.isDisabled);
}

function normalizeMessageText(rawText) {
  if (typeof rawText !== "string") return "";
  return rawText
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasSpamPattern(text) {
  if (!text) return false;
  if (/(.)\1{14,}/u.test(text)) return true;
  const linkCount = (text.match(/\b(?:https?:\/\/|www\.)\S+/gi) || []).length;
  if (linkCount > CHAT_MAX_LINKS_PER_MESSAGE) return true;
  const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length >= 6 && new Set(tokens).size === 1) return true;
  return false;
}

function validateMessageText(rawText) {
  const text = normalizeMessageText(rawText);
  if (!text) {
    return { error: "Message text is required", text: "" };
  }
  if (text.length < CHAT_MESSAGE_MIN_LENGTH) {
    return { error: `Message must be at least ${CHAT_MESSAGE_MIN_LENGTH} characters`, text: "" };
  }
  if (text.length > CHAT_MESSAGE_MAX_LENGTH) {
    return { error: `Message must be at most ${CHAT_MESSAGE_MAX_LENGTH} characters`, text: "" };
  }
  if (hasSpamPattern(text)) {
    return { error: "Message looks like spam and was rejected", text: "" };
  }
  return { error: "", text };
}

function toPublicUser(userRef) {
  if (!userRef) return null;
  const id = getEntityId(userRef);
  if (!id) return null;
  return {
    _id: id,
    name: typeof userRef?.name === "string" && userRef.name.trim() ? userRef.name.trim() : "User",
    role: typeof userRef?.role === "string" ? userRef.role : undefined
  };
}

function toPublicConversation(conversation, viewerUserId, unreadCount) {
  const plain = conversation?.toObject ? conversation.toObject() : conversation;
  const customer = toPublicUser(plain?.customerId);
  const worker = toPublicUser(plain?.workerId);
  const isCustomer = customer && String(customer._id) === String(viewerUserId);
  const otherUser = isCustomer ? worker : customer;
  const payload = {
    _id: getEntityId(plain?._id),
    customerId: customer,
    workerId: worker,
    lastMessage: typeof plain?.lastMessage === "string" ? plain.lastMessage : "",
    lastMessageAt: plain?.lastMessageAt || null,
    createdAt: plain?.createdAt || null,
    updatedAt: plain?.updatedAt || null,
    isDisabled: Boolean(plain?.isDisabled),
    jobId: plain?.jobId ? getEntityId(plain.jobId) : null,
    otherUser
  };

  if (Number.isInteger(unreadCount)) {
    payload.unreadCount = unreadCount;
  }

  return payload;
}

function toPublicMessage(message) {
  const plain = message?.toObject ? message.toObject() : message;
  return {
    _id: getEntityId(plain?._id),
    conversationId: getEntityId(plain?.conversationId),
    senderId: getEntityId(plain?.senderId),
    receiverId: getEntityId(plain?.receiverId),
    text: typeof plain?.text === "string" ? plain.text : "",
    isRead: Boolean(plain?.isRead),
    readAt: plain?.readAt || null,
    createdAt: plain?.createdAt || null,
    updatedAt: plain?.updatedAt || null
  };
}

async function findLatestValidBooking(customerId, workerId) {
  if (!isValidObjectId(customerId) || !isValidObjectId(workerId)) {
    return null;
  }

  return Job.findOne({
    customerId,
    workerId,
    isArchived: false,
    status: { $in: CHAT_ALLOWED_BOOKING_STATUSES }
  })
    .sort({ acceptedAt: -1, completedAt: -1, createdAt: -1 })
    .select("_id customerId workerId status")
    .lean();
}

async function resolveValidBookingForConversation(conversation) {
  const customerId = getEntityId(conversation?.customerId);
  const workerId = getEntityId(conversation?.workerId);
  if (!isValidObjectId(customerId) || !isValidObjectId(workerId)) {
    return null;
  }

  const conversationJobId = getEntityId(conversation?.jobId);
  if (isValidObjectId(conversationJobId)) {
    const matched = await Job.findOne({
      _id: conversationJobId,
      customerId,
      workerId,
      isArchived: false,
      status: { $in: CHAT_ALLOWED_BOOKING_STATUSES }
    })
      .select("_id customerId workerId status")
      .lean();
    if (matched) return matched;
  }

  return findLatestValidBooking(customerId, workerId);
}

async function markConversationDisabled(conversation, reason) {
  if (!conversation || isConversationDisabled(conversation)) {
    return;
  }

  conversation.isDisabled = true;
  conversation.disabledAt = new Date();
  conversation.disabledReason = reason || "Conversation disabled";
  await conversation.save();
}

async function loadConversationForAuthorizedParticipant(req, res, next) {
  try {
    const { conversationId } = req.params;
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ error: "Invalid conversation id" });
    }

    const conversation = await Conversation.findById(conversationId)
      .populate({ path: "customerId", select: "name role", match: { isDeleted: false } })
      .populate({ path: "workerId", select: "name role", match: { isDeleted: false } });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (isConversationDisabled(conversation) || !conversation.customerId || !conversation.workerId) {
      return res.status(410).json({ error: "Conversation is no longer available" });
    }
    const customerId = getEntityId(conversation.customerId);
    const workerId = getEntityId(conversation.workerId);
    if (!isValidObjectId(customerId) || !isValidObjectId(workerId)) {
      await markConversationDisabled(conversation, "Conversation has invalid participant references");
      return res.status(410).json({ error: "Conversation is no longer available" });
    }

    const participantRole = getParticipantRole(req.user, conversation);
    if (!participantRole) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const validBooking = await resolveValidBookingForConversation(conversation);
    if (!validBooking) {
      await markConversationDisabled(conversation, "No valid booking exists between participants");
      return res.status(403).json({ error: "Valid booking is required for chat access" });
    }

    if (String(conversation.jobId || "") !== String(validBooking._id)) {
      conversation.jobId = validBooking._id;
      await conversation.save();
    }

    req.chatContext = {
      participantRole,
      conversation,
      booking: validBooking
    };
    return next();
  } catch (error) {
    return res.status(500).json({ error: "Could not authorize conversation access" });
  }
}

router.post("/start", auth, role("customer", "worker"), async (req, res) => {
  try {
    const requestedWorkerId = req.body?.workerId;
    const requestedCustomerId = req.body?.customerId;

    let customerId = "";
    let workerId = "";

    if (req.user.role === "customer") {
      workerId = requestedWorkerId;
      customerId = req.user.userId;
    } else {
      customerId = requestedCustomerId;
      workerId = req.user.userId;
    }

    if (!isValidObjectId(workerId)) {
      return res.status(400).json({ error: "Invalid worker id" });
    }

    if (!isValidObjectId(customerId)) {
      return res.status(400).json({ error: "Invalid customer id" });
    }

    if (String(workerId) === String(customerId)) {
      return res.status(400).json({ error: "You cannot start a chat with yourself" });
    }

    const [workerProfile, customerUser] = await Promise.all([
      WorkerProfile.findOne({
        userId: workerId,
        verificationStatus: "approved",
        isDeleted: false
      }).populate({
        path: "userId",
        select: "_id role",
        match: { role: "worker", isDeleted: false }
      }),
      User.findOne({
        _id: customerId,
        role: "customer",
        isDeleted: false
      }).select("_id role")
    ]);

    if (!workerProfile || !workerProfile.userId) {
      return res.status(404).json({ error: "Worker is not available for chat" });
    }

    if (!customerUser) {
      return res.status(404).json({ error: "Customer is not available for chat" });
    }

    const validBooking = await findLatestValidBooking(customerId, workerId);
    if (!validBooking) {
      return res.status(403).json({ error: "Valid booking is required before starting chat" });
    }

    let created = false;
    let conversation = await Conversation.findOne({
      customerId,
      workerId
    });
    if (!conversation) {
      conversation = await Conversation.create({
        customerId,
        workerId,
        jobId: validBooking._id,
        lastMessage: "",
        lastMessageAt: new Date()
      });
      created = true;
    }

    if (isConversationDisabled(conversation)) {
      conversation.isDisabled = false;
      conversation.disabledAt = null;
      conversation.disabledReason = "";
    }
    if (String(conversation.jobId || "") !== String(validBooking._id)) {
      conversation.jobId = validBooking._id;
    }
    await conversation.save();

    conversation = await Conversation.findById(conversation._id)
      .populate({ path: "customerId", select: "name role", match: { isDeleted: false } })
      .populate({ path: "workerId", select: "name role", match: { isDeleted: false } });

    return res.status(created ? 201 : 200).json(toPublicConversation(conversation, req.user.userId));
  } catch (err) {
    if (err?.code === 11000) {
      const fallbackCustomerId = req.user.role === "customer" ? req.user.userId : req.body.customerId;
      const fallbackWorkerId = req.user.role === "customer" ? req.body.workerId : req.user.userId;
      const validBooking = await findLatestValidBooking(fallbackCustomerId, fallbackWorkerId);
      if (!validBooking) {
        return res.status(403).json({ error: "Valid booking is required before starting chat" });
      }
      const conversation = await Conversation.findOne({
        customerId: fallbackCustomerId,
        workerId: fallbackWorkerId
      })
        .populate({ path: "customerId", select: "name role", match: { isDeleted: false } })
        .populate({ path: "workerId", select: "name role", match: { isDeleted: false } });
      if (conversation) {
        if (isConversationDisabled(conversation)) {
          conversation.isDisabled = false;
          conversation.disabledAt = null;
          conversation.disabledReason = "";
        }
        if (String(conversation.jobId || "") !== String(validBooking._id)) {
          conversation.jobId = validBooking._id;
        }
        await conversation.save();
        return res.json(toPublicConversation(conversation, req.user.userId));
      }
    }
    res.status(500).json({ error: "Could not start chat" });
  }
});

router.get("/my", auth, role("customer", "worker"), async (req, res) => {
  try {
    const match = req.user.role === "customer"
      ? { customerId: req.user.userId }
      : { workerId: req.user.userId };

    const conversations = await Conversation.find(match)
      .where({ isDisabled: false })
      .populate({ path: "customerId", select: "name role", match: { isDeleted: false } })
      .populate({ path: "workerId", select: "name role", match: { isDeleted: false } })
      .sort({ lastMessageAt: -1 });

    const activeConversations = conversations.filter((item) => item.customerId && item.workerId);
    const bookingByPair = new Map();
    const authorizedConversations = (
      await Promise.all(activeConversations.map(async (conversation) => {
        const customerId = getEntityId(conversation.customerId);
        const workerId = getEntityId(conversation.workerId);
        const pairKey = `${customerId}:${workerId}`;

        let booking = bookingByPair.get(pairKey);
        if (booking === undefined) {
          booking = await resolveValidBookingForConversation(conversation);
          bookingByPair.set(pairKey, booking || null);
        }

        if (!booking) {
          await markConversationDisabled(conversation, "No valid booking exists between participants");
          return null;
        }

        if (String(conversation.jobId || "") !== String(booking._id)) {
          conversation.jobId = booking._id;
          await conversation.save();
        }

        return conversation;
      }))
    ).filter(Boolean);

    const conversationIds = authorizedConversations.map((item) => item._id);
    const unread = await Message.aggregate([
      {
        $match: {
          conversationId: { $in: conversationIds.map((id) => toObjectId(id)) },
          receiverId: toObjectId(req.user.userId),
          isRead: false
        }
      },
      {
        $group: {
          _id: "$conversationId",
          count: { $sum: 1 }
        }
      }
    ]);
    const unreadMap = unread.reduce((acc, item) => {
      acc[String(item._id)] = item.count;
      return acc;
    }, {});

    const data = authorizedConversations.map((conversation) => (
      toPublicConversation(conversation, req.user.userId, unreadMap[String(conversation._id)] || 0)
    ));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Could not load conversations" });
  }
});

router.get("/:conversationId/messages", auth, role("customer", "worker"), loadConversationForAuthorizedParticipant, async (req, res) => {
  try {
    const { conversation } = req.chatContext;
    const limit = parsePositiveInt(req.query.limit, DEFAULT_CHAT_MESSAGES_LIMIT, MAX_CHAT_MESSAGES_LIMIT);
    const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null;
    if (req.query.cursor && !cursor) {
      return res.status(400).json({ error: "Invalid cursor" });
    }

    const query = {
      conversationId: conversation._id,
      ...buildDescendingCursorFilter(cursor, "createdAt", "_id")
    };
    const rows = await Message.find(query)
      .select("_id conversationId senderId receiverId text isRead readAt createdAt updatedAt")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const pageDesc = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? encodeCursor(pageDesc[pageDesc.length - 1]) : null;
    const messages = pageDesc.reverse();

    const messageIds = messages.map((item) => item._id).filter(Boolean);
    if (messageIds.length) {
      await Message.updateMany(
        { _id: { $in: messageIds }, receiverId: req.user.userId, isRead: false },
        { isRead: true, readAt: new Date() }
      );
    }

    return res.json({
      conversation: toPublicConversation(conversation, req.user.userId),
      messages: messages.map((message) => toPublicMessage(message)),
      nextCursor,
      hasMore,
      limit
    });
  } catch (err) {
    res.status(500).json({ error: "Could not load messages" });
  }
});

router.post("/:conversationId/messages", auth, role("customer", "worker"), chatIpLimiter, chatUserLimiter, chatMessageCooldown, loadConversationForAuthorizedParticipant, async (req, res) => {
  try {
    const { error, text } = validateMessageText(req.body.text);
    if (error) {
      return res.status(400).json({ error });
    }

    const { conversation } = req.chatContext;

    const recentDuplicate = await Message.findOne({
      conversationId: conversation._id,
      senderId: req.user.userId,
      text
    }).sort({ createdAt: -1 }).select("_id createdAt");

    if (recentDuplicate) {
      const ageMs = Date.now() - new Date(recentDuplicate.createdAt).getTime();
      if (ageMs < CHAT_MESSAGE_COOLDOWN_MS) {
        const retryAfterSeconds = Math.max(1, Math.ceil((CHAT_MESSAGE_COOLDOWN_MS - ageMs) / 1000));
        res.set("Retry-After", String(retryAfterSeconds));
        return res.status(429).json({
          error: "Duplicate message detected. Please wait before sending the same message again.",
          retryAfterSeconds
        });
      }
    }

    const receiverId = getOtherUserId(req.user.userId, conversation);
    if (!isValidObjectId(receiverId)) {
      await markConversationDisabled(conversation, "Conversation has invalid receiver mapping");
      return res.status(410).json({ error: "Conversation is no longer available" });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      senderId: req.user.userId,
      receiverId,
      text
    });

    conversation.lastMessage = text.slice(0, 200);
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const sender = await User.findById(req.user.userId).select("name");

    const payload = toPublicMessage({
      ...message.toObject(),
      conversationId: String(conversation._id)
    });

    emitToUser(receiverId, "chat:message", payload);
    emitToUser(req.user.userId, "chat:message", payload);

    await createNotification({
      userId: receiverId,
      requestId: conversation.jobId || undefined,
      type: "chat_message",
      title: "New Chat Message",
      message: `${sender?.name || "User"}: ${text.slice(0, 80)}`
    });

    res.status(201).json(payload);
  } catch (err) {
    res.status(500).json({ error: "Could not send message" });
  }
});

router.patch("/:conversationId/read", auth, role("customer", "worker"), loadConversationForAuthorizedParticipant, async (req, res) => {
  try {
    const { conversation } = req.chatContext;
    const readTimestamp = new Date();

    const result = await Message.updateMany(
      { conversationId: conversation._id, receiverId: req.user.userId, isRead: false },
      { isRead: true, readAt: readTimestamp }
    );

    const otherUserId = getOtherUserId(req.user.userId, conversation);
    emitToUser(otherUserId, "chat:read", {
      conversationId: String(conversation._id),
      readerId: req.user.userId,
      readAt: readTimestamp
    });

    res.json({
      updatedCount: result.modifiedCount || 0,
      readAt: readTimestamp
    });
  } catch (err) {
    res.status(500).json({ error: "Could not update read status" });
  }
});

module.exports = router;
