import type { Prisma } from "@prisma/client";

export const ActivityEventType = {
  CUSTOMER_CREATED: "CUSTOMER_CREATED",
  CUSTOMER_UPDATED: "CUSTOMER_UPDATED",
  CUSTOMER_CONTACT_ADDED: "CUSTOMER_CONTACT_ADDED",
  CUSTOMER_CONTACT_UPDATED: "CUSTOMER_CONTACT_UPDATED",
  OPPORTUNITY_CREATED: "OPPORTUNITY_CREATED",
  OPPORTUNITY_UPDATED: "OPPORTUNITY_UPDATED",
  OPPORTUNITY_TASK_ADDED: "OPPORTUNITY_TASK_ADDED",
  OPPORTUNITY_TASK_UPDATED: "OPPORTUNITY_TASK_UPDATED",
  OPPORTUNITY_TASK_COMPLETED: "OPPORTUNITY_TASK_COMPLETED",
  OPPORTUNITY_MARKED_LOST: "OPPORTUNITY_MARKED_LOST",
  OPPORTUNITY_MARKED_NO_QUOTE: "OPPORTUNITY_MARKED_NO_QUOTE",
  CONTACT_INTAKE_WAIVED: "CONTACT_INTAKE_WAIVED",
  CONTACT_INTAKE_WAIVER_REMOVED: "CONTACT_INTAKE_WAIVER_REMOVED",
  QUOTE_DRAFT_CREATED_FROM_OPPORTUNITY: "QUOTE_DRAFT_CREATED_FROM_OPPORTUNITY",
} as const;

export type ActivityEventTypeName = (typeof ActivityEventType)[keyof typeof ActivityEventType];

export type RecordActivityInput = {
  organizationId: string;
  /** When set, ties the event to an opportunity timeline. */
  opportunityId?: string | null;
  /** When set (with or without opportunity), ties the event to a customer timeline. */
  customerId?: string | null;
  eventType: ActivityEventTypeName;
  actorUserId: string | null;
  summary: string;
  payload?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
};
