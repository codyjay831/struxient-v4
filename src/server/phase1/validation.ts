import { z } from "zod";
import {
  CustomerContactType,
  CustomerKind,
  CustomerStatus,
  OpportunityPriority,
  OpportunityStatus,
  OpportunityTaskKind,
  OpportunityTaskStatus,
} from "@prisma/client";

const nonEmpty = z.string().trim().min(1, "Required");

export const createCustomerSchema = z.object({
  displayName: nonEmpty.max(200),
  kind: z.nativeEnum(CustomerKind).optional(),
  notes: z.string().trim().max(10_000).optional().nullable(),
});

export const updateCustomerSchema = z.object({
  customerId: nonEmpty,
  displayName: nonEmpty.max(200),
  kind: z.nativeEnum(CustomerKind),
  status: z.nativeEnum(CustomerStatus),
  notes: z.string().trim().max(10_000).optional().nullable(),
});

export function contactValueSchema(type: CustomerContactType) {
  if (type === CustomerContactType.EMAIL) {
    return z.string().trim().email("Enter a valid email address").max(320);
  }
  return z.string().trim().min(3, "Enter a valid value").max(200);
}

export const addCustomerContactSchema = z.object({
  customerId: nonEmpty,
  type: z.nativeEnum(CustomerContactType),
  value: z.string().trim().min(1),
  isPrimary: z.coerce.boolean().optional(),
  okToEmail: z.coerce.boolean().optional(),
  okToSms: z.coerce.boolean().optional(),
  label: z.string().trim().max(120).optional().nullable(),
});

export function parseContactValue(type: CustomerContactType, raw: string) {
  return contactValueSchema(type).safeParse(raw);
}

export const updateCustomerContactSchema = z.object({
  contactId: nonEmpty,
  customerId: nonEmpty,
  type: z.nativeEnum(CustomerContactType),
  value: z.string().trim().min(1),
  isPrimary: z.coerce.boolean().optional(),
  okToEmail: z.coerce.boolean().optional(),
  okToSms: z.coerce.boolean().optional(),
  label: z.string().trim().max(120).optional().nullable(),
  archived: z.coerce.boolean().optional(),
});

const opportunityFields = z.object({
  customerId: nonEmpty,
  title: nonEmpty.max(300),
  serviceType: nonEmpty.max(200),
  source: nonEmpty.max(200),
  priority: z.nativeEnum(OpportunityPriority),
  serviceAddressText: z.string().trim().max(2000).optional().nullable(),
  serviceAddressTbd: z.coerce.boolean(),
  contactIntakeWaived: z.coerce.boolean(),
  scopeIntent: z.string().trim().min(1, "Describe what the customer is asking for").max(10_000),
  desiredTimeline: z.string().trim().max(2000).optional().nullable(),
  salesOwnerUserId: z.string().trim().optional().nullable(),
  qualificationStatus: z.string().trim().max(200).optional().nullable(),
  estimatedValue: z.string().trim().optional().nullable(),
  followUpAt: z.string().trim().optional().nullable(),
});

function refineServiceAddress(data: { serviceAddressTbd: boolean; serviceAddressText?: string | null }, ctx: z.RefinementCtx) {
  if (!data.serviceAddressTbd) {
    const t = data.serviceAddressText?.trim() ?? "";
    if (t.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a service address or mark location as not yet determined.",
        path: ["serviceAddressText"],
      });
    }
  }
}

export const createOpportunitySchema = opportunityFields.superRefine(refineServiceAddress);

const nonTerminalStatuses: OpportunityStatus[] = [
  OpportunityStatus.NEW,
  OpportunityStatus.QUALIFIED,
  OpportunityStatus.INFO_GATHERING,
  OpportunityStatus.SITE_VISIT_NEEDED,
  OpportunityStatus.QUOTE_DRAFT_READY,
  OpportunityStatus.QUOTE_DRAFT_CREATED,
];

export const updateOpportunitySchema = opportunityFields
  .extend({
    opportunityId: nonEmpty,
    status: z.nativeEnum(OpportunityStatus),
  })
  .superRefine(refineServiceAddress)
  .superRefine((data, ctx) => {
    if (!nonTerminalStatuses.includes(data.status)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use the Mark lost or Mark no quote actions for closed outcomes.",
        path: ["status"],
      });
    }
  });

export const addOpportunityTaskSchema = z.object({
  opportunityId: nonEmpty,
  title: nonEmpty.max(500),
  kind: z.nativeEnum(OpportunityTaskKind),
  isRequired: z.coerce.boolean().optional(),
  dueAt: z.string().trim().optional().nullable(),
  assigneeUserId: z.string().trim().optional().nullable(),
});

export const updateOpportunityTaskStatusSchema = z.object({
  taskId: nonEmpty,
  opportunityId: nonEmpty,
  status: z.nativeEnum(OpportunityTaskStatus),
  outcome: z.string().trim().max(2000).optional().nullable(),
});

export const markTerminalSchema = z.object({
  opportunityId: nonEmpty,
  reason: z.string().trim().min(3, "Provide a short reason").max(2000),
});
