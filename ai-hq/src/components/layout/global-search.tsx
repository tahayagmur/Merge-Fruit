"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Input } from "@/components/ui/input";

/** Top-bar search across projects, tasks, automations and agents. */
export function GlobalSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = value.trim();
    if (term.length < 2) return;
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <form role="search" onSubmit={onSubmit} className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search projects, tasks, agents…"
        aria-label="Search everything"
        maxLength={100}
        className="h-8 bg-input/10 pl-9 text-sm"
      />
    </form>
  );
}
