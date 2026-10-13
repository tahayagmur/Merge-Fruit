"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchFormProps {
  basePath: string;
  /** Other query parameters to keep when searching (filters). Page is always reset. */
  params?: Record<string, string | undefined>;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function SearchForm({ basePath, params = {}, defaultValue = "", placeholder = "Search…", label = "Search", className }: SearchFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function navigate(term: string) {
    const search = new URLSearchParams();
    for (const [key, item] of Object.entries(params)) if (item && key !== "page" && key !== "q") search.set(key, item);
    if (term.trim()) search.set("q", term.trim());
    const query = search.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(value);
  }

  return (
    <form role="search" onSubmit={onSubmit} className={cn("relative w-full sm:max-w-xs", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        maxLength={100}
        className="pr-8 pl-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            navigate("");
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </form>
  );
}
