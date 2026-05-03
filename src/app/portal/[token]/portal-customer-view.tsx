import type { PortalViewDTO } from "@/server/phase8/portal-dtos";
import { PortalAppointmentAckForm } from "@/components/customer-portal/portal-appointment-ack-form";
import { PortalFileUploadForm } from "@/components/customer-portal/portal-file-upload-form";
import { PortalSendNoteForm } from "@/components/customer-portal/portal-send-note-form";
import { formatScheduleWindowDisplay } from "@/lib/format-schedule-window";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function fmtMoney(cents: number | null | undefined) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function PortalCustomerView({ view, rawToken }: { view: PortalViewDTO; rawToken: string }) {
  const { context, quote, project, schedule, whatHappensNext } = view;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/30">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer portal</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">{context.organizationDisplayName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{context.projectTitle}</p>
          <p className="mt-2 text-sm text-muted-foreground">{context.customerDisplayName}</p>
          {context.serviceAddressSummary ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{context.serviceAddressSummary}</p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-6 py-10">
        <Card className="rounded-sm border-border bg-card/40 shadow-none">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold">What happens next</CardTitle>
            <CardDescription className="text-sm leading-relaxed text-muted-foreground">{whatHappensNext}</CardDescription>
          </CardHeader>
        </Card>

        {quote ? (
          <Card className="rounded-sm border-border bg-card/40 shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Proposal</CardTitle>
              <CardDescription className="text-sm">
                {quote.statusLabel} · #{quote.displayNumber}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {quote.customerFacingIntro ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{quote.customerFacingIntro}</p>
              ) : null}
              <div className="space-y-4">
                {quote.lineItems.map((line, i) => (
                  <div key={i} className="rounded-sm border border-border/60 bg-background/50 p-4">
                    <p className="text-sm font-medium text-foreground">{line.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{line.customerDescription}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {line.pricingPresentation} · Qty {line.quantityDisplay}
                    </p>
                    {line.customerVisibleAssumptions.length > 0 ? (
                      <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                        {line.customerVisibleAssumptions.map((a, j) => (
                          <li key={j}>{a}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
              {quote.customerVisibleQuoteAssumptions.length > 0 ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assumptions</p>
                  <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                    {quote.customerVisibleQuoteAssumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Separator />
              <div className="flex flex-wrap justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium tabular-nums">{fmtMoney(quote.subtotalCents)}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold tabular-nums">{fmtMoney(quote.totalCents)}</span>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {project ? (
          <Card className="rounded-sm border-border bg-card/40 shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Project status</CardTitle>
              <CardDescription className="text-sm">
                Job #{project.jobDisplayNumber} · {project.statusLabel}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.progress.total > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Customer-visible milestones:{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {project.progress.completed}/{project.progress.total}
                  </span>{" "}
                  complete
                </p>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  We will update this page as work progresses.
                </p>
              )}
              {project.milestoneItems.length > 0 ? (
                <ul className="space-y-3">
                  {project.milestoneItems.map((m, i) => (
                    <li
                      key={i}
                      className="flex flex-col gap-0.5 rounded-sm border border-border/60 bg-background/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="text-sm font-medium text-foreground">{m.label}</span>
                      <span className="text-xs text-muted-foreground">{m.stateLabel}</span>
                    </li>
                  ))}
                </ul>
              ) : project.progress.total === 0 ? null : (
                <p className="text-sm text-muted-foreground">
                  Detailed milestones will appear here when your team labels customer-visible steps.
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card className="rounded-sm border-border bg-card/40 shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Upcoming schedule</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Confirmed windows for customer-visible work
            </CardDescription>
          </CardHeader>
          <CardContent>
            {schedule.length === 0 ? (
              <p className="text-sm leading-relaxed text-muted-foreground">No appointments are currently scheduled.</p>
            ) : (
              <ul className="space-y-3">
                {schedule.map((s) => (
                  <li
                    key={s.scheduleActionRef ?? `${s.label}-${s.scheduledStartAt}`}
                    className="rounded-sm border border-border/60 bg-background/50 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-foreground">{s.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatScheduleWindowDisplay(s.scheduledStartAt, s.scheduledEndAt)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{s.statusLabel}</p>
                    {s.scheduleActionRef && s.canAcknowledge ? (
                      <div className="mt-3 border-t border-border/60 pt-3">
                        <p className="text-xs font-medium text-foreground">Appointment acknowledgment</p>
                        <PortalAppointmentAckForm
                          rawToken={rawToken}
                          scheduleActionRef={s.scheduleActionRef}
                          initialReceived={false}
                        />
                      </div>
                    ) : s.acknowledgmentStatus === "received" ? (
                      <div className="mt-3 border-t border-border/60 pt-3">
                        <p className="text-xs font-medium text-foreground">Appointment acknowledgment</p>
                        <div
                          className="mt-3 rounded-sm border border-border bg-background/60 px-3 py-3"
                          role="status"
                          aria-live="polite"
                        >
                          <p className="text-xs font-medium text-foreground">Thanks — we received your confirmation.</p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            The office will review it. This does not change your scheduled time; for changes, contact us
                            directly.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-sm border-border bg-card/40 shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Contact</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Reach the office for questions about this proposal or project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {context.contactLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Contact information is not listed on this portal.</p>
            ) : (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {context.contactLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-sm border-border bg-card/40 shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Upload photos or documents for the office</CardTitle>
            <CardDescription className="text-sm leading-relaxed text-muted-foreground">
              Share site photos, permits, or other PDFs your estimator or project manager should see. The office will
              review what you send; uploading here does not change your schedule or replace a phone call for urgent
              issues.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PortalFileUploadForm rawToken={rawToken} />
          </CardContent>
        </Card>

        <Card className="rounded-sm border-border bg-card/40 shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Send a note</CardTitle>
            <CardDescription className="text-sm leading-relaxed text-muted-foreground">
              Send a note to the office. We&apos;ll review it and follow up if needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PortalSendNoteForm rawToken={rawToken} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
