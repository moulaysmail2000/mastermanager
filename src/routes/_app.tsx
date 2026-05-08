import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { Landmark, Tag, MonitorSmartphone, LogOut, PhoneOff, Wallet, Archive, Palette, Check, Sun, Moon, Users, LayoutDashboard, RefreshCw, Move, GripVertical } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useTheme, THEMES } from "@/hooks/useTheme";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
const WALLET_URL = "/friend-accounts";

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, session, loading } = useAuth();
  const { theme, mode, setTheme, toggle } = useTheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [order, setOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return items.filter(i => i.url !== WALLET_URL).map(i => i.url);
    try {
      const saved = JSON.parse(localStorage.getItem(NAV_ORDER_KEY) || "null");
      const defaultOrder = items.filter(i => i.url !== WALLET_URL).map(i => i.url);
      if (Array.isArray(saved)) {
        const valid = saved.filter((u: string) => defaultOrder.includes(u));
        const missing = defaultOrder.filter(u => !valid.includes(u));
        return [...valid, ...missing];
      }
      return defaultOrder;
    } catch {
      return items.filter(i => i.url !== WALLET_URL).map(i => i.url);
    }
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const itemsByUrl = new Map(items.map(i => [i.url, i]));
  const orderedItems = order.map(u => itemsByUrl.get(u)!).filter(Boolean);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = order.indexOf(active.id as string);
    const newIdx = order.indexOf(over.id as string);
    const next = arrayMove(order, oldIdx, newIdx);
    setOrder(next);
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(next));
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
              variant={reorderMode ? "default" : "ghost"}
              size="sm"
              className="hidden md:inline-flex gap-1.5 h-8"
              onClick={() => setReorderMode(v => !v)}
              title="ترتيب القائمة"
            >
              <Move className="h-3.5 w-3.5" />
            </Button>
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
          {items.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <button
                key={item.url}
                onClick={() => navigate({ to: item.url })}
                title={item.title}
                className={cn(
                  "flex-1 flex items-center justify-center rounded-lg py-2 transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
              </button>
            );
          })}
        </nav>

        {/* Desktop: original layout */}
        <nav className="hidden sm:flex gap-0.5 px-6 py-2 overflow-x-auto scrollbar-hide">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={order} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-0.5">
                {orderedItems.map((item) => (
                  <SortableNavItem
                    key={item.url}
                    item={item}
                    isActive={location.pathname === item.url}
                    reorderMode={reorderMode}
                    onClick={() => navigate({ to: item.url as any })}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {(() => {
            const wallet = items.find(i => i.url === "/friend-accounts")!;
            const isActive = location.pathname === wallet.url;
            return (
              <button
                onClick={() => navigate({ to: wallet.url as any })}
                title={wallet.title}
                className={cn(
                  "mr-auto relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <wallet.icon className="h-4 w-4 shrink-0" />
                <span>{wallet.title}</span>
              </button>
            );
          })()}
        </nav>
      </div>

      <main className="flex-1 p-2 sm:p-4 md:p-6 max-w-7xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}

function SortableNavItem({ item, isActive, reorderMode, onClick }: {
  item: { title: string; url: string; icon: any };
  isActive: boolean;
  reorderMode: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.url,
    disabled: !reorderMode,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const Icon = item.icon;
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...(reorderMode ? { ...attributes, ...listeners } : {})}
      onClick={reorderMode ? undefined : onClick}
      title={item.title}
      className={cn(
        "relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200",
        reorderMode && "cursor-grab active:cursor-grabbing ring-1 ring-primary/30",
        isActive && !reorderMode
          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {reorderMode && <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-60" />}
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.title}</span>
    </button>
  );
}
