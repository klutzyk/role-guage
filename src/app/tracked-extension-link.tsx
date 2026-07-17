"use client";

import { track } from "@vercel/analytics";
import { Globe } from "lucide-react";

type TrackedExtensionLinkProps = {
  href: string;
  location: "hero" | "cta";
  className: string;
};

export function TrackedExtensionLink({ href, location, className }: TrackedExtensionLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={() => track("chrome_extension_click", { location })}
    >
      <Globe size={18} aria-hidden="true" />
      Get the Extension
    </a>
  );
}
