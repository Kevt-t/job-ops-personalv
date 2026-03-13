import type { AuthStatusResponse, AuthUser } from "@shared/types";
import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useContext, useEffect, useMemo, useState } from "react";
import * as api from "@client/api";
import { setUnauthorizedHandler } from "@/client/lib/auth";
import { AuthContext, type AuthContextValue } from "./auth-context";

type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
  needsSetup: boolean;
  authRequired: boolean;
};

const INITIAL_STATE: AuthState = {
  user: null,
  isLoading: true,
  needsSetup: false,
  authRequired: true,
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;

    const applyStatus = async (status: AuthStatusResponse) => {
      if (!status.authRequired) {
        if (!cancelled) {
          setState({
            user: null,
            needsSetup: false,
            authRequired: false,
            isLoading: false,
          });
        }
        return;
      }

      if (status.needsSetup) {
        if (!cancelled) {
          setState({
            user: null,
            needsSetup: true,
            authRequired: true,
            isLoading: false,
          });
        }
        return;
      }

      try {
        const { user } = await api.authGetMe();
        if (!cancelled) {
          setState({
            user,
            needsSetup: false,
            authRequired: true,
            isLoading: false,
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            user: null,
            needsSetup: false,
            authRequired: true,
            isLoading: false,
          });
        }
      }
    };

    void api
      .authGetStatus()
      .then(applyStatus)
      .catch(() => {
        if (!cancelled) {
          setState({
            user: null,
            needsSetup: false,
            authRequired: true,
            isLoading: false,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      queryClient.clear();
      setState((current) => ({
        ...current,
        user: null,
        needsSetup: false,
        isLoading: false,
      }));
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.user,
      role: state.user?.role ?? null,
      isAuthenticated: !state.authRequired || state.user !== null,
      isLoading: state.isLoading,
      needsSetup: state.needsSetup,
      authRequired: state.authRequired,
      login: async (input) => {
        const session = await api.authLogin(input);
        setState({
          user: session.user,
          needsSetup: false,
          authRequired: true,
          isLoading: false,
        });
        await queryClient.invalidateQueries();
        return session;
      },
      register: async (input) => {
        const session = await api.authRegister(input);
        setState({
          user: session.user,
          needsSetup: false,
          authRequired: true,
          isLoading: false,
        });
        await queryClient.invalidateQueries();
        return session;
      },
      logout: async () => {
        try {
          await api.authLogout();
        } finally {
          queryClient.clear();
          setState((current) => ({
            user: null,
            needsSetup: false,
            authRequired: current.authRequired,
            isLoading: false,
          }));
        }
      },
    }),
    [queryClient, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
