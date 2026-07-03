"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const BUILD_VERSION = "1783037741";

export function VersionChecker() {
  const pathname = usePathname();
  useEffect(() => {
    fetch("/api/version", { cache: "no-store" })
      .then(r => r.json())
      .then(data => {
        if (data.version && data.version !== BUILD_VERSION) {
          window.location.reload();
        }
      })
      .catch(() => {});
  }, [pathname]);
  return null;
}
