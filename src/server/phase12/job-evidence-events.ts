import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { JobActivityEventType } from "@/server/phase5/job-activity-types";
import { recordJobActivity } from "@/server/phase5/record-job-activity";

export async function recordJobEvidencePromoted(params: {
  organizationId: string;
  jobId: string;
  actorUserId: string | null;
  evidenceId: string;
  title: string;
  jobTaskId: string | null;
  sourceAttachmentId: string | null;
}) {
  const payloadJson: Prisma.InputJsonValue = {
    evidenceId: params.evidenceId,
    title: params.title,
    jobTaskId: params.jobTaskId,
    sourceAttachmentId: params.sourceAttachmentId,
    status: "CANDIDATE",
  };
  await recordJobActivity(prisma, {
    organizationId: params.organizationId,
    jobId: params.jobId,
    actorUserId: params.actorUserId,
    eventType: JobActivityEventType.JOB_EVIDENCE_PROMOTED,
    summary: "Evidence candidate created",
    payloadJson,
  });
}

export async function recordJobEvidenceAccepted(params: {
  organizationId: string;
  jobId: string;
  actorUserId: string | null;
  evidenceId: string;
  title: string;
  jobTaskId: string | null;
  sourceAttachmentId: string | null;
}) {
  const payloadJson: Prisma.InputJsonValue = {
    evidenceId: params.evidenceId,
    title: params.title,
    jobTaskId: params.jobTaskId,
    sourceAttachmentId: params.sourceAttachmentId,
    status: "ACCEPTED",
  };
  await recordJobActivity(prisma, {
    organizationId: params.organizationId,
    jobId: params.jobId,
    actorUserId: params.actorUserId,
    eventType: JobActivityEventType.JOB_EVIDENCE_ACCEPTED,
    summary: "Evidence accepted",
    payloadJson,
  });
}

export async function recordJobEvidenceRejected(params: {
  organizationId: string;
  jobId: string;
  actorUserId: string | null;
  evidenceId: string;
  title: string;
  jobTaskId: string | null;
  sourceAttachmentId: string | null;
  rejectionReason: string;
}) {
  const payloadJson: Prisma.InputJsonValue = {
    evidenceId: params.evidenceId,
    title: params.title,
    jobTaskId: params.jobTaskId,
    sourceAttachmentId: params.sourceAttachmentId,
    status: "REJECTED",
    rejectionReason: params.rejectionReason,
  };
  await recordJobActivity(prisma, {
    organizationId: params.organizationId,
    jobId: params.jobId,
    actorUserId: params.actorUserId,
    eventType: JobActivityEventType.JOB_EVIDENCE_REJECTED,
    summary: "Evidence rejected",
    payloadJson,
  });
}
