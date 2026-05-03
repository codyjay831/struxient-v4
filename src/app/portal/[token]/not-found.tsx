export default function PortalNotFound() {
  return (
    <div className="mx-auto min-h-[50vh] max-w-lg px-6 py-24 text-center">
      <h1 className="text-lg font-semibold tracking-tight text-foreground">This portal link is no longer available</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        The link may have expired, been replaced, or is incorrect. Request a new link from your project contact at the
        office.
      </p>
    </div>
  );
}
