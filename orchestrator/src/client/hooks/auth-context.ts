import type { AuthSessionPayload, AuthUser } from "@shared/types";
import { createContext } from "react";

export type AuthContextValue = {
  user: AuthUser | null;
  role: AuthUser["role"] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  needsSetup: boolean;
  authRequired: boolean;
  login: (input: {
    username: string;
    password: string;
  }) => Promise<AuthSessionPayload>;
  register: (input: {
    username: string;
    password: string;
  }) => Promise<AuthSessionPayload>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
