import { codeEmail } from "../application/email/templates";

/**
 * Cognito's "custom message" trigger (infra: the user pool's CUSTOM_MESSAGE): the sign-up, resend and
 * password-reset codes in NeuroCal's own email design instead of Cognito's plain text. Cognito puts the
 * code where `codeParameter` ("{####}") stands. Other messages keep Cognito's defaults.
 */
export interface CustomMessageEvent {
  triggerSource: string;
  request: { codeParameter?: string; userAttributes?: Record<string, string> };
  response: { emailSubject?: string; emailMessage?: string; smsMessage?: string };
}

const CONFIRM = new Set(["CustomMessage_SignUp", "CustomMessage_ResendCode", "CustomMessage_VerifyUserAttribute", "CustomMessage_UpdateUserAttribute"]);

export async function handler(event: CustomMessageEvent): Promise<CustomMessageEvent> {
  const code = event.request.codeParameter;
  const purpose = event.triggerSource === "CustomMessage_ForgotPassword" ? "reset" : CONFIRM.has(event.triggerSource) ? "confirm" : null;
  if (!code || !purpose) return event;
  const email = codeEmail(code, purpose, event.request.userAttributes?.email);
  event.response.emailSubject = email.subject;
  event.response.emailMessage = email.html;
  return event;
}
