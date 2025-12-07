import { type ReactNode } from "react";
import Link from "next/link";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "./button";
import { cn } from "@/lib/utils";

interface LinkButtonProps extends VariantProps<typeof buttonVariants> {
  href: string;
  children?: ReactNode;
  className?: string;
}

export function LinkButton({ href, children, variant, size, className }: LinkButtonProps) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)}>
      {children}
    </Link>
  );
}
