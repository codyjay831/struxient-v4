/** Type-only barrel for job server actions — not a `"use server"` file (Next forbids non-async exports there). */
export type { JobTaskActionResult } from "@/server/phase4/job-mutations";
export type { WorkPlanMutationResult } from "@/server/phase4/job-work-plan-mutations";
export type { JobLifecycleActionResult } from "@/server/phase5/job-status-mutations";
export type { ScheduledWorkActionResult } from "@/server/phase7/scheduled-work-mutations";
export type { CompletionRequirementMutationResult } from "@/server/phase13/completion-requirement-mutations";
