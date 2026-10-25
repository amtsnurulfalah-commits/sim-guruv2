import { NotFoundState } from "@/components/feedback/not-found-state";

/** Workspace already owns the main landmark, skip target and account controls. */
export default function WorkspaceNotFound() {
  return <NotFoundState embedded />;
}
