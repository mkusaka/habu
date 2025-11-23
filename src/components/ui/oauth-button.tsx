"use client";

import { Button, type ButtonProps } from "./button";

interface OAuthButtonProps extends ButtonProps {
  url: string;
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
