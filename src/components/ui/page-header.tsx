import { HelpDisclosure } from "./help-disclosure";
import type { ReactNode } from "react";

/** One page title, concise context, and secondary tools. Main work stays by its data. */
export function PageHeader({ title, context, description, actions }: {
  title: string;
  context: ReactNode;
  description: string;
  actions?: ReactNode;
}) {
  return <header className="ui-page-header">
    <div className="min-w-0 space-y-2">
      <p className="text-sm font-medium text-primary">{context}</p>
      <h1>{title}</h1>
      <HelpDisclosure><p>{description}</p></HelpDisclosure>
    </div>
    {actions && <div className="ui-page-tools">{actions}</div>}
  </header>;
}
