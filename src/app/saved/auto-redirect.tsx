"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRedirect() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/queue");
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return null;
}
