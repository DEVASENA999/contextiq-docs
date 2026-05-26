import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Mail, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — DocGPT" },
      { name: "description", content: "Account settings" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Settings,
});

function Settings() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      setFullName(profile?.full_name ?? "");
    })();
  }, []);

  const save = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <h1 className="font-display text-4xl">Settings</h1>
      <p className="mt-1 text-muted-foreground">Manage your account.</p>

      <div className="mt-8 space-y-6">
        <Section icon={User} title="Profile">
          <Field label="Full name">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-md border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-ring"
            />
          </Field>
          <button
            onClick={save}
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save"}
          </button>
        </Section>

        <Section icon={Mail} title="Email">
          <p className="text-sm text-muted-foreground">{email}</p>
        </Section>

        <Section icon={Shield} title="Privacy">
          <p className="text-sm text-muted-foreground">
            Your documents and chats are private. Row-level security ensures no other user can access your data.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
