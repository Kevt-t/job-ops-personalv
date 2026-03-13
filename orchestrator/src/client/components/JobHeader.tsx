import type { Job } from "@shared/types.js";
import {
  ArrowUpRight,
  Calendar,
  DollarSign,
  MapPin,
} from "lucide-react";
import type React from "react";
import { Link, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate, sourceLabel } from "@/lib/utils";
import {
  getJobStatusIndicator,
  StatusIndicator,
} from "./StatusIndicator";

interface JobHeaderProps {
  job: Job;
  className?: string;
}

const ScoreMeter: React.FC<{ score: number | null }> = ({ score }) => {
  if (score == null) {
    return <span className="text-[10px] text-muted-foreground/60">-</span>;
  }

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
      <div className="h-1 w-12 rounded-full bg-muted/30">
        <div
          className="h-1 rounded-full bg-primary/50"
          style={{ width: `${Math.max(4, Math.min(100, score))}%` }}
        />
      </div>
      <span className="tabular-nums">{score}</span>
    </div>
  );
};

export const JobHeader: React.FC<JobHeaderProps> = ({
  job,
  className,
}) => {
  const jobStatus = getJobStatusIndicator(job.status);
  const { pathname } = useLocation();
  const isJobPage = pathname.startsWith("/job/");
  const deadline = formatDate(job.deadline);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Detail header: lighter weight than list items */}
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 w-full sm:w-auto sm:flex-1">
          <Link
            to={`/job/${job.id}`}
            className="block text-base font-semibold leading-snug text-foreground/90 underline-offset-2 break-words hover:underline"
          >
            {job.title}
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{job.employer}</span>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-wide text-muted-foreground border-border/50"
          >
            {sourceLabel[job.source]}
          </Badge>
          {job.isRemote === true && (
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-wide text-muted-foreground border-border/50"
            >
              Remote
            </Badge>
          )}
          {!isJobPage && (
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] uppercase tracking-wide"
            >
              <Link to={`/job/${job.id}`}>
                View
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Tertiary metadata - subdued */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/70">
        {job.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {job.location}
          </span>
        )}
        {deadline && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {deadline}
          </span>
        )}
        {job.salary && (
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            {job.salary}
          </span>
        )}
      </div>

      {/* Status and score: single line, subdued */}
      <div className="flex items-center justify-between gap-2 py-1 border-y border-border/30">
        <div className="flex items-center gap-4">
          <StatusIndicator
            dotColor={jobStatus.dotColor}
            label={jobStatus.label}
          />
        </div>
        <ScoreMeter score={job.suitabilityScore} />
      </div>
    </div>
  );
};
