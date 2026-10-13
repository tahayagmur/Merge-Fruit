"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/common/confirm-delete";
import { OptionSelect } from "@/components/common/option-select";
import { apiRequest, errorMessage } from "@/lib/api-client";
import { WORKSPACE_ROLE_LABELS, WORKSPACE_ROLES, type WorkspaceRole } from "@/lib/domain";

/** Owner-only role change. Every change is confirmed; the server and database re-check permissions. */
export function RoleControl({ userId, label, role, isSelf }: { userId: string; label: string; role: WorkspaceRole; isSelf: boolean }) {
  const router = useRouter();
  const [pendingRole, setPendingRole] = useState<WorkspaceRole | null>(null);

  async function apply() {
    if (!pendingRole) return true;
    try {
      await apiRequest(`/api/users/${userId}/role`, { method: "PATCH", body: { role: pendingRole } });
      toast.success(`${label} is now ${WORKSPACE_ROLE_LABELS[pendingRole]}`);
      router.refresh();
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  }

  return (
    <>
      <OptionSelect
        id={`role-${userId}`}
        aria-label={`Role of ${label}`}
        value={role}
        options={WORKSPACE_ROLES}
        labels={WORKSPACE_ROLE_LABELS}
        onChange={(next) => {
          if (next !== role) setPendingRole(next);
        }}
        size="sm"
        className="w-32"
      />
      <ConfirmDelete
        open={pendingRole !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRole(null);
        }}
        title="Change role?"
        description={
          pendingRole
            ? `${label} will become ${WORKSPACE_ROLE_LABELS[pendingRole]}.${
                isSelf && pendingRole !== "owner" ? " You will lose owner permissions immediately." : ""
              }`
            : ""
        }
        confirmLabel="Change role"
        tone={isSelf ? "destructive" : "default"}
        onConfirm={apply}
      />
    </>
  );
}
