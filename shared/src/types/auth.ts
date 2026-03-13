export type AuthRole = "user" | "coach";

export interface AuthUser {
  id: string;
  username: string;
  role: AuthRole;
}

export interface AuthSessionPayload {
  user: AuthUser;
  expiresAt: number;
}

export interface AuthStatusResponse {
  needsSetup: boolean;
  authRequired: boolean;
}

export interface CoachAccountSummary {
  id: string;
  username: string;
  role: "coach";
  createdAt: string;
  updatedAt: string;
}
