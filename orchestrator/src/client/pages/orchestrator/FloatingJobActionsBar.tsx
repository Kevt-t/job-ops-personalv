import { AnimatePresence, motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import type React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface FloatingJobActionsBarProps {
  selectedCount: number;
  canMutate: boolean;
  canMoveSelected: boolean;
  canSkipSelected: boolean;
  canRescoreSelected: boolean;
  canDeleteSelected: boolean;
  jobActionInFlight: boolean;
  onMoveToReady: () => void;
  onSkipSelected: () => void;
  onRescoreSelected: () => void;
  onDeleteSelected: () => void;
  onClear: () => void;
}

export const FloatingJobActionsBar: React.FC<FloatingJobActionsBarProps> = ({
  selectedCount,
  canMutate,
  canMoveSelected,
  canSkipSelected,
  canRescoreSelected,
  canDeleteSelected,
  jobActionInFlight,
  onMoveToReady,
  onSkipSelected,
  onRescoreSelected,
  onDeleteSelected,
  onClear,
}) => {
  return (
    <AnimatePresence initial={false}>
      {selectedCount > 0 ? (
        <motion.div
          className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-3 sm:px-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <div className="pointer-events-auto flex w-full max-w-md flex-col items-stretch gap-2 rounded-xl border border-border/70 bg-card/95 px-3 py-2 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:w-auto sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center">
            <div className="text-xs text-muted-foreground tabular-nums sm:mr-1">
              {selectedCount} selected
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              {canMutate && canMoveSelected && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={jobActionInFlight}
                  onClick={onMoveToReady}
                >
                  Move to Ready
                </Button>
              )}
              {canMutate && canSkipSelected && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={jobActionInFlight}
                  onClick={onSkipSelected}
                >
                  Skip selected
                </Button>
              )}
              {canMutate && canRescoreSelected && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={jobActionInFlight}
                  onClick={onRescoreSelected}
                >
                  Recalculate match
                </Button>
              )}
              {canMutate && canDeleteSelected && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="w-full sm:w-auto"
                      disabled={jobActionInFlight}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete selected
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete selected jobs?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently deletes {selectedCount} selected job
                        {selectedCount === 1 ? "" : "s"}. Ready, applied, and
                        in-progress jobs cannot be deleted from this bulk action.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={onDeleteSelected}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={onClear}
                disabled={jobActionInFlight}
              >
                Clear
              </Button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
