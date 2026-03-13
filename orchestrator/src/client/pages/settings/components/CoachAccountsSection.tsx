import * as api from "@client/api";
import { queryKeys } from "@client/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const CoachAccountsSection: React.FC<{ isDisabled: boolean }> = ({
  isDisabled,
}) => {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const coachesQuery = useQuery({
    queryKey: queryKeys.auth.coaches(),
    queryFn: api.authListCoaches,
  });

  const createCoachMutation = useMutation({
    mutationFn: api.authCreateCoach,
    onSuccess: async () => {
      setUsername("");
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.coaches() });
      toast.success("Coach account created");
    },
  });

  const deleteCoachMutation = useMutation({
    mutationFn: api.authDeleteCoach,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.coaches() });
      toast.success("Coach account deleted");
    },
  });

  const handleCreate = async () => {
    try {
      await createCoachMutation.mutateAsync({ username, password });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create coach account",
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this coach account?")) return;
    try {
      await deleteCoachMutation.mutateAsync(id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete coach account",
      );
    }
  };

  const isBusy =
    isDisabled || createCoachMutation.isPending || deleteCoachMutation.isPending;
  const coaches = coachesQuery.data?.coaches ?? [];

  return (
    <AccordionItem value="coach-accounts" className="border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline py-4">
        <span className="text-base font-semibold">Coach Accounts</span>
      </AccordionTrigger>
      <AccordionContent className="space-y-6 pb-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="coach-username">Username</Label>
            <Input
              id="coach-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={isBusy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="coach-password">Password</Label>
            <Input
              id="coach-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isBusy}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => void handleCreate()}
            disabled={isBusy || username.trim() === "" || password === ""}
          >
            {createCoachMutation.isPending ? "Creating..." : "Create coach"}
          </Button>
        </div>

        <div className="space-y-3">
          {coachesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading coach accounts...</p>
          ) : coaches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No coach accounts yet.</p>
          ) : (
            coaches.map((coach) => (
              <div
                key={coach.id}
                className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium">{coach.username}</div>
                  <div className="text-xs text-muted-foreground">
                    Created {new Date(coach.createdAt).toLocaleString()}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleDelete(coach.id)}
                  disabled={isBusy}
                >
                  Delete
                </Button>
              </div>
            ))
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
