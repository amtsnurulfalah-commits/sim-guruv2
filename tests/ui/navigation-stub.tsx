import React from "react";
export function usePathname() {
  return new URLSearchParams(location.search).get("path") ?? "/dashboard";
}
export function useRouter() {
  return { push: (href: string) => window.location.assign(href) };
}
export default function Link({
  href,
  children,
  prefetch,
  onNavigate,
  ...props
}: React.ComponentProps<"a"> & {
  prefetch?: boolean | "auto";
  onNavigate?: (event: { preventDefault: () => void }) => void;
}) {
  void prefetch;
  void onNavigate;
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
