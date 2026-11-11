/**
 * Outbound mail adapter.
 *
 * Phase 1 ships with a console transport so the platform works without an
 * external account. Swap `deliver` for a provider (SMTP/API) when credentials
 * are available — no caller changes are required.
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailResult {
  delivered: boolean;
  transport: "console" | "smtp";
}

async function deliver(message: MailMessage): Promise<MailResult> {
  // No provider configured: write the message to the server log so operators
  // can retrieve a reset link during setup. Never echoed to the browser by
  // default (see AUTH_EXPOSE_RESET_LINKS).
  console.info(
    `[mail:console] to=${message.to} subject="${message.subject}"\n${message.text}`,
  );
  return { delivered: false, transport: "console" };
}

export const mailer = { deliver };
