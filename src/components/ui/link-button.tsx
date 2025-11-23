"use client";

import { type ReactNode, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./button";

interface LinkButtonProps extends Omit<ComponentProps<typeof Button>, "onClick"> {
  href: string;
  children?: ReactNode;
}

export function LinkButton({ href, children, ...props }: LinkButtonProps) {
  const router = useRouter();

  return (
    <Button onClick={() => router.push(href)} {...props}>
      {children}
    </Button>
  );
}
