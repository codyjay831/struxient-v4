import { z } from "zod";

import { quoteCustomerPreviewDTOSchema } from "@/server/phase2/customer-preview";

/** Frozen sent snapshot customer preview only — same whitelist as internal preview builder output. */
export const portalQuoteDTOSchema = quoteCustomerPreviewDTOSchema;

export type PortalQuoteDTO = z.infer<typeof portalQuoteDTOSchema>;

export const portalMilestoneItemDTOSchema = z.object({
  label: z.string(),
  stateLabel: z.string(),
  sortKey: z.number(),
});

export type PortalMilestoneItemDTO = z.infer<typeof portalMilestoneItemDTOSchema>;

export const portalProjectProgressDTOSchema = z.object({
  completed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export type PortalProjectProgressDTO = z.infer<typeof portalProjectProgressDTOSchema>;

export const portalProjectDTOSchema = z.object({
  jobDisplayNumber: z.number().int(),
  title: z.string(),
  statusLabel: z.string(),
  milestoneItems: z.array(portalMilestoneItemDTOSchema),
  progress: portalProjectProgressDTOSchema,
});

export type PortalProjectDTO = z.infer<typeof portalProjectDTOSchema>;

export const portalScheduleAcknowledgmentStatusSchema = z.enum(["not_acknowledged", "received"]);

export type PortalScheduleAcknowledgmentStatus = z.infer<typeof portalScheduleAcknowledgmentStatusSchema>;

export const portalScheduleItemDTOSchema = z.object({
  label: z.string(),
  scheduledStartAt: z.string(),
  scheduledEndAt: z.string(),
  statusLabel: z.string(),
  isCanceled: z.boolean(),
  /** HMAC-signed handle; only present when the customer may acknowledge this row from this portal link. */
  scheduleActionRef: z.string().optional(),
  canAcknowledge: z.boolean().optional(),
  acknowledgmentStatus: portalScheduleAcknowledgmentStatusSchema.optional(),
});

export type PortalScheduleItemDTO = z.infer<typeof portalScheduleItemDTOSchema>;

export const portalContextDTOSchema = z.object({
  organizationDisplayName: z.string(),
  customerDisplayName: z.string(),
  projectTitle: z.string(),
  serviceAddressSummary: z.string().optional(),
  contactLines: z.array(z.string()),
});

export type PortalContextDTO = z.infer<typeof portalContextDTOSchema>;

export const portalViewDTOSchema = z.object({
  context: portalContextDTOSchema,
  quote: portalQuoteDTOSchema.optional(),
  project: portalProjectDTOSchema.optional(),
  schedule: z.array(portalScheduleItemDTOSchema),
  whatHappensNext: z.string(),
});

export type PortalViewDTO = z.infer<typeof portalViewDTOSchema>;
