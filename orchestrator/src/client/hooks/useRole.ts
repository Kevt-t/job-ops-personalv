import { useAuth } from "./useAuth";

export function useRole() {
  const { role } = useAuth();

  return {
    role,
    isCoach: role === "coach",
    canMutate: role === "user",
  };
}
