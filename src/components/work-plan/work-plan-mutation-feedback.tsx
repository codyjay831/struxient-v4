export type WorkPlanMutationFeedbackState =
  | undefined
  | { ok?: boolean; error?: string; fieldErrors?: Record<string, string[]> };

export function WorkPlanMutationFeedback({ state }: { state: WorkPlanMutationFeedbackState }) {
  if (!state || state.ok) return null;
  return (
    <p className="text-sm font-medium text-destructive dark:text-red-400" role="alert">
      {state.error}
    </p>
  );
}

export function WorkPlanMutationFieldErrors({ state }: { state: WorkPlanMutationFeedbackState }) {
  if (!state || state.ok || !state.fieldErrors) return null;
  return (
    <ul className="list-inside list-disc text-sm text-destructive dark:text-red-400">
      {Object.entries(state.fieldErrors).map(([k, msgs]) => (
        <li key={k}>
          {k}: {msgs.join(", ")}
        </li>
      ))}
    </ul>
  );
}
