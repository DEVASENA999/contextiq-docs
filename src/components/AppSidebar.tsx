import { Link, useRouter } from "@tanstack/react-router";
import { LayoutDashboard, Upload, MessageSquare, Settings, Sparkles, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState } from "react";

const nav = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Library" },
  { to: "/upload", icon: Upload, label: "Upload" },
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/settings", icon: Settings, label: "Settings" },
] as const;

export function AppSidebar() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.navigate({ to: "/" });
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <span className="font-display text-xl">Lumen</span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeProps={{ className: "bg-accent text-accent-foreground" }}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-accent/40 hover:text-sidebar-foreground"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 truncate px-2 text-xs text-muted-foreground">{email}</div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent/40 hover:text-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
