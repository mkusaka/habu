"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TagOption {
  tag: string;
  count: number;
}

interface TagTargetComboboxProps {
  value: string;
  options: TagOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TagTargetCombobox({
  value,
  options,
  onChange,
  placeholder = "Select target tag",
}: TagTargetComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);

  useEffect(() => {
    if (!open) {
      setQuery(value);
    }
  }, [open, value]);

  const normalizedQuery = query.trim().toLowerCase();
  const hasExactMatch = options.some((option) => option.tag.toLowerCase() === normalizedQuery);

  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((option) => option.tag.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery, options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search target tags..."
          />
          <CommandList>
            {!hasExactMatch && normalizedQuery && (
              <CommandItem
                value={query}
                onSelect={() => {
                  onChange(query.trim());
                  setOpen(false);
                }}
              >
                <Check className="mr-2 size-4 opacity-0" />
                Use "{query.trim()}"
              </CommandItem>
            )}

            {filteredOptions.map((option) => {
              const isSelected = option.tag === value;
              return (
                <CommandItem
                  key={option.tag}
                  value={option.tag}
                  onSelect={() => {
                    onChange(option.tag);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 size-4", isSelected ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{option.tag}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{option.count}</span>
                </CommandItem>
              );
            })}

            {filteredOptions.length === 0 && normalizedQuery.length === 0 && (
              <CommandEmpty>No tags available.</CommandEmpty>
            )}
            {filteredOptions.length === 0 && normalizedQuery.length > 0 && hasExactMatch && (
              <CommandEmpty>No matching tags.</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
