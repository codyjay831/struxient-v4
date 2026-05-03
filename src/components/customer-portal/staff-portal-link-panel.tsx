"use client";

import { useActionState, useMemo } from "react";

import {
  createCustomerPortalLink,
  regenerateCustomerPortalLink,
  revokeCustomerPortalLink,
} from "@/app/(app)/app/sales/quotes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function PortalUrlReveal({ portalPath }: { portalPath: string }) {
  const fullUrl = useMemo(() => {
    if (typeof window === "undefined") return portalPath;
    return new URL(portalPath, window.location.origin).href;
  }, [portalPath]);

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Copy this link once. It cannot be retrieved later.</Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input readOnly value={fullUrl} className="font-mono text-xs" />
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          onClick={() => void navigator.clipboard.writeText(fullUrl)}
        >
          Copy link
        </Button>
      </div>
    </div>
  );
}

export type StaffPortalLinkPanelProps = {
  quoteId: string;
  hasActiveToken: boolean;
  lastViewedAt: string | null;
  canCreateLink: boolean;
  canRevokeRegenerateLink: boolean;
};

export function StaffPortalLinkPanel(props: StaffPortalLinkPanelProps) {
  const { quoteId, hasActiveToken, lastViewedAt, canCreateLink, canRevokeRegenerateLink } = props;

  const [createState, createAction, createPending] = useActionState(createCustomerPortalLink, undefined);
  const [revokeState, revokeAction, revokePending] = useActionState(revokeCustomerPortalLink, undefined);
  const [regenState, regenAction, regenPending] = useActionState(regenerateCustomerPortalLink, undefined);

  const lastPath =
    createState?.ok && createState.portalPath
      ? createState.portalPath
      : regenState?.ok && regenState.portalPath
        ? regenState.portalPath
        : null;

  const actionError =
    (createState && !createState.ok ? createState.error : null) ||
    (revokeState && !revokeState.ok ? revokeState.error : null) ||
    (regenState && !regenState.ok ? regenState.error : null);

  return (
    <section className="space-y-4 rounded-sm border border-border bg-card/10 p-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Customer portal</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          This link shows a customer-safe view of the sent proposal and project status. Internal notes, job activity, and
          execution details are hidden.
        </p>
      </div>

      {hasActiveToken ? (
        <p className="text-xs text-muted-foreground">
          Status: <span className="font-medium text-foreground">Active</span>
          {lastViewedAt ? (
            <>
              {" "}
              · Last opened{" "}
              <span className="font-medium text-foreground">{new Date(lastViewedAt).toLocaleString()}</span>
            </>
          ) : null}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">No active customer portal link.</p>
      )}

      {!hasActiveToken && !lastPath ? (
        <p className="text-xs text-muted-foreground">
          After you create a link, copy it immediately. For security, the full URL is not stored and cannot be shown
          again until you regenerate.
        </p>
      ) : null}

      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      {lastPath ? <PortalUrlReveal portalPath={lastPath} /> : null}

      <div className="flex flex-wrap gap-2">
        {canCreateLink && !hasActiveToken ? (
          <form action={createAction}>
            <input type="hidden" name="quoteId" value={quoteId} />
            <Button type="submit" size="sm" disabled={createPending}>
              {createPending ? "Creating…" : "Create customer portal link"}
            </Button>
          </form>
        ) : null}

        {canRevokeRegenerateLink && hasActiveToken ? (
          <form action={revokeAction}>
            <input type="hidden" name="quoteId" value={quoteId} />
            <Button type="submit" variant="outline" size="sm" disabled={revokePending}>
              {revokePending ? "Revoking…" : "Revoke link"}
            </Button>
          </form>
        ) : null}

        {canRevokeRegenerateLink && hasActiveToken ? (
          <form action={regenAction}>
            <input type="hidden" name="quoteId" value={quoteId} />
            <Button type="submit" variant="secondary" size="sm" disabled={regenPending}>
              {regenPending ? "Regenerating…" : "Regenerate link"}
            </Button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
