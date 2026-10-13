import { createClient } from "@supabase/supabase-js";
import { USERS } from "./support/fixtures";
import { e2eBackend } from "./support/target";

/** Creates the test accounts in a real local Supabase. The emulator ships them built in. */
export default async function globalSetup() {
  const backend = e2eBackend();
  if (backend.target !== "supabase") return;

  const admin = createClient(backend.supabaseUrl, backend.secretKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  for (const user of Object.values(USERS)) {
    const existing = data.users.find((candidate) => candidate.email === user.email);
    if (existing) {
      const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, { password: user.password });
      if (updateError) throw updateError;
    } else {
      const { error: createError } = await admin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      });
      if (createError) throw createError;
    }
  }
}
