"use client";

import { type ReactNode, type ComponentProps } from "react";
import { Button } from "./button";

interface OAuthButtonProps extends Omit<ComponentProps<typeof Button>, "onClick"> {
  url: string;
  children?: ReactNode;
}

export function OAuthButton({ url, children, ...props }: OAuthButtonProps) {
  const handleClick = () => {
    window.location.href = url;
  };

  return (
    <Button onClick={handleClick} {...props}>
      {children}
    </Button>
  );
}
