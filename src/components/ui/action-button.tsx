"use client";

import { useTransition } from "react";
import { Button, type ButtonProps } from "./button";

interface ActionButtonProps extends ButtonProps {
  action: () => Promise<void>;
}

export function ActionButton({
  action,
  children,
  disabled,
  ...props
}: ActionButtonProps) {
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
