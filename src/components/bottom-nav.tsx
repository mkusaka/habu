"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Bookmark, List, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/bookmarks", icon: Bookmark, label: "Bookmarks" },
  { href: "/queue", icon: List, label: "Queue" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function BottomNav() {
  const pathname = usePathname();

  // Check if current path is active (exact match or starts with for nested routes)
  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile: bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-around h-14 max-w-2xl mx-auto">
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-xs transition-colors",
                isActive(href) ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Desktop: left sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 bottom-0 z-50 w-16 flex-col items-center py-4 border-r border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        {navItems.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center justify-center w-full py-3 gap-1 text-xs transition-colors",
              isActive(href) ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            title={label}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px]">{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
