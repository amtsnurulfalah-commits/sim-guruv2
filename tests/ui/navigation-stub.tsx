import React from "react";
export function usePathname() {
  return new URLSearchParams(location.search).get("path") ?? "/dashboard";
}
export default function Link({
  href,
  children,
  ...props
}: React.ComponentProps<"a">) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
