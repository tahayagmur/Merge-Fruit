"use client";

import { LogOut } from "lucide-react";
import { signOutEverywhere } from "@/app/actions/account";
import { ConfirmDelete } from "@/components/common/confirm-delete";
import { Button } from "@/components/ui/button";

export function SignOutEverywhere() {
  return (
    <ConfirmDelete
      title="Sign out on every device?"
      description="All sessions of your account are revoked, including this one. You will need to sign in again."
      confirmLabel="Sign out everywhere"
      tone="default"
      onConfirm={async () => {
        await signOutEverywhere();
        return true;
      }}
      trigger={
        <Button variant="outline">
          <LogOut /> Sign out everywhere
        </Button>
      }
    />
  );
}
