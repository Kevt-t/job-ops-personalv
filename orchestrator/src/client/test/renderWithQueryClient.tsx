import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render, renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import {
  AuthContext,
  type AuthContextValue,
} from "../hooks/auth-context";

type TestRenderOptions = Omit<RenderOptions, "wrapper"> & {
  auth?: Partial<AuthContextValue>;
};

const defaultAuthContext: AuthContextValue = {
  user: { id: "test-user-id", username: "owner", role: "user" },
  role: "user",
  isAuthenticated: true,
  isLoading: false,
  needsSetup: false,
  authRequired: true,
  login: async () => ({
    user: { id: "test-user-id", username: "owner", role: "user" },
    expiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
  }),
  register: async () => ({
    user: { id: "test-user-id", username: "owner", role: "user" },
    expiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
  }),
  logout: async () => {},
};

function createAuthContextValue(
  overrides?: Partial<AuthContextValue>,
): AuthContextValue {
  const user = overrides?.user === undefined ? defaultAuthContext.user : overrides.user;
  const role = overrides?.role ?? user?.role ?? null;
  return {
    ...defaultAuthContext,
    ...overrides,
    user,
    role,
    isAuthenticated:
      overrides?.isAuthenticated ??
      (!overrides?.authRequired || user !== null),
  };
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function renderWithQueryClient(
  ui: ReactElement,
  options?: TestRenderOptions,
) {
  const queryClient = createTestQueryClient();
  const authValue = createAuthContextValue(options?.auth);

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );

  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...options }),
  };
}

export function renderHookWithQueryClient<TResult>(
  callback: () => TResult,
  options?: { auth?: Partial<AuthContextValue> },
) {
  const queryClient = createTestQueryClient();
  const authValue = createAuthContextValue(options?.auth);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
  const rendered = renderHook(callback, { wrapper: Wrapper });
  return {
    queryClient,
    ...rendered,
  };
}
