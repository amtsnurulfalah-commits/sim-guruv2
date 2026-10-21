import {
  ArrowUpRight,
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  Eye,
  Filter,
  History,
  Link,
  LogIn,
  LogOut,
  Mail,
  PanelsTopLeft,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  CircleStop,
  Send,
  ToggleLeft,
  Trash2,
  X,
} from "lucide-react";

// Explicit semantic actions: labels and business handlers remain with each caller.
const icons = {
  previous: ChevronLeft,
  next: ChevronRight,
  refresh: RefreshCw,
  preview: ClipboardCheck,
  close: X,
  delete: Trash2,
  stop: CircleStop,
  archive: Archive,
  history: History,
  download: Download,
  print: Printer,
  link: Link,
  visibility: Eye,
  mail: Mail,
  filter: Filter,
  add: Plus,
  access: LogIn,
  logout: LogOut,
  confirm: Check,
  save: Save,
  edit: Pencil,
  toggle: ToggleLeft,
  open: ArrowUpRight,
  submit: Send,
  section: PanelsTopLeft,
} as const;

export function ActionIcon({ action }: { action: keyof typeof icons }) {
  const Icon = icons[action];
  return (
    <Icon aria-hidden="true" focusable="false" className="size-4 shrink-0" />
  );
}
