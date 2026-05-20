import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PhoneOff,
  MonitorSmartphone,
  Landmark,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  CalendarClock,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Bell,
  Target,
  Pencil,
  Check,
  X,
  Move,
  GripVertical,
  CalendarDays,
  Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MotivationalQuotes } from "@/components/MotivationalQuotes";
import { ConsultDialog } from "@/components/ConsultDialog";
import DailyStatsBar from "@/components/DailyStatsBar";
import LiveClock from "@/components/LiveClock";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";

type Tx = {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  transaction_date: string;
  created_at: string;
};

type CapcutAccount = {
  id: string;
  status: string;
  plan_type: string;
  delivered_count: number;
  created_at: string;
};

type Unpaid = { id: string; phone_number: string; status: string; created_at: string };
type Bank = { id: string; bank_name: string };
type Friend = { id: string; owner_name: string; balance: number };

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-MA", { maximumFractionDigits: 2 }).format(n);

function StatCard({
  title,
  value,
  delta,
  icon: Icon,
  tone = "primary",
  hint,
}: {
  title: string;
  value: string;
  delta?: { value: number; positive: boolean } | null;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "success" | "warning" | "info" | "destructive";
  hint?: string;
}) {
  const toneMap: Record<string, string> = {
    primary: "from-primary/15 to-primary/5 text-primary",
    success: "from-success/15 to-success/5 text-success",
    warning: "from-warning/15 to-warning/5 text-warning",
    info: "from-info/15 to-info/5 text-info",
    destructive: "from-destructive/15 to-destructive/5 text-destructive",
  };
  return (
    <Card className="relative overflow-hidden border-border/50 h-full flex flex-col">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${toneMap[tone]} opacity-60`}
      />
      <CardContent className="relative p-4 sm:p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {value}
            </p>
          </div>
          <div className={`h-10 w-10 shrink-0 rounded-xl bg-background/60 backdrop-blur flex items-center justify-center ${toneMap[tone].split(" ").pop()}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-auto pt-3 min-h-[1.5rem] flex items-center">
          {delta ? (
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold ${
                  delta.positive ? "text-success" : "text-destructive"
                }`}
              >
                {delta.positive ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {Math.abs(delta.value).toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground">مقارنة بالشهر السابق</span>
            </div>
          ) : hint ? (
            <p className="text-[11px] text-muted-foreground/80">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { session } = useAuth();
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [capcut, setCapcut] = useState<CapcutAccount[] | null>(null);
  const [unpaid, setUnpaid] = useState<Unpaid[] | null>(null);
  const [banks, setBanks] = useState<Bank[] | null>(null);
  const [friends, setFriends] = useState<Friend[] | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  // ===== Currency switch (MAD / USD) =====
  const CURRENCY_KEY = "dashboard_currency_v1";
  const RATE_MAD_PER_USD = 10; // 1 USD ≈ 10 MAD (تقريبي)
  const [currency, setCurrency] = useState<"MAD" | "USD">(() => {
    if (typeof window === "undefined") return "MAD";
    const v = localStorage.getItem(CURRENCY_KEY);
    return v === "USD" ? "USD" : "MAD";
  });
  const changeCurrency = (c: "MAD" | "USD") => {
    setCurrency(c);
    localStorage.setItem(CURRENCY_KEY, c);
  };
  const money = (n: number) => {
    const v = currency === "USD" ? n / RATE_MAD_PER_USD : n;
    return new Intl.NumberFormat("ar-MA", { maximumFractionDigits: 2 }).format(v);
  };
  const CUR = currency;

  const loadAll = async () => {
    setRefreshing(true);
    try {
      // Auto-archive previous months' transactions so the new month starts at zero
      const now = new Date();
      const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      await supabase
        .from("financial_transactions")
        .update({ archived: true })
        .eq("archived", false)
        .lt("transaction_date", currentMonthStart);

      const [tR, cR, uR, bR, fR] = await Promise.all([
        supabase.from("financial_transactions").select("id,type,amount,description,transaction_date,created_at").eq("archived", false).gte("transaction_date", currentMonthStart).order("transaction_date", { ascending: false }),
        supabase.from("capcut_accounts").select("id,status,plan_type,delivered_count,created_at"),
        supabase.from("unpaid_numbers").select("id,phone_number,status,created_at"),
        supabase.from("bank_accounts").select("id,bank_name"),
        supabase.from("friend_accounts").select("id,owner_name,balance"),
      ]);
      setTxs((tR.data as Tx[]) ?? []);
      setCapcut((cR.data as CapcutAccount[]) ?? []);
      setUnpaid((uR.data as Unpaid[]) ?? []);
      setBanks((bR.data as Bank[]) ?? []);
      setFriends((fR.data as Friend[]) ?? []);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!session) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    document.documentElement.classList.add("dashboard-active");
    return () => document.documentElement.classList.remove("dashboard-active");
  }, []);

  const txsList = txs ?? [];
  const capcutList = capcut ?? [];
  const unpaidList = unpaid ?? [];
  const banksList = banks ?? [];
  const friendsList = friends ?? [];

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    let income = 0,
      expense = 0,
      lastIncome = 0,
      lastExpense = 0;
    for (const t of txsList) {
      const d = new Date(t.transaction_date);
      const amt = Number(t.amount) || 0;
      if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
        if (t.type === "income") income += amt;
        else expense += amt;
      } else if (d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear) {
        if (t.type === "income") lastIncome += amt;
        else lastExpense += amt;
      }
    }

    const profit = income - expense;
    const lastProfit = lastIncome - lastExpense;
    const incomeDelta = lastIncome > 0 ? ((income - lastIncome) / lastIncome) * 100 : 0;
    const profitDelta = lastProfit !== 0 ? ((profit - lastProfit) / Math.abs(lastProfit)) * 100 : 0;

    const totalAccounts = capcutList.length;
    const availableAccounts = capcutList.filter((a) => a.status === "متاح").length;
    const soldAccounts = capcutList.filter((a) => a.status !== "متاح").length;
    const availabilityRate = totalAccounts ? (availableAccounts / totalAccounts) * 100 : 0;

    const unpaidCount = unpaidList.length;
    const friendsBalance = friendsList.reduce((s, f) => s + Number(f.balance || 0), 0);

    // Today, Yesterday & day before
    const today = new Date();
    const tKey = today.toISOString().slice(0, 10);
    const y = new Date(today); y.setDate(y.getDate() - 1);
    const db = new Date(today); db.setDate(db.getDate() - 2);
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const yKey = ymd(y), dbKey = ymd(db);
    let todayIncome = 0, todayExpense = 0, yesterdayIncome = 0, yesterdayExpense = 0, dayBeforeIncome = 0, dayBeforeExpense = 0;
    for (const t of txsList) {
      const k = t.transaction_date.slice(0, 10);
      const amt = Number(t.amount) || 0;
      if (k === tKey) {
        if (t.type === "income") todayIncome += amt; else todayExpense += amt;
      } else if (k === yKey) {
        if (t.type === "income") yesterdayIncome += amt; else yesterdayExpense += amt;
      } else if (k === dbKey) {
        if (t.type === "income") dayBeforeIncome += amt; else dayBeforeExpense += amt;
      }
    }

    return {
      income,
      expense,
      profit,
      incomeDelta,
      profitDelta,
      totalAccounts,
      availableAccounts,
      soldAccounts,
      availabilityRate,
      unpaidCount,
      friendsBalance,
      todayIncome,
      todayExpense,
      yesterdayIncome,
      yesterdayExpense,
      dayBeforeIncome,
      dayBeforeExpense,
    };
  }, [txsList, capcutList, unpaidList, friendsList]);

  const chartData = useMemo(() => {
    const days = 14;
    const map = new Map<string, { date: string; income: number; expense: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, {
        date: d.toLocaleDateString("ar-MA", { day: "numeric", month: "short" }),
        income: 0,
        expense: 0,
      });
    }
    for (const t of txsList) {
      const key = t.transaction_date.slice(0, 10);
      const row = map.get(key);
      if (!row) continue;
      const amt = Number(t.amount) || 0;
      if (t.type === "income") row.income += amt;
      else row.expense += amt;
    }
    return Array.from(map.values());
  }, [txsList]);

  const planData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of capcutList) {
      const key = a.plan_type || "غير محدد";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [capcutList]);

  const PIE_COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--info))",
    "hsl(var(--warning))",
    "hsl(var(--success))",
    "hsl(var(--destructive))",
    "hsl(var(--accent))",
  ];

  const recentTxs = txsList.slice(0, 6);

  // ===== Weekday performance (last 8 weeks) =====
  const weekdayData = useMemo(() => {
    const names = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const rows = names.map((n) => ({ day: n, income: 0, expense: 0, profit: 0, count: 0 }));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 56); // ~8 weeks
    for (const t of txsList) {
      const d = new Date(t.transaction_date);
      if (d < cutoff) continue;
      const idx = d.getDay();
      const amt = Number(t.amount) || 0;
      if (t.type === "income") rows[idx].income += amt;
      else rows[idx].expense += amt;
    }
    rows.forEach((r) => { r.profit = r.income - r.expense; r.count = 1; });
    return rows;
  }, [txsList]);

  const bestDay = useMemo(() => {
    let best = weekdayData[0];
    for (const r of weekdayData) if (r.profit > best.profit) best = r;
    return best;
  }, [weekdayData]);


  // Section ready states for progressive reveal
  const financeReady = txs !== null;
  const capcutReady = capcut !== null;
  const unpaidReady = unpaid !== null;
  const banksReady = banks !== null;
  const friendsReady = friends !== null;

  // Wrapper that fades each section in as its data arrives
  const Reveal = ({ show, children, delay = 0 }: { show: boolean; children: React.ReactNode; delay?: number }) =>
    show ? (
      <div
        className="animate-fade-in"
        style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
      >
        {children}
      </div>
    ) : (
      <Skeleton className="h-28 w-full" />
    );

  // ===== Smart Alerts =====
  const alerts = useMemo(() => {
    const list: { id: string; level: "danger" | "warning" | "info"; text: string; to?: string }[] = [];
    const now = Date.now();
    const oldUnpaid = unpaidList.filter((u) => {
      const created = new Date(u.created_at).getTime();
      return (now - created) / (1000 * 60 * 60 * 24) > 7;
    }).length;
    if (oldUnpaid > 0) {
      list.push({ id: "old-unpaid", level: "warning", text: `لديك ${oldUnpaid} رقم/أرقام لم تُدفع منذ أكثر من 7 أيام`, to: "/unpaid-numbers" });
    }
    if (stats.unpaidCount >= 10) {
      list.push({ id: "many-unpaid", level: "warning", text: `عدد الأرقام غير المدفوعة مرتفع (${stats.unpaidCount})`, to: "/unpaid-numbers" });
    }
    const negativeFriends = friendsList.filter((f) => Number(f.balance) < 0);
    if (negativeFriends.length > 0) {
      list.push({ id: "neg-friends", level: "danger", text: `${negativeFriends.length} محفظة صديق برصيد سالب`, to: "/friend-accounts" });
    }
    if (stats.totalAccounts > 0 && stats.availabilityRate < 15) {
      list.push({ id: "low-stock", level: "danger", text: `المخزون منخفض — ${stats.availableAccounts} حساب فقط متاح`, to: "/capcut-accounts" });
    }
    if (stats.profit < 0) {
      list.push({ id: "neg-profit", level: "danger", text: `الربح الصافي لهذا الشهر سالب (${fmt(stats.profit)} MAD)`, to: "/finance" });
    }
    if (stats.totalAccounts === 0) {
      list.push({ id: "no-accounts", level: "info", text: "لا توجد حسابات CapCut بعد — أضف الأول الآن", to: "/capcut-accounts" });
    }
    if (list.length === 0) {
      list.push({ id: "ok", level: "info", text: "كل شيء يسير على ما يرام — لا توجد تنبيهات حاليًا" });
    }
    return list;
  }, [unpaidList, friendsList, stats]);

  // ===== Monthly Goal =====
  const GOAL_KEY = "dashboard_monthly_goal_v1";
  const [goal, setGoal] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const v = Number(localStorage.getItem(GOAL_KEY) || "0");
    return isFinite(v) && v > 0 ? v : 0;
  });
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState<string>(String(goal || ""));
  const saveGoal = () => {
    const v = Math.max(0, Number(goalDraft) || 0);
    setGoal(v);
    localStorage.setItem(GOAL_KEY, String(v));
    setEditingGoal(false);
  };
  const goalProgress = goal > 0 ? Math.min(100, (Math.max(0, stats.profit) / goal) * 100) : 0;

  // ===== Section Order (drag & drop) =====
  const SECTION_ORDER_KEY = "dashboard_section_order_v4";
  const DEFAULT_SECTIONS = ["kpis", "charts", "weekday", "alerts", "goal", "recent"] as const;
  type SectionId = typeof DEFAULT_SECTIONS[number];
  const [reorderMode, setReorderMode] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<SectionId[]>(() => {
    if (typeof window === "undefined") return [...DEFAULT_SECTIONS];
    try {
      const saved = JSON.parse(localStorage.getItem(SECTION_ORDER_KEY) || "null");
      if (Array.isArray(saved)) {
        const valid = saved.filter((s: string) => (DEFAULT_SECTIONS as readonly string[]).includes(s)) as SectionId[];
        const missing = DEFAULT_SECTIONS.filter((s) => !valid.includes(s));
        return [...valid, ...missing];
      }
    } catch { /* ignore */ }
    return [...DEFAULT_SECTIONS];
  });
  const sectionSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleSectionDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const next = arrayMove(sectionOrder, sectionOrder.indexOf(active.id as SectionId), sectionOrder.indexOf(over.id as SectionId));
    setSectionOrder(next);
    localStorage.setItem(SECTION_ORDER_KEY, JSON.stringify(next));
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary/15 via-card to-card px-3 pt-2 pb-3 sm:p-7">
        <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-info/15 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
              <Badge variant="secondary" className="gap-1.5">
                <Sparkles className="h-3 w-3" /> لوحة التحكم
              </Badge>
              <ConsultDialog
                context={`مداخيل الشهر: ${stats.income} | مصاريف الشهر: ${stats.expense} | الربح: ${stats.profit} | حسابات CapCut: ${stats.totalAccounts} (متاح: ${stats.availableAccounts}) | أرقام لم تُدفع: ${stats.unpaidCount}`}
              />
            </div>
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight">
              نظرة عامة على نشاطك
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
              مرحبًا بعودتك — إليك ملخص أداء متجرك لهذا الشهر.
            </p>
            <MotivationalQuotes todayIncome={stats.todayIncome} todayExpense={stats.todayExpense} yesterdayIncome={stats.yesterdayIncome} yesterdayExpense={stats.yesterdayExpense} monthIncome={stats.income} monthExpense={stats.expense} unpaid={stats.unpaidCount} />
          </div>
          <div className="flex flex-col gap-3 items-end">
            <div className="flex flex-wrap gap-2 items-center">
              <Link
                to="/finance"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium shadow-sm"
              >
                <Wallet className="h-4 w-4" /> الإدارة المالية
              </Link>
              <Link
                to="/capcut-accounts"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-4 py-2 text-sm font-medium"
              >
                <MonitorSmartphone className="h-4 w-4" /> الحسابات
              </Link>
              <Button
                size="sm"
                variant={reorderMode ? "default" : "outline"}
                onClick={() => setReorderMode((v) => !v)}
                className="gap-1.5"
                title="ترتيب أقسام اللوحة"
              >
                <Move className="h-3.5 w-3.5" />
                <span className="text-xs">{reorderMode ? "تم" : "ترتيب"}</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5" title="تغيير العملة">
                    <Coins className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold">{CUR}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel className="text-xs">اختر العملة</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => changeCurrency("MAD")} className="gap-2 text-xs cursor-pointer">
                    <span className="flex-1">الدرهم المغربي</span>
                    <span className="font-bold">MAD</span>
                    {currency === "MAD" && <Check className="h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeCurrency("USD")} className="gap-2 text-xs cursor-pointer">
                    <span className="flex-1">الدولار الأمريكي</span>
                    <span className="font-bold">USD</span>
                    {currency === "USD" && <Check className="h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
                    سعر التحويل: 1 USD ≈ {RATE_MAD_PER_USD} MAD
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <div className="hidden sm:block">
                <LiveClock />
              </div>
              <DailyStatsBar />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      {(() => {
        const sectionContent: Record<SectionId, React.ReactNode> = {
          kpis: (
            <Reveal show={financeReady && capcutReady} delay={50}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                  <StatCard key="inc" title="مداخيل الشهر" value={fmt(stats.income)} icon={TrendingUp} tone="success" delta={{ value: stats.incomeDelta, positive: stats.incomeDelta >= 0 }} hint="MAD" />,
                  <StatCard key="exp" title="مصاريف الشهر" value={fmt(stats.expense)} icon={TrendingDown} tone="destructive" hint="MAD" />,
                  <StatCard key="prof" title="الربح الصافي" value={fmt(stats.profit)} icon={Wallet} tone={stats.profit >= 0 ? "primary" : "warning"} delta={{ value: stats.profitDelta, positive: stats.profit >= 0 }} hint="MAD" />,
                  <StatCard key="cc" title="حسابات CapCut" value={String(stats.totalAccounts)} icon={MonitorSmartphone} tone="primary" hint={`${stats.availableAccounts} متاح · ${stats.soldAccounts} مباع`} />,
                ].map((card, i) => (
                  <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}>
                    {card}
                  </div>
                ))}
              </div>
            </Reveal>
          ),
          alerts: (
            <Reveal show={financeReady && capcutReady && unpaidReady && friendsReady} delay={100}>
              <Card className="border-border/50 overflow-hidden">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-warning/15 text-warning flex items-center justify-center">
                      <Bell className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">التنبيهات الذكية</CardTitle>
                      <CardDescription className="text-xs">أهم ما يحتاج انتباهك الآن</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{alerts.length}</Badge>
                </CardHeader>
                <CardContent className="p-3 sm:p-4">
                  <ul className="space-y-2">
                    {alerts.map((a) => {
                      const tone =
                        a.level === "danger" ? "bg-destructive/10 border-destructive/30 text-destructive" :
                        a.level === "warning" ? "bg-warning/10 border-warning/30 text-warning" :
                        "bg-info/10 border-info/30 text-info";
                      const Icon = a.level === "info" ? Sparkles : AlertTriangle;
                      const inner = (
                        <div className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors", tone)}>
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="text-xs sm:text-sm font-medium text-foreground flex-1">{a.text}</span>
                          {a.to && <ArrowUpRight className="h-4 w-4 shrink-0 opacity-70" />}
                        </div>
                      );
                      return (
                        <li key={a.id}>
                          {a.to ? <Link to={a.to as any}>{inner}</Link> : inner}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            </Reveal>
          ),
          goal: (
            <Reveal show={financeReady} delay={150}>
              <Card className="border-border/50 overflow-hidden">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                      <Target className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">هدف الشهر</CardTitle>
                      <CardDescription className="text-xs">تتبّع وصولك لهدف الربح الصافي</CardDescription>
                    </div>
                  </div>
                  {!editingGoal ? (
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => { setGoalDraft(String(goal || "")); setEditingGoal(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="text-xs">تعديل</span>
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="p-3 sm:p-4 space-y-3">
                  {editingGoal ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={goalDraft}
                        onChange={(e) => setGoalDraft(e.target.value)}
                        placeholder="مثلاً 5000"
                        className="h-9"
                        autoFocus
                      />
                      <span className="text-xs text-muted-foreground">MAD</span>
                      <Button size="sm" className="h-9 gap-1" onClick={saveGoal}>
                        <Check className="h-3.5 w-3.5" /> حفظ
                      </Button>
                      <Button size="sm" variant="ghost" className="h-9" onClick={() => setEditingGoal(false)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : goal > 0 ? (
                    <>
                      <div className="flex items-end justify-between gap-2">
                        <div>
                          <p className="text-[11px] text-muted-foreground">المُنجز</p>
                          <p className={cn("text-2xl font-bold tabular-nums", stats.profit >= 0 ? "text-success" : "text-destructive")}>
                            {fmt(Math.max(0, stats.profit))} <span className="text-xs font-normal text-muted-foreground">MAD</span>
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="text-[11px] text-muted-foreground">الهدف</p>
                          <p className="text-lg font-semibold tabular-nums">{fmt(goal)} <span className="text-xs font-normal text-muted-foreground">MAD</span></p>
                        </div>
                      </div>
                      <Progress value={goalProgress} className="h-2.5" />
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          متبقي: <span className="font-semibold text-foreground tabular-nums">{fmt(Math.max(0, goal - Math.max(0, stats.profit)))}</span> MAD
                        </span>
                        <span className={cn("font-bold tabular-nums", goalProgress >= 100 ? "text-success" : "text-primary")}>
                          {goalProgress.toFixed(0)}%
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-3">
                      <p className="text-sm text-muted-foreground mb-2">لم تحدد هدفًا بعد لهذا الشهر</p>
                      <Button size="sm" onClick={() => setEditingGoal(true)} className="gap-1.5">
                        <Target className="h-3.5 w-3.5" /> حدّد الهدف
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Reveal>
          ),
          charts: (
            <Reveal show={financeReady && capcutReady} delay={250}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/50 overflow-hidden">
          <CardHeader className="flex-row items-start justify-between space-y-0 gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">الحركة المالية — آخر 14 يومًا</CardTitle>
              <CardDescription className="text-xs">المداخيل مقابل المصاريف وصافي الربح</CardDescription>
              <div className="flex flex-wrap gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  <span className="text-muted-foreground">مداخيل</span>
                  <span className="font-bold text-success">{fmt(chartData.reduce((s, d) => s + d.income, 0))}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full bg-destructive" />
                  <span className="text-muted-foreground">مصاريف</span>
                  <span className="font-bold text-destructive">{fmt(chartData.reduce((s, d) => s + d.expense, 0))}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">صافي</span>
                  <span className="font-bold text-primary">{fmt(chartData.reduce((s, d) => s + d.income - d.expense, 0))}</span>
                </div>
              </div>
            </div>
            <Badge variant="outline" className="gap-1 shrink-0">
              <CalendarClock className="h-3 w-3" /> يومي
            </Badge>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            <div className="h-56 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g-income" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g-expense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g-net" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} opacity={0.5} />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} dy={4} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} width={42} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const inc = Number(payload.find(p => p.dataKey === "income")?.value || 0);
                      const exp = Number(payload.find(p => p.dataKey === "expense")?.value || 0);
                      const net = inc - exp;
                      return (
                        <div className="rounded-xl border border-border/60 bg-popover/95 backdrop-blur-md p-3 shadow-xl text-xs min-w-[160px]">
                          <div className="font-bold text-foreground mb-2 pb-1.5 border-b border-border/40">{label}</div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full bg-success" />مداخيل</span>
                              <span className="font-semibold text-success">{fmt(inc)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full bg-destructive" />مصاريف</span>
                              <span className="font-semibold text-destructive">{fmt(exp)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-border/40">
                              <span className="text-muted-foreground">الصافي</span>
                              <span className={`font-bold ${net >= 0 ? "text-success" : "text-destructive"}`}>{fmt(net)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="expense" name="مصاريف" stroke="hsl(var(--destructive))" fill="url(#g-expense)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--background))" }} />
                  <Area type="monotone" dataKey="income" name="مداخيل" stroke="hsl(var(--success))" fill="url(#g-income)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">المداخيل مقابل المصاريف</CardTitle>
            <CardDescription className="text-xs">توزيع نشاط الشهر الحالي</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            {(() => {
              const ieData = [
                { name: "مداخيل", value: stats.income },
                { name: "مصاريف", value: stats.expense },
              ];
              const ieColors = ["hsl(var(--success))", "hsl(var(--destructive))"];
              const total = stats.income + stats.expense;
              if (total <= 0) {
                return (
                  <div className="h-48 sm:h-64 flex items-center justify-center text-sm text-muted-foreground">
                    لا توجد بيانات بعد
                  </div>
                );
              }
              return (
                <div className="h-48 sm:h-64 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={ieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {ieData.map((_, i) => (
                          <Cell key={i} fill={ieColors[i]} />
                        ))}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v: number) => `${fmt(v)} MAD`}
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center -mt-4">
                    <span className="text-[10px] text-muted-foreground">الربح الصافي</span>
                    <span className={`text-lg font-bold ${stats.profit >= 0 ? "text-success" : "text-destructive"}`}>
                      {fmt(stats.profit)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">MAD</span>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
              </div>
            </Reveal>
          ),
          forecast: (
            <Reveal show={financeReady} delay={120}>
              <Card className="border-border/50 overflow-hidden">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-info/15 text-info flex items-center justify-center">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">توقعات نهاية الشهر</CardTitle>
                      <CardDescription className="text-xs">تقدير مبني على متوسط أداء الأيام الماضية</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <CalendarClock className="h-3 w-3" /> يوم {forecast.dayOfMonth} / {forecast.daysInMonth}
                  </Badge>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-xl border border-border/50 bg-success/5 p-2.5 sm:p-3">
                      <p className="text-[10px] text-muted-foreground mb-1">مداخيل متوقعة</p>
                      <p className="text-base sm:text-xl font-bold text-success tabular-nums">{fmt(forecast.projIncome)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">متوسط {fmt(forecast.avgIncome)}/يوم</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-destructive/5 p-2.5 sm:p-3">
                      <p className="text-[10px] text-muted-foreground mb-1">مصاريف متوقعة</p>
                      <p className="text-base sm:text-xl font-bold text-destructive tabular-nums">{fmt(forecast.projExpense)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">متوسط {fmt(forecast.avgExpense)}/يوم</p>
                    </div>
                    <div className={cn("rounded-xl border p-2.5 sm:p-3", forecast.projProfit >= 0 ? "border-primary/30 bg-primary/5" : "border-warning/30 bg-warning/5")}>
                      <p className="text-[10px] text-muted-foreground mb-1">الربح المتوقع</p>
                      <p className={cn("text-base sm:text-xl font-bold tabular-nums", forecast.projProfit >= 0 ? "text-primary" : "text-warning")}>{fmt(forecast.projProfit)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{forecast.remaining} يوم متبقي</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-muted-foreground">تقدّم الشهر</span>
                      <span className="font-semibold tabular-nums">{forecast.monthProgress.toFixed(0)}%</span>
                    </div>
                    <Progress value={forecast.monthProgress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          ),
          weekday: (
            <Reveal show={financeReady} delay={280}>
              <Card className="border-border/50 overflow-hidden">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-warning/15 text-warning flex items-center justify-center">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">أفضل أيام الأسبوع</CardTitle>
                      <CardDescription className="text-xs">متوسط الربح حسب يوم الأسبوع — آخر 8 أسابيع</CardDescription>
                    </div>
                  </div>
                  {bestDay && bestDay.profit > 0 && (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Sparkles className="h-3 w-3" /> الأفضل: {bestDay.day}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="p-2 sm:p-4">
                  <div className="h-52 sm:h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weekdayData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="g-weekday" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} opacity={0.5} />
                        <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} dy={4} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickLine={false} axisLine={false} width={42} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
                        <Tooltip
                          cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const row = payload[0].payload;
                            return (
                              <div className="rounded-xl border border-border/60 bg-popover/95 backdrop-blur-md p-3 shadow-xl text-xs min-w-[160px]">
                                <div className="font-bold text-foreground mb-2 pb-1.5 border-b border-border/40">{label}</div>
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">مداخيل</span><span className="font-semibold text-success">{fmt(row.income)}</span></div>
                                  <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">مصاريف</span><span className="font-semibold text-destructive">{fmt(row.expense)}</span></div>
                                  <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-border/40"><span className="text-muted-foreground">الربح</span><span className={cn("font-bold", row.profit >= 0 ? "text-success" : "text-destructive")}>{fmt(row.profit)}</span></div>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="profit" name="ربح" radius={[8, 8, 0, 0]}>
                          {weekdayData.map((r, i) => (
                            <Cell key={i} fill={r.profit < 0 ? "hsl(var(--destructive))" : r.day === bestDay?.day && r.profit > 0 ? "hsl(var(--success))" : "url(#g-weekday)"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          ),
          recent: (
            <Reveal show={financeReady && capcutReady && unpaidReady && friendsReady} delay={350}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader>
            <CardTitle className="text-base">أحدث المعاملات</CardTitle>
            <CardDescription className="text-xs">آخر 6 معاملات مالية</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            {recentTxs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                لا توجد معاملات بعد
              </p>
            ) : (
              <ul className="divide-y divide-border/50">
                {recentTxs.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                        t.type === "income"
                          ? "bg-success/15 text-success"
                          : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {t.type === "income" ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {t.description || (t.type === "income" ? "دخل" : "مصروف")}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(t.transaction_date).toLocaleDateString("ar-MA")}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        t.type === "income" ? "text-success" : "text-destructive"
                      }`}
                    >
                      {t.type === "income" ? "+" : "−"}
                      {fmt(Number(t.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">صحة المخزون</CardTitle>
            <CardDescription className="text-xs">حالة الحسابات والمتطلبات</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">حسابات متاحة</span>
                <span className="font-semibold">
                  {stats.availableAccounts} / {stats.totalAccounts}
                </span>
              </div>
              <Progress value={stats.availabilityRate} />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">نسبة الربح</span>
                <span className="font-semibold">
                  {stats.income > 0 ? ((stats.profit / stats.income) * 100).toFixed(0) : 0}%
                </span>
              </div>
              <Progress
                value={stats.income > 0 ? Math.max(0, (stats.profit / stats.income) * 100) : 0}
              />
            </div>
            <div className="pt-2 grid grid-cols-2 gap-2">
              <Link
                to="/unpaid-numbers"
                className="rounded-lg border border-border/50 bg-card p-3 text-center"
              >
                <PhoneOff className="h-4 w-4 mx-auto mb-1 text-warning" />
                <p className="text-lg font-bold">{stats.unpaidCount}</p>
                <p className="text-[11px] text-muted-foreground">لم تُدفع</p>
              </Link>
              <Link
                to="/friend-accounts"
                className="rounded-lg border border-border/50 bg-card p-3 text-center"
              >
                <Users className="h-4 w-4 mx-auto mb-1 text-info" />
                <p className="text-lg font-bold">{friendsList.length}</p>
                <p className="text-[11px] text-muted-foreground">أصدقاء</p>
              </Link>
            </div>
          </CardContent>
        </Card>
              </div>
            </Reveal>
          ),
        };

        return (
          <DndContext sensors={sectionSensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
            <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-4 sm:space-y-6">
                {sectionOrder.map((id) => (
                  <SortableSection key={id} id={id} reorderMode={reorderMode}>
                    {sectionContent[id]}
                  </SortableSection>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        );
      })()}
    </div>
  );
}

function SortableSection({ id, reorderMode, children }: { id: string; reorderMode: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !reorderMode });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className={cn("relative", reorderMode && "ring-2 ring-primary/30 rounded-2xl")}>
      {reorderMode && (
        <button
          {...attributes}
          {...listeners}
          className="absolute -top-2 -right-2 z-10 h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing"
          title="اسحب لإعادة الترتيب"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      {children}
    </div>
  );
}
