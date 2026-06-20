import { cookies } from "next/headers";
import { IS_PROD } from "@/lib/env";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  type SessionPayload,
  verifySessionToken,
} from "@/lib/jwt";

/** Read + verify the current session from cookies (server components / actions / routes). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/** Set the session cookie. Only valid in Server Actions / Route Handlers. */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
