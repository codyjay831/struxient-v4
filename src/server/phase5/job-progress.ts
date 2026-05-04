import { JobTaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type JobProgressSnapshot = {
  totalTasks: number;
  requiredTotal: number;
  requiredComplete: number;
  byStatus: Record<JobTaskStatus, number>;
};

type TaskProgressRow = { status: JobTaskStatus; isRequired: boolean };

function emptyByStatus(): Record<JobTaskStatus, number> {
  return {
    [JobTaskStatus.NOT_STARTED]: 0,
    [JobTaskStatus.READY]: 0,
    [JobTaskStatus.IN_PROGRESS]: 0,
    [JobTaskStatus.COMPLETE]: 0,
    [JobTaskStatus.BLOCKED]: 0,
  };
}

export function emptyJobProgress(): JobProgressSnapshot {
  return {
    totalTasks: 0,
    requiredTotal: 0,
    requiredComplete: 0,
    byStatus: emptyByStatus(),
  };
}

export function reduceTasksToProgress(tasks: TaskProgressRow[]): JobProgressSnapshot {
  const byStatus = emptyByStatus();
  let requiredTotal = 0;
  let requiredComplete = 0;
  for (const t of tasks) {
    byStatus[t.status] += 1;
    if (t.isRequired) {
      requiredTotal += 1;
      if (t.status === JobTaskStatus.COMPLETE) {
        requiredComplete += 1;
      }
    }
  }
  return {
    totalTasks: tasks.length,
    requiredTotal,
    requiredComplete,
    byStatus,
  };
}

export async function getJobProgressForJob(organizationId: string, jobId: string): Promise<JobProgressSnapshot> {
  const tasks = await prisma.jobTask.findMany({
    where: { organizationId, jobId, archivedAt: null },
    select: { status: true, isRequired: true },
  });
  return reduceTasksToProgress(tasks);
}

export async function getJobProgressMapForJobs(
  organizationId: string,
  jobIds: string[],
): Promise<Map<string, JobProgressSnapshot>> {
  const map = new Map<string, JobProgressSnapshot>();
  for (const id of jobIds) {
    map.set(id, emptyJobProgress());
  }
  if (jobIds.length === 0) {
    return map;
  }

  const rows = await prisma.jobTask.findMany({
    where: { organizationId, jobId: { in: jobIds }, archivedAt: null },
    select: { jobId: true, status: true, isRequired: true },
  });

  const byJob = new Map<string, TaskProgressRow[]>();
  for (const r of rows) {
    const list = byJob.get(r.jobId) ?? [];
    list.push({ status: r.status, isRequired: r.isRequired });
    byJob.set(r.jobId, list);
  }

  for (const [jid, taskList] of byJob) {
    map.set(jid, reduceTasksToProgress(taskList));
  }
  return map;
}
