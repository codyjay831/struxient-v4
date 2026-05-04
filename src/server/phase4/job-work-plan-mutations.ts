import { JobStatus, JobTaskStatus, Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { canEditJobWorkPlanDuringReview } from "@/lib/phase4-permissions";
import { zodActionFailure } from "@/server/phase2/quote-mutations";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import { JobActivityEventType } from "@/server/phase5/job-activity-types";
import { recordJobActivity } from "@/server/phase5/record-job-activity";
import { parseJobTaskCompletionRequirements } from "@/server/phase13/completion-requirements";

export type WorkPlanMutationResult =
  | { ok: true; jobId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const updateWorkPlanTaskSchema = z.object({
  jobId: z.string().min(1),
  taskId: z.string().min(1),
  title: z.string().trim().min(1).max(240),
  description: z.string().max(20000).nullable(),
  internalNotes: z.string().max(20000).nullable(),
  isRequired: z.boolean(),
  assignedRole: z.string().trim().max(120).nullable(),
  customerVisible: z.boolean(),
  customerLabel: z.string().trim().max(240).nullable(),
});

const addWorkPlanTaskSchema = z.object({
  jobId: z.string().min(1),
  stageId: z.string().min(1),
  title: z.string().trim().min(1).max(240),
  description: z.string().max(20000).nullable(),
  isRequired: z.boolean().optional().default(false),
  assignedRole: z.string().trim().max(120).nullable(),
});

const archiveWorkPlanTaskSchema = z.object({
  jobId: z.string().min(1),
  taskId: z.string().min(1),
});

const reorderWorkPlanTasksSchema = z.object({
  jobId: z.string().min(1),
  stageId: z.string().min(1),
  orderedTaskIds: z.array(z.string().min(1)).min(1),
});

const updateWorkPlanStageSchema = z.object({
  jobId: z.string().min(1),
  stageId: z.string().min(1),
  title: z.string().trim().min(1).max(240),
  internalNotes: z.string().max(20000).optional().nullable(),
});

function parseBool(formData: FormData, key: string, defaultValue: boolean): boolean {
  const raw = formData.get(key);
  if (raw === null || raw === undefined) return defaultValue;
  return raw === "true" || raw === "on" || raw === "1";
}

function readOptionalString(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (raw === null || typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length ? t : null;
}

function readOptionalMultiline(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (raw === null || typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length ? t : null;
}

export async function jobMutationUpdateWorkPlanTask(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<WorkPlanMutationResult> {
  if (!canEditJobWorkPlanDuringReview(ctx.role)) {
    return { ok: false, error: "You do not have permission to edit the work plan." };
  }

  const customerLabelRaw = readOptionalString(formData, "customerLabel");
  const customerVisible = parseBool(formData, "customerVisible", false);
  const parsed = updateWorkPlanTaskSchema.safeParse({
    jobId: formData.get("jobId"),
    taskId: formData.get("taskId"),
    title: formData.get("title"),
    description: readOptionalMultiline(formData, "description"),
    internalNotes: readOptionalMultiline(formData, "internalNotes"),
    isRequired: parseBool(formData, "isRequired", false),
    assignedRole: readOptionalString(formData, "assignedRole"),
    customerVisible,
    customerLabel: customerVisible ? customerLabelRaw : null,
  });

  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const task = await prisma.jobTask.findFirst({
    where: {
      id: parsed.data.taskId,
      jobId: parsed.data.jobId,
      organizationId: ctx.organizationId,
      archivedAt: null,
    },
    include: { job: { select: { status: true } } },
  });

  if (!task) {
    return { ok: false, error: "Task not found." };
  }
  if (task.job.status !== JobStatus.WORK_PLAN_REVIEW) {
    return { ok: false, error: "Work plan edits are only allowed while the job is in work plan review." };
  }

  const prev = {
    title: task.title,
    description: task.description,
    internalNotes: task.internalNotes,
    isRequired: task.isRequired,
    assignedRole: task.assignedRole,
    customerVisible: task.customerVisible,
    customerLabel: task.customerLabel,
  };

  await prisma.$transaction(async (tx) => {
    await tx.jobTask.update({
      where: { id: task.id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        internalNotes: parsed.data.internalNotes ?? null,
        isRequired: parsed.data.isRequired,
        assignedRole: parsed.data.assignedRole ?? null,
        customerVisible: parsed.data.customerVisible,
        customerLabel: parsed.data.customerLabel ?? null,
      },
    });

    await recordJobActivity(tx, {
      organizationId: ctx.organizationId,
      jobId: parsed.data.jobId,
      actorUserId: ctx.userId,
      eventType: JobActivityEventType.WORK_PLAN_TASK_UPDATED,
      summary: `Work plan task updated: "${parsed.data.title}"`,
      payloadJson: {
        taskId: task.id,
        previous: prev,
        next: {
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          internalNotes: parsed.data.internalNotes ?? null,
          isRequired: parsed.data.isRequired,
          assignedRole: parsed.data.assignedRole ?? null,
          customerVisible: parsed.data.customerVisible,
          customerLabel: parsed.data.customerLabel ?? null,
        },
      },
    });
  });

  return { ok: true, jobId: parsed.data.jobId };
}

export async function jobMutationAddWorkPlanTask(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<WorkPlanMutationResult> {
  if (!canEditJobWorkPlanDuringReview(ctx.role)) {
    return { ok: false, error: "You do not have permission to edit the work plan." };
  }

  const parsed = addWorkPlanTaskSchema.safeParse({
    jobId: formData.get("jobId"),
    stageId: formData.get("stageId"),
    title: formData.get("title"),
    description: readOptionalMultiline(formData, "description"),
    isRequired: parseBool(formData, "isRequired", false),
    assignedRole: readOptionalString(formData, "assignedRole"),
  });

  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const stage = await prisma.jobStage.findFirst({
    where: {
      id: parsed.data.stageId,
      jobId: parsed.data.jobId,
      organizationId: ctx.organizationId,
    },
    include: {
      job: { select: { status: true } },
      tasks: { where: { archivedAt: null }, select: { sortOrder: true } },
    },
  });

  if (!stage) {
    return { ok: false, error: "Stage not found." };
  }
  if (stage.job.status !== JobStatus.WORK_PLAN_REVIEW) {
    return { ok: false, error: "Work plan edits are only allowed while the job is in work plan review." };
  }

  const maxSort =
    stage.tasks.length === 0 ? -1 : Math.max(...stage.tasks.map((t) => t.sortOrder));
  const nextSort = maxSort + 1;

  let completionJson: Prisma.InputJsonValue | typeof Prisma.JsonNull = Prisma.JsonNull;
  const rawReq = formData.get("completionRequirementsJson");
  if (typeof rawReq === "string" && rawReq.trim()) {
    try {
      const parsedJson = JSON.parse(rawReq) as unknown;
      const pr = parseJobTaskCompletionRequirements(parsedJson);
      if (pr.kind === "invalid") {
        return { ok: false, error: "Invalid completion requirements JSON." };
      }
      if (pr.kind === "valid") {
        completionJson = pr.v1 as unknown as Prisma.InputJsonValue;
      }
    } catch {
      return { ok: false, error: "Invalid completion requirements JSON." };
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.jobTask.create({
      data: {
        organizationId: ctx.organizationId,
        jobId: parsed.data.jobId,
        jobLineId: stage.jobLineId,
        jobStageId: stage.id,
        sourceQuoteTaskId: null,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        status: JobTaskStatus.NOT_STARTED,
        isRequired: parsed.data.isRequired,
        sortOrder: nextSort,
        assignedRole: parsed.data.assignedRole ?? null,
        completionRequirementsJson: completionJson === Prisma.JsonNull ? Prisma.JsonNull : completionJson,
      },
    });

    await recordJobActivity(tx, {
      organizationId: ctx.organizationId,
      jobId: parsed.data.jobId,
      actorUserId: ctx.userId,
      eventType: JobActivityEventType.WORK_PLAN_TASK_ADDED,
      summary: `Work plan task added: "${parsed.data.title}"`,
      payloadJson: { taskId: row.id, stageId: stage.id, sortOrder: nextSort },
    });

    return row;
  });

  return { ok: true, jobId: created.jobId };
}

export async function jobMutationArchiveWorkPlanTask(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<WorkPlanMutationResult> {
  if (!canEditJobWorkPlanDuringReview(ctx.role)) {
    return { ok: false, error: "You do not have permission to edit the work plan." };
  }

  const parsed = archiveWorkPlanTaskSchema.safeParse({
    jobId: formData.get("jobId"),
    taskId: formData.get("taskId"),
  });

  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const task = await prisma.jobTask.findFirst({
    where: {
      id: parsed.data.taskId,
      jobId: parsed.data.jobId,
      organizationId: ctx.organizationId,
      archivedAt: null,
    },
    include: { job: { select: { status: true } } },
  });

  if (!task) {
    return { ok: false, error: "Task not found." };
  }
  if (task.job.status !== JobStatus.WORK_PLAN_REVIEW) {
    return { ok: false, error: "Work plan edits are only allowed while the job is in work plan review." };
  }

  const activeCount = await prisma.jobTask.count({
    where: { jobId: parsed.data.jobId, organizationId: ctx.organizationId, archivedAt: null },
  });
  if (activeCount <= 1) {
    return { ok: false, error: "Cannot archive the last remaining task. Add another task first, or keep at least one." };
  }

  const [swCount, evCount] = await Promise.all([
    prisma.scheduledWork.count({
      where: { organizationId: ctx.organizationId, jobTaskId: task.id },
    }),
    prisma.jobEvidence.count({
      where: { organizationId: ctx.organizationId, jobTaskId: task.id },
    }),
  ]);
  if (swCount > 0 || evCount > 0) {
    return {
      ok: false,
      error: "Cannot archive a task that has scheduled work or linked job evidence. Remove those first.",
    };
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.jobTask.update({
      where: { id: task.id },
      data: { archivedAt: now },
    });

    await recordJobActivity(tx, {
      organizationId: ctx.organizationId,
      jobId: parsed.data.jobId,
      actorUserId: ctx.userId,
      eventType: JobActivityEventType.WORK_PLAN_TASK_ARCHIVED,
      summary: `Work plan task archived: "${task.title}"`,
      payloadJson: { taskId: task.id },
    });
  });

  return { ok: true, jobId: parsed.data.jobId };
}

export async function jobMutationReorderWorkPlanTasks(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<WorkPlanMutationResult> {
  if (!canEditJobWorkPlanDuringReview(ctx.role)) {
    return { ok: false, error: "You do not have permission to edit the work plan." };
  }

  const rawOrder = formData.get("orderedTaskIds");
  let ids: string[] = [];
  if (typeof rawOrder === "string") {
    try {
      const j = JSON.parse(rawOrder) as unknown;
      if (Array.isArray(j) && j.every((x) => typeof x === "string")) {
        ids = j as string[];
      }
    } catch {
      /* fall through */
    }
  }

  const parsed = reorderWorkPlanTasksSchema.safeParse({
    jobId: formData.get("jobId"),
    stageId: formData.get("stageId"),
    orderedTaskIds: ids,
  });

  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const stage = await prisma.jobStage.findFirst({
    where: {
      id: parsed.data.stageId,
      jobId: parsed.data.jobId,
      organizationId: ctx.organizationId,
    },
    include: {
      job: { select: { status: true } },
      tasks: { where: { archivedAt: null }, select: { id: true } },
    },
  });

  if (!stage) {
    return { ok: false, error: "Stage not found." };
  }
  if (stage.job.status !== JobStatus.WORK_PLAN_REVIEW) {
    return { ok: false, error: "Work plan edits are only allowed while the job is in work plan review." };
  }

  const existingIds = new Set(stage.tasks.map((t) => t.id));
  const ordered = parsed.data.orderedTaskIds;
  if (existingIds.size !== ordered.length) {
    return { ok: false, error: "Task list does not match this stage." };
  }
  for (const id of ordered) {
    if (!existingIds.has(id)) {
      return { ok: false, error: "Task list does not match this stage." };
    }
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < ordered.length; i += 1) {
      await tx.jobTask.update({
        where: { id: ordered[i] },
        data: { sortOrder: i },
      });
    }

    await recordJobActivity(tx, {
      organizationId: ctx.organizationId,
      jobId: parsed.data.jobId,
      actorUserId: ctx.userId,
      eventType: JobActivityEventType.WORK_PLAN_TASKS_REORDERED,
      summary: "Work plan tasks reordered",
      payloadJson: { stageId: stage.id, orderedTaskIds: ordered },
    });
  });

  return { ok: true, jobId: parsed.data.jobId };
}

export async function jobMutationUpdateWorkPlanStage(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<WorkPlanMutationResult> {
  if (!canEditJobWorkPlanDuringReview(ctx.role)) {
    return { ok: false, error: "You do not have permission to edit the work plan." };
  }

  const parsed = updateWorkPlanStageSchema.safeParse({
    jobId: formData.get("jobId"),
    stageId: formData.get("stageId"),
    title: formData.get("title"),
    internalNotes: formData.get("internalNotes") === "" ? null : formData.get("internalNotes"),
  });

  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const stage = await prisma.jobStage.findFirst({
    where: {
      id: parsed.data.stageId,
      jobId: parsed.data.jobId,
      organizationId: ctx.organizationId,
    },
    include: { job: { select: { status: true } } },
  });

  if (!stage) {
    return { ok: false, error: "Stage not found." };
  }
  if (stage.job.status !== JobStatus.WORK_PLAN_REVIEW) {
    return { ok: false, error: "Work plan edits are only allowed while the job is in work plan review." };
  }

  const prevTitle = stage.title;
  const prevNotes = stage.internalNotes;

  await prisma.$transaction(async (tx) => {
    await tx.jobStage.update({
      where: { id: stage.id },
      data: {
        title: parsed.data.title,
        internalNotes: parsed.data.internalNotes ?? null,
      },
    });

    await recordJobActivity(tx, {
      organizationId: ctx.organizationId,
      jobId: parsed.data.jobId,
      actorUserId: ctx.userId,
      eventType: JobActivityEventType.WORK_PLAN_STAGE_UPDATED,
      summary: `Work plan stage updated: "${parsed.data.title}"`,
      payloadJson: {
        stageId: stage.id,
        previous: { title: prevTitle, internalNotes: prevNotes },
        next: { title: parsed.data.title, internalNotes: parsed.data.internalNotes ?? null },
      },
    });
  });

  return { ok: true, jobId: parsed.data.jobId };
}
