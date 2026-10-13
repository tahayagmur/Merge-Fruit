"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, errorMessage } from "@/lib/api-client";

export function QuickAddTask({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    try {
      await apiRequest(`/api/projects/${projectId}/tasks`, { method: "POST", body: { title } });
      setTitle("");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Add a task and press Enter"
        maxLength={200}
        aria-label="New task title"
        disabled={pending}
      />
      <Button type="submit" variant="secondary" disabled={pending || !title.trim()}>
        {pending ? <Loader2 className="animate-spin" /> : <Plus />}
        Add
      </Button>
    </form>
  );
}
