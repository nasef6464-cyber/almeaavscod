import { randomUUID } from "node:crypto";
import type { AppRole } from "../constants/roles.js";
import { NotificationDeliveryModel } from "../models/NotificationDelivery.js";
import { NotificationTemplateModel } from "../models/NotificationTemplate.js";
import { UserModel } from "../models/User.js";
import { sendExternalNotification } from "./notificationProviders.js";

export type NotificationChannel = "in_app" | "email" | "whatsapp";

type NotificationRecipient = {
  id: string;
  email?: string;
  role?: string;
  name?: string;
};

type CreateNotificationInput = {
  templateKey?: string;
  title?: string;
  subject?: string;
  body?: string;
  channels: NotificationChannel[];
  userIds?: string[];
  roles?: AppRole[];
  variables?: Record<string, string | number | boolean | null | undefined>;
  createdBy: string;
};

const MAX_RECIPIENTS_PER_REQUEST = 500;

function renderTemplate(source: string, variables: Record<string, unknown>) {
  return source.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => String(variables[key] ?? ""));
}

async function resolveRecipients(input: Pick<CreateNotificationInput, "userIds" | "roles">) {
  const filters: Record<string, unknown>[] = [];
  if (input.userIds?.length) {
    filters.push({
      $or: [{ _id: { $in: input.userIds } }, { id: { $in: input.userIds } }],
    });
  }
  if (input.roles?.length) {
    filters.push({ role: { $in: input.roles } });
  }

  if (!filters.length) {
    return [];
  }

  const users = await UserModel.find(filters.length === 1 ? filters[0] : { $or: filters })
    .select("_id id name email role")
    .limit(MAX_RECIPIENTS_PER_REQUEST + 1)
    .lean();

  const unique = new Map<string, NotificationRecipient>();
  for (const user of users) {
    const rawUser = user as { id?: string; _id?: unknown; email?: string; role?: string; name?: string };
    const id = String(rawUser.id || rawUser._id);
    if (!unique.has(id)) {
      unique.set(id, {
        id,
        email: rawUser.email || "",
        role: rawUser.role || "",
        name: rawUser.name || "",
      });
    }
  }

  return Array.from(unique.values()).slice(0, MAX_RECIPIENTS_PER_REQUEST);
}

async function resolveMessage(input: CreateNotificationInput) {
  const template = input.templateKey
    ? await NotificationTemplateModel.findOne({ key: input.templateKey, isActive: { $ne: false } }).lean()
    : null;
  const variables = input.variables || {};

  const title = renderTemplate(String(input.title || template?.title || ""), variables).trim();
  const subject = renderTemplate(String(input.subject || template?.subject || title), variables).trim();
  const body = renderTemplate(String(input.body || template?.body || ""), variables).trim();

  if (!title || !body) {
    throw new Error("Notification title and body are required");
  }

  return {
    templateKey: template?.key || input.templateKey || "",
    title,
    subject,
    body,
  };
}

export async function createNotificationDeliveries(input: CreateNotificationInput) {
  const recipients = await resolveRecipients(input);
  const message = await resolveMessage(input);
  const campaignId = randomUUID();
  const now = Date.now();

  if (!recipients.length) {
    return { campaignId, created: 0, recipients: 0 };
  }

  const channels = Array.from(new Set(input.channels));
  const docs = recipients.flatMap((recipient) =>
    channels.map((channel) => ({
      id: randomUUID(),
      campaignId,
      templateKey: message.templateKey,
      channel,
      status: channel === "in_app" ? "sent" : "pending",
      title: message.title,
      subject: message.subject,
      body: message.body,
      recipientUserId: recipient.id,
      recipientEmail: recipient.email || "",
      recipientRole: recipient.role || "",
      provider: channel === "in_app" ? "internal" : "",
      sentAt: channel === "in_app" ? now : null,
      createdBy: input.createdBy,
      metadata: {
        recipientName: recipient.name || "",
      },
    })),
  );

  const inserted = await NotificationDeliveryModel.insertMany(docs, { ordered: false });
  return {
    campaignId,
    created: docs.length,
    recipients: recipients.length,
    deliveryIds: inserted.map((item) => String(item.id)),
  };
}

export async function processNotificationDeliveryById(deliveryId: string) {
  const item = await NotificationDeliveryModel.findOne({
    id: deliveryId,
    status: { $in: ["pending", "retrying"] },
    channel: { $in: ["email", "whatsapp"] },
  });

  if (!item) {
    return { processed: false, status: "not_found_or_not_pending" };
  }

  const result = await sendExternalNotification({
    channel: item.channel as NotificationChannel,
    id: item.id,
    recipientEmail: item.recipientEmail,
    recipientPhone: item.recipientPhone,
    subject: item.subject,
    title: item.title,
    body: item.body,
  });

  if (result.ok) {
    item.status = "sent";
    item.provider = result.provider;
    item.providerMessageId = result.providerMessageId || item.providerMessageId || "";
    item.sentAt = Date.now();
    item.failureReason = "";
    await item.save();
    return { processed: true, status: "sent", provider: result.provider };
  }

  item.status = item.retryCount >= 3 ? "failed" : "retrying";
  item.provider = result.provider;
  item.failureReason = result.failureReason || `${item.channel}_provider_failed`;
  item.retryCount += 1;
  item.nextAttemptAt = Date.now() + 15 * 60 * 1000;
  await item.save();
  return { processed: true, status: item.status, provider: result.provider };
}

export async function processPendingNotifications(limit = 25) {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const pending = await NotificationDeliveryModel.find({
    status: { $in: ["pending", "retrying"] },
    channel: { $in: ["email", "whatsapp"] },
    $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: Date.now() } }],
  })
    .sort({ createdAt: 1 })
    .limit(safeLimit);

  let sent = 0;
  let retrying = 0;
  let failed = 0;

  for (const item of pending) {
    const result = await processNotificationDeliveryById(item.id);
    if (result.status === "sent") {
      sent += 1;
      continue;
    }

    if (result.status === "failed") {
      failed += 1;
    } else if (result.status === "retrying") {
      retrying += 1;
    }
  }

  return { scanned: pending.length, sent, retrying, failed };
}

export function getNotificationBatchLimit() {
  return MAX_RECIPIENTS_PER_REQUEST;
}
