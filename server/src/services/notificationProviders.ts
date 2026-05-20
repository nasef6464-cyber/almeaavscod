import type { NotificationChannel } from "./notificationService.js";

type ProviderPayload = {
  channel: NotificationChannel;
  id: string;
  recipientEmail?: string;
  recipientPhone?: string;
  subject: string;
  title: string;
  body: string;
};

type ProviderResult = {
  ok: boolean;
  provider: string;
  providerMessageId?: string;
  failureReason?: string;
};

const jsonHeaders = { "content-type": "application/json" };

function providerName(channel: NotificationChannel) {
  if (channel === "email") return (process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
  if (channel === "whatsapp") return (process.env.WHATSAPP_PROVIDER || "").trim().toLowerCase();
  if (channel === "sms") return (process.env.SMS_PROVIDER || "").trim().toLowerCase();
  return "internal";
}

function getResponseMessageId(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  return String(record.id || record.messageId || record.message_id || record.sid || "");
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { ...jsonHeaders, ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 500) };
  }

  if (!response.ok) {
    throw new Error(`provider_http_${response.status}:${text.slice(0, 300)}`);
  }

  return data;
}

async function sendConsole(payload: ProviderPayload, provider: string): Promise<ProviderResult> {
  console.info(
    JSON.stringify({
      event: "notification_delivery",
      provider,
      channel: payload.channel,
      id: payload.id,
      recipientEmail: payload.recipientEmail || "",
      recipientPhone: payload.recipientPhone || "",
      title: payload.title,
    }),
  );
  return { ok: true, provider, providerMessageId: `console:${payload.id}` };
}

async function sendResendEmail(payload: ProviderPayload): Promise<ProviderResult> {
  if (!payload.recipientEmail) {
    return { ok: false, provider: "resend", failureReason: "missing_recipient_email" };
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return { ok: false, provider: "resend", failureReason: "resend_not_configured" };
  }

  const data = await postJson(
    "https://api.resend.com/emails",
    {
      from: process.env.EMAIL_FROM,
      to: [payload.recipientEmail],
      subject: payload.subject || payload.title,
      text: payload.body,
    },
    { authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  );

  return { ok: true, provider: "resend", providerMessageId: getResponseMessageId(data) };
}

async function sendHttpEmail(payload: ProviderPayload): Promise<ProviderResult> {
  if (!payload.recipientEmail) {
    return { ok: false, provider: "email_http", failureReason: "missing_recipient_email" };
  }
  if (!process.env.EMAIL_WEBHOOK_URL) {
    return { ok: false, provider: "email_http", failureReason: "email_webhook_not_configured" };
  }

  const headers: Record<string, string> = process.env.EMAIL_WEBHOOK_TOKEN
    ? { authorization: `Bearer ${process.env.EMAIL_WEBHOOK_TOKEN}` }
    : {};
  const data = await postJson(process.env.EMAIL_WEBHOOK_URL, payload, headers);
  return { ok: true, provider: "email_http", providerMessageId: getResponseMessageId(data) };
}

async function sendWhatsAppCloud(payload: ProviderPayload): Promise<ProviderResult> {
  if (!payload.recipientPhone) {
    return { ok: false, provider: "whatsapp_cloud", failureReason: "missing_recipient_phone" };
  }
  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return { ok: false, provider: "whatsapp_cloud", failureReason: "whatsapp_cloud_not_configured" };
  }

  const data = await postJson(
    `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to: payload.recipientPhone,
      type: "text",
      text: { preview_url: false, body: payload.body },
    },
    { authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
  );

  const messageId =
    Array.isArray((data as { messages?: unknown[] })?.messages) &&
    typeof (data as { messages: Array<Record<string, unknown>> }).messages[0]?.id === "string"
      ? String((data as { messages: Array<Record<string, unknown>> }).messages[0].id)
      : getResponseMessageId(data);

  return { ok: true, provider: "whatsapp_cloud", providerMessageId: messageId };
}

async function sendHttpWhatsApp(payload: ProviderPayload): Promise<ProviderResult> {
  if (!payload.recipientPhone) {
    return { ok: false, provider: "whatsapp_http", failureReason: "missing_recipient_phone" };
  }
  if (!process.env.WHATSAPP_WEBHOOK_URL) {
    return { ok: false, provider: "whatsapp_http", failureReason: "whatsapp_webhook_not_configured" };
  }

  const headers: Record<string, string> = process.env.WHATSAPP_WEBHOOK_TOKEN
    ? { authorization: `Bearer ${process.env.WHATSAPP_WEBHOOK_TOKEN}` }
    : {};
  const data = await postJson(process.env.WHATSAPP_WEBHOOK_URL, payload, headers);
  return { ok: true, provider: "whatsapp_http", providerMessageId: getResponseMessageId(data) };
}

async function sendTwilioSMS(payload: ProviderPayload): Promise<ProviderResult> {
  if (!payload.recipientPhone) {
    return { ok: false, provider: "twilio", failureReason: "missing_recipient_phone" };
  }
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    return { ok: false, provider: "twilio", failureReason: "twilio_not_configured" };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  const body = new URLSearchParams();
  body.append("To", payload.recipientPhone);
  body.append("From", fromNumber);
  body.append("Body", `${payload.title}\n\n${payload.body}`);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 500) };
  }

  if (!response.ok) {
    throw new Error(`twilio_${response.status}:${text.slice(0, 300)}`);
  }

  const messageId = getResponseMessageId(data);
  return { ok: true, provider: "twilio", providerMessageId: messageId };
}

async function sendHttpSMS(payload: ProviderPayload): Promise<ProviderResult> {
  if (!payload.recipientPhone) {
    return { ok: false, provider: "sms_http", failureReason: "missing_recipient_phone" };
  }
  if (!process.env.SMS_WEBHOOK_URL) {
    return { ok: false, provider: "sms_http", failureReason: "sms_webhook_not_configured" };
  }

  const headers: Record<string, string> = process.env.SMS_WEBHOOK_TOKEN
    ? { authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` }
    : {};
  const data = await postJson(process.env.SMS_WEBHOOK_URL, {
    to: payload.recipientPhone,
    body: `${payload.title}\n\n${payload.body}`,
  }, headers);
  return { ok: true, provider: "sms_http", providerMessageId: getResponseMessageId(data) };
}

export async function sendExternalNotification(payload: ProviderPayload): Promise<ProviderResult> {
  const provider = providerName(payload.channel);
  try {
    if (payload.channel === "email") {
      if (provider === "console") return sendConsole(payload, "console");
      if (provider === "resend") return sendResendEmail(payload);
      if (provider === "http") return sendHttpEmail(payload);
      return { ok: false, provider: provider || "none", failureReason: "email_provider_not_configured" };
    }

    if (payload.channel === "whatsapp") {
      if (provider === "console") return sendConsole(payload, "console");
      if (provider === "whatsapp_cloud") return sendWhatsAppCloud(payload);
      if (provider === "http") return sendHttpWhatsApp(payload);
      return { ok: false, provider: provider || "none", failureReason: "whatsapp_provider_not_configured" };
    }

    if (payload.channel === "sms") {
      if (provider === "twilio") return sendTwilioSMS(payload);
      if (provider === "http") return sendHttpSMS(payload);
      if (provider === "console") return sendConsole(payload, "console");
      return { ok: false, provider: provider || "none", failureReason: "sms_provider_not_configured" };
    }

    return { ok: true, provider: "internal" };
  } catch (error) {
    return {
      ok: false,
      provider: provider || "none",
      failureReason: error instanceof Error ? error.message.slice(0, 500) : "provider_error",
    };
  }
}
