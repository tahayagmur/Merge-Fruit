"use client";

import { Loader2 } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ConfirmDeleteProps {
  title: string;
  description: string;
  /** Omit when controlling the dialog with `open` / `onOpenChange`. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  confirmLabel?: string;
  /** When set, the user must type this text before confirming (for sensitive actions). */
  confirmPhrase?: string;
  /** "default" for confirmations that are sensitive but not destructive. */
  tone?: "destructive" | "default";
  onConfirm: () => Promise<boolean>;
}

/** Destructive confirmation. `onConfirm` resolves to true when the dialog may close. */
export function ConfirmDelete({
  title,
  description,
  trigger,
  open: controlledOpen,
  onOpenChange,
  confirmLabel = "Delete",
  confirmPhrase,
  tone = "destructive",
  onConfirm,
}: ConfirmDeleteProps) {
  const uid = useId();
  const [typed, setTyped] = useState("");
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpenState = onOpenChange ?? setUncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!next) setTyped("");
    setOpenState(next);
  };
  const phraseMatches = !confirmPhrase || typed.trim() === confirmPhrase;
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    try {
      if (await onConfirm()) setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {confirmPhrase && (
          <div className="grid gap-2">
            <label htmlFor={`${uid}-confirm-phrase`} className="text-sm text-muted-foreground">
              Type <span className="font-mono text-foreground">{confirmPhrase}</span> to confirm.
            </label>
            <Input
              id={`${uid}-confirm-phrase`}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant={tone === "destructive" ? "destructive" : "default"} onClick={confirm} disabled={pending || !phraseMatches}>
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
