import nodemailer from "nodemailer";

const retryBackoffSeconds = [5, 30, 300] as const;

export type NotificationJobStatus =
  | "queued"
  | "processing"
  | "retrying"
  | "sent"
  | "failed"
  | "dead_letter";

export interface NotificationEmailProvider {
  send(input: {
    to: string;
    from?: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<{ providerMessageId: string }>;
}

export interface NotificationTemplatePayload {
  title: string;
  message: string;
  tenantName?: string;
  templateKey?: string | null;
}

export function renderNotificationEmail(input: NotificationTemplatePayload): {
  subject: string;
  html: string;
  text: string;
} {
  const brandName = input.tenantName ?? "Eventrax";
  return {
    subject: `${brandName}: ${input.title}`,
    html: `<html><body><h1>${brandName}</h1><h2>${input.title}</h2><p>${input.message}</p></body></html>`,
    text: `${brandName}\n\n${input.title}\n\n${input.message}`
  };
}

export class MockNotificationEmailProvider implements NotificationEmailProvider {
  constructor(private readonly shouldFail: boolean) {}

  async send(_: {
    to: string;
    from?: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<{ providerMessageId: string }> {
    if (this.shouldFail) {
      throw new Error("Simulated email provider failure");
    }

    return { providerMessageId: "mock-provider-message-id" };
  }
}

export interface SmtpProviderConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  fromEmail: string;
  fromName?: string;
}

export class SmtpNotificationEmailProvider implements NotificationEmailProvider {
  private readonly transporter;
  private readonly fromAddress: string;

  constructor(private readonly config: SmtpProviderConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth:
        config.user && config.password
          ? {
              user: config.user,
              pass: config.password
            }
          : undefined
    });
    this.fromAddress = config.fromName
      ? `"${config.fromName.replace(/"/g, '\\"')}" <${config.fromEmail}>`
      : config.fromEmail;
  }

  async send(input: {
    to: string;
    from?: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<{ providerMessageId: string }> {
    const info = await this.transporter.sendMail({
      from: input.from ?? this.fromAddress,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text
    });

    return { providerMessageId: info.messageId || "smtp-message-id" };
  }
}

export function resolveSmtpProviderConfig(source: {
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_SECURE?: boolean;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM_EMAIL?: string;
  SMTP_FROM_NAME?: string;
}): SmtpProviderConfig | null {
  if (!source.SMTP_HOST || !source.SMTP_PORT || !source.SMTP_FROM_EMAIL) {
    return null;
  }

  return {
    host: source.SMTP_HOST,
    port: source.SMTP_PORT,
    secure: source.SMTP_SECURE ?? false,
    user: source.SMTP_USER,
    password: source.SMTP_PASSWORD,
    fromEmail: source.SMTP_FROM_EMAIL,
    fromName: source.SMTP_FROM_NAME
  };
}

export function resolveRetryState(input: {
  attemptCount: number;
  maxAttempts: number;
  now?: Date;
}): {
  status: NotificationJobStatus;
  nextAttemptAt: Date | null;
} {
  const now = input.now ?? new Date();
  const nextAttemptNumber = input.attemptCount + 1;

  if (nextAttemptNumber >= input.maxAttempts) {
    return {
      status: "dead_letter",
      nextAttemptAt: null
    };
  }

  const backoffSeconds =
    retryBackoffSeconds[Math.min(nextAttemptNumber - 1, retryBackoffSeconds.length - 1)] ?? 300;

  return {
    status: "retrying",
    nextAttemptAt: new Date(now.getTime() + backoffSeconds * 1000)
  };
}
