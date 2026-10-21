import React from "react";
export function usePathname() {
  return new URLSearchParams(location.search).get("path") ?? "/dashboard";
}
export default function Link({
  href,
  children,
  prefetch,
  ...props
}: React.ComponentProps<"a"> & { prefetch?: boolean }) {
  void prefetch;
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
