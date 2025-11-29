"use client";

import { useTransition, type ReactNode, type ComponentProps } from "react";
import { Button } from "./button";

interface ActionButtonProps extends Omit<ComponentProps<typeof Button>, "onClick"> {
  action: () => Promise<void>;
  children?: ReactNode;
}

export function ActionButton({ action, children, disabled, ...props }: ActionButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      await action();
    });
  };

  return (
    <Button onClick={handleClick} disabled={disabled || isPending} {...props}>
      {children}
    </Button>
  );
}
