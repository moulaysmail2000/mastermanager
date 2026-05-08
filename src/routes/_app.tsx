import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Landmark, Tag, MonitorSmartphone, LogOut, PhoneOff, Wallet, Archive, Palette, Check, Sun, Moon, Users, LayoutDashboard, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useTheme, THEMES } from "@/hooks/useTheme";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const items = [
  { title: "الرئيسية", url: "/dashboard", icon: LayoutDashboard },
  { title: "حسابات CapCut", url: "/capcut-accounts", icon: MonitorSmartphone },
  { title: "الحسابات البنكية", url: "/bank-accounts", icon: Landmark },
  { title: "الأسعار", url: "/prices", icon: Tag },
  { title: "أرقام لم تُدفع", url: "/unpaid-numbers", icon: PhoneOff },
  { title: "الإدارة المالية", url: "/finance", icon: Wallet },
  { title: "الأرشيف", url: "/finance-archive", icon: Archive },
  { title: "Wallet", url: "/friend-accounts", icon: Users },
] as const;

const NAV_ORDER_KEY = "nav_order_v1";
const defaultOrder = items.map((i) => i.url);

function loadOrder(): string[] {
  if (typeof window === "undefined") return [...defaultOrder];
  try {
    const raw = localStorage.getItem(NAV_ORDER_KEY);
    if (!raw) return [...defaultOrder];
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((u) => defaultOrder.includes(u));
    const missing = defaultOrder.filter((u) => !valid.includes(u));
    return [...valid, ...missing];
  } catch {
    return [...defaultOrder];
  }
}

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, session, loading } = useAuth();
  const { theme, mode, setTheme, toggle } = useTheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [order, setOrder] = useState<string[]>(defaultOrder);
  const [dragUrl, setDragUrl] = useState<string | null>(null);
  const [overUrl, setOverUrl] = useState<string | null>(null);
  const dragMovedRef = useRef(false);

  useEffect(() => { setOrder(loadOrder()); }, []);

  const orderedItems = order
    .map((url) => items.find((i) => i.url === url))
    .filter(Boolean) as Array<typeof items[number]>;

  const reorder = (from: string, to: string) => {
    if (from === to) return;
    setOrder((prev) => {
      const next = [...prev];
      const fi = next.indexOf(from);
      const ti = next.indexOf(to);
      if (fi < 0 || ti < 0) return prev;
      next.splice(fi, 1);
      next.splice(ti, 0, from);
      try { localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      toast.success("جاري تحديث النظام بالكامل...");
      setTimeout(() => window.location.reload(), 300);
    } catch {
      toast.error("فشل التحديث");
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col w-full bg-background" dir="rtl">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center justify-between px-3 md:px-6 h-10 sm:h-14">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <MonitorSmartphone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            </div>
            <h1 className="text-sm sm:text-base font-bold text-foreground leading-tight">Master Manager</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:inline-flex text-muted-foreground hover:text-foreground gap-1.5 h-8"
              onClick={handleRefresh}
              disabled={refreshing}
              title="تحديث البيانات"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 h-8" title="الثيمات">
                  <Palette className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">اختر ثيماً</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {THEMES.map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => setTheme(t.id)} className="gap-2 text-xs cursor-pointer">
                    <span className="h-3.5 w-3.5 rounded-full border border-border/50 shrink-0" style={{ background: t.color }} />
                    <span className="flex-1">{t.name}</span>
                    {theme === t.id && <Check className="h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground gap-1.5 h-8"
              onClick={toggle}
              title={mode === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
            >
              {mode === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive gap-1.5 h-8"
              onClick={() => { signOut(); navigate({ to: "/login" }); }}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">خروج</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="border-b border-border/30 bg-card/40 backdrop-blur-sm">
        {/* Mobile: distribute evenly across full width */}
        <nav className="flex sm:hidden items-center justify-between px-2 py-1.5 gap-1">
          {orderedItems.map((item) => {
            const isActive = location.pathname === item.url;
            const isOver = overUrl === item.url && dragUrl && dragUrl !== item.url;
            return (
              <button
                key={item.url}
                draggable
                onDragStart={(e) => { setDragUrl(item.url); dragMovedRef.current = false; e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => { e.preventDefault(); if (dragUrl && dragUrl !== item.url) { setOverUrl(item.url); dragMovedRef.current = true; } }}
                onDragLeave={() => setOverUrl((u) => (u === item.url ? null : u))}
                onDrop={(e) => { e.preventDefault(); if (dragUrl) reorder(dragUrl, item.url); setDragUrl(null); setOverUrl(null); }}
                onDragEnd={() => { setDragUrl(null); setOverUrl(null); }}
                onClick={() => { if (!dragMovedRef.current) navigate({ to: item.url }); }}
                title={item.title}
                className={cn(
                  "relative flex-1 flex items-center justify-center rounded-lg py-2 transition-colors duration-200",
                  isActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  isOver && "ring-2 ring-primary/60",
                  dragUrl === item.url && "opacity-40"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-active-mobile"
                    className="absolute inset-0 bg-primary rounded-lg shadow-sm shadow-primary/20"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <item.icon className="relative h-5 w-5 shrink-0" />
              </button>
            );
          })}
        </nav>

        {/* Desktop: original layout */}
        <nav className="hidden sm:flex gap-0.5 px-6 py-2 overflow-x-auto scrollbar-hide">
          {orderedItems.map((item) => {
            const isActive = location.pathname === item.url;
            const isOver = overUrl === item.url && dragUrl && dragUrl !== item.url;
            return (
              <button
                key={item.url}
                draggable
                onDragStart={(e) => { setDragUrl(item.url); dragMovedRef.current = false; e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => { e.preventDefault(); if (dragUrl && dragUrl !== item.url) { setOverUrl(item.url); dragMovedRef.current = true; } }}
                onDragLeave={() => setOverUrl((u) => (u === item.url ? null : u))}
                onDrop={(e) => { e.preventDefault(); if (dragUrl) reorder(dragUrl, item.url); setDragUrl(null); setOverUrl(null); }}
                onDragEnd={() => { setDragUrl(null); setOverUrl(null); }}
                onClick={() => { if (!dragMovedRef.current) navigate({ to: item.url }); }}
                title={item.title}
                className={cn(
                  "relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors duration-200 cursor-grab active:cursor-grabbing",
                  isActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  isOver && "ring-2 ring-primary/60",
                  dragUrl === item.url && "opacity-40"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-active-desktop"
                    className="absolute inset-0 bg-primary rounded-lg shadow-sm shadow-primary/20"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <item.icon className="relative h-4 w-4 shrink-0" />
                <span className="relative">{item.title}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <main className="flex-1 p-2 sm:p-4 md:p-6 max-w-7xl w-full mx-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
