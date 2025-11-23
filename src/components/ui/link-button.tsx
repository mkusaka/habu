"use client";

import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "./button";

interface LinkButtonProps extends ButtonProps {
  href: string;
}

export function LinkButton({ href, children, ...props }: LinkButtonProps) {
  const router = useRouter();

  return (
    <Button onClick={() => router.push(href)} {...props}>
      {children}
    </Button>
  );
}
