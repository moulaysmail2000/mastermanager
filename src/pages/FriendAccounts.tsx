import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Minus, UserPlus, Trash2, Wallet, ArrowDownCircle, ArrowUpCircle, Wifi, Palette, Check, TrendingUp, TrendingDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type FriendAccount = {
  id: string;
  owner_name: string;
  bank_name: string;
  balance: number;
  notes: string | null;
};

type FriendTx = {
  id: string;
  account_id: string;
  type: "deposit" | "withdraw";
  amount: number;
  note: string | null;
  created_at: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " DH";

/* ───── Card Theme System ───── */
type CardTheme = {
  id: string;
  name: string;
  swatch: string;
  /** When statusAware = true, the accent flips green/red/slate based on net. */
  statusAware?: boolean;
  bg: string; // gradient css value
  accent: string; // hex
  chip: string; // tailwind classes for the chip
};

const CARD_THEMES: CardTheme[] = [
  {
    id: "noir",
    name: "Noir Status",
    swatch: "linear-gradient(135deg,#064e3b,#0f172a,#3f0a18)",
    statusAware: true,
    bg: "", // computed per card
    accent: "",
    chip: "from-yellow-200 via-yellow-400 to-yellow-600",
  },
  {
    id: "royal",
    name: "Royal Gold",
    swatch: "linear-gradient(135deg,#1a0033,#3b0764,#000)",
    bg: "linear-gradient(135deg,#1a0033 0%,#2e0a4f 55%,#000000 100%)",
    accent: "#fbbf24",
    chip: "from-yellow-200 via-yellow-400 to-yellow-700",
  },
  {
    id: "ocean",
    name: "Deep Ocean",
    swatch: "linear-gradient(135deg,#082f49,#0c4a6e,#000)",
    bg: "linear-gradient(135deg,#082f49 0%,#0c4a6e 55%,#020617 100%)",
    accent: "#38bdf8",
    chip: "from-slate-200 via-slate-400 to-slate-600",
  },
  {
    id: "sunset",
    name: "Sunset",
    swatch: "linear-gradient(135deg,#7c2d12,#9f1239,#000)",
    bg: "linear-gradient(135deg,#7c2d12 0%,#9f1239 55%,#0a0a0a 100%)",
    accent: "#fdba74",
    chip: "from-orange-200 via-orange-400 to-amber-600",
  },
  {
    id: "forest",
    name: "Forest",
    swatch: "linear-gradient(135deg,#022c22,#064e3b,#000)",
    bg: "linear-gradient(135deg,#022c22 0%,#064e3b 55%,#0a0a0a 100%)",
    accent: "#6ee7b7",
    chip: "from-emerald-200 via-emerald-400 to-emerald-700",
  },
  {
    id: "platinum",
    name: "Platinum",
    swatch: "linear-gradient(135deg,#f1f5f9,#cbd5e1,#94a3b8)",
    bg: "linear-gradient(135deg,#f8fafc 0%,#e2e8f0 55%,#cbd5e1 100%)",
    accent: "#0f172a",
    chip: "from-slate-300 via-slate-400 to-slate-600",
  },
  {
    id: "cosmic",
    name: "Cosmic",
    swatch: "linear-gradient(135deg,#312e81,#7c3aed,#db2777)",
    bg: "linear-gradient(135deg,#1e1b4b 0%,#4c1d95 50%,#831843 100%)",
    accent: "#f0abfc",
    chip: "from-fuchsia-200 via-fuchsia-400 to-purple-600",
  },
  {
    id: "carbon",
    name: "Carbon",
    swatch: "linear-gradient(135deg,#18181b,#27272a,#000)",
    bg: "linear-gradient(135deg,#18181b 0%,#0a0a0a 55%,#000000 100%)",
    accent: "#e4e4e7",
    chip: "from-zinc-300 via-zinc-500 to-zinc-700",
  },
];

const THEME_STORE_KEY = "wallet_card_themes_v1";
const GLOBAL_THEME_KEY = "wallet_global_theme_v1";

export default function FriendAccounts() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [newAcc, setNewAcc] = useState({ owner_name: "", bank_name: "", notes: "" });

  const [txDialog, setTxDialog] = useState<{ acc: FriendAccount; type: "deposit" | "withdraw" } | null>(null);
  const [amount, setAmount] = useState("");
  const [txFilter, setTxFilter] = useState<string>("all");
  const [note, setNote] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Per-card theme overrides + global default
  const [globalTheme, setGlobalTheme] = useState<string>(() => {
    if (typeof window === "undefined") return "noir";
    return localStorage.getItem(GLOBAL_THEME_KEY) || "noir";
  });
  const [cardThemes, setCardThemes] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(THEME_STORE_KEY) || "{}"); } catch { return {}; }
  });
  useEffect(() => { localStorage.setItem(GLOBAL_THEME_KEY, globalTheme); }, [globalTheme]);
  useEffect(() => { localStorage.setItem(THEME_STORE_KEY, JSON.stringify(cardThemes)); }, [cardThemes]);
  const setCardTheme = (id: string, themeId: string) =>
    setCardThemes((p) => ({ ...p, [id]: themeId }));
  const getTheme = (id: string): CardTheme =>
    CARD_THEMES.find((t) => t.id === (cardThemes[id] || globalTheme)) || CARD_THEMES[0];

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["friend_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("friend_accounts").select("*").order("created_at");
      if (error) throw error;
      return data as FriendAccount[];
    },
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["friend_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friend_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as FriendTx[];
    },
  });

  const createAccount = useMutation({
    mutationFn: async () => {
      if (!newAcc.owner_name.trim() || !newAcc.bank_name.trim()) throw new Error("املأ الحقول المطلوبة");
      const { error } = await supabase.from("friend_accounts").insert({
        user_id: user!.id,
        owner_name: newAcc.owner_name.trim(),
        bank_name: newAcc.bank_name.trim(),
        notes: newAcc.notes.trim() || null,
        balance: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friend_accounts"] });
      setAddOpen(false);
      setNewAcc({ owner_name: "", bank_name: "", notes: "" });
      toast.success("تمت إضافة الحساب");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submitTx = useMutation({
    mutationFn: async () => {
      if (!txDialog) return;
      const amt = parseFloat(amount);
      if (!amt || amt <= 0) throw new Error("أدخل مبلغاً صحيحاً");
      const newBalance =
        txDialog.type === "deposit" ? Number(txDialog.acc.balance) + amt : Number(txDialog.acc.balance) - amt;

      const { error: txErr } = await supabase.from("friend_transactions").insert({
        user_id: user!.id,
        account_id: txDialog.acc.id,
        type: txDialog.type,
        amount: amt,
        note: note.trim() || null,
      });
      if (txErr) throw txErr;

      const { error: upErr } = await supabase
        .from("friend_accounts")
        .update({ balance: newBalance })
        .eq("id", txDialog.acc.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friend_accounts"] });
      qc.invalidateQueries({ queryKey: ["friend_transactions"] });
      setTxDialog(null);
      setAmount("");
      setNote("");
      toast.success("تمت العملية");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("friend_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friend_accounts"] });
      qc.invalidateQueries({ queryKey: ["friend_transactions"] });
      setDeleteId(null);
      toast.success("تم حذف الحساب");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const accName = (id: string) => accounts.find((a) => a.id === id)?.owner_name ?? "—";

  // Aggregated totals across all accounts
  const grand = accounts.reduce(
    (acc, a) => {
      const accTxs = txs.filter((t) => t.account_id === a.id);
      const sent = accTxs.filter((t) => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0);
      const recv = accTxs.filter((t) => t.type === "withdraw").reduce((s, t) => s + Number(t.amount), 0);
      const n = sent - recv;
      if (n > 0) acc.owedToMe += n;
      else if (n < 0) acc.iOwe += Math.abs(n);
      return acc;
    },
    { owedToMe: 0, iOwe: 0 },
  );
  const netAll = grand.owedToMe - grand.iOwe;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">حسابات الأصدقاء</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">إدارة الأرصدة والديون مع الأصدقاء</p>
        </div>
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8" title="ثيم البطاقات">
                <Palette className="h-3.5 w-3.5" />
                <span className="text-xs">ثيم</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs">ثيم البطاقات الافتراضي</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {CARD_THEMES.map((t) => (
                <DropdownMenuItem key={t.id} onClick={() => setGlobalTheme(t.id)} className="gap-2 text-xs cursor-pointer">
                  <span className="h-4 w-6 rounded border border-border/60 shrink-0" style={{ background: t.swatch }} />
                  <span className="flex-1">{t.name}</span>
                  {globalTheme === t.id && <Check className="h-3.5 w-3.5" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 h-8">
            <UserPlus className="h-3.5 w-3.5" /> إضافة حساب
          </Button>
        </div>
      </div>

      {/* Summary header */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold">
              <TrendingUp className="h-3 w-3" /> لي عند الآخرين
            </div>
            <p className="text-base sm:text-lg font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
              {fmt(grand.owedToMe)}
            </p>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 to-rose-500/5 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-rose-700 dark:text-rose-400 font-semibold">
              <TrendingDown className="h-3 w-3" /> عليّ للآخرين
            </div>
            <p className="text-base sm:text-lg font-extrabold tabular-nums text-rose-700 dark:text-rose-400 mt-1">
              {fmt(grand.iOwe)}
            </p>
          </div>
          <div className={`rounded-xl border p-3 ${netAll >= 0 ? "border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5" : "border-rose-500/30 bg-gradient-to-br from-rose-500/10 to-rose-500/5"}`}>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              <Wallet className="h-3 w-3" /> الصافي
            </div>
            <p className={`text-base sm:text-lg font-extrabold tabular-nums mt-1 ${netAll >= 0 ? "text-primary" : "text-rose-600 dark:text-rose-400"}`}>
              {fmt(Math.abs(netAll))}
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground animate-pulse text-sm">جاري التحميل...</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Wallet className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">لا توجد حسابات بعد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((a) => {
            const accTxs = txs.filter((t) => t.account_id === a.id);
            const totalSent = accTxs.filter((t) => t.type === "deposit").reduce((s, t) => s + Number(t.amount), 0);
            const totalReceived = accTxs.filter((t) => t.type === "withdraw").reduce((s, t) => s + Number(t.amount), 0);
            const net = totalSent - totalReceived;
            const status: "owes-me" | "i-owe" | "even" = net > 0 ? "owes-me" : net < 0 ? "i-owe" : "even";
            const theme = getTheme(a.id);
            const cardBgStyle = theme.statusAware
              ? {
                  background:
                    status === "owes-me"
                      ? "linear-gradient(135deg,#064e3b 0%,#0f1a14 55%,#000000 100%)"
                      : status === "i-owe"
                      ? "linear-gradient(135deg,#3f0a18 0%,#1a0a0e 55%,#000000 100%)"
                      : "linear-gradient(135deg,#1e293b 0%,#0f172a 55%,#000000 100%)",
                }
              : { background: theme.bg };
            const accentColor = theme.statusAware
              ? status === "owes-me" ? "#34d399" : status === "i-owe" ? "#fb7185" : "#cbd5e1"
              : theme.accent;
            const isLight = theme.id === "platinum";
            const textBase = isLight ? "text-slate-900" : "text-white";
            const subtle = isLight ? "text-slate-600" : "text-white/50";
            const subtleSoft = isLight ? "text-slate-500" : "text-white/40";
            return (
            <div key={a.id} className="group space-y-2">
              {/* Bank card */}
              <div
                style={cardBgStyle}
                className={`relative ${textBase} rounded-2xl p-5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] aspect-[1.586/1] overflow-hidden transition-all duration-300 hover:shadow-[0_24px_70px_-15px_rgba(0,0,0,0.75)] hover:-translate-y-1 ring-1 ${isLight ? "ring-slate-300/60" : "ring-white/5"}`}
                dir="ltr"
              >
                {/* Decorative glow */}
                <div
                  className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-25 blur-3xl"
                  style={{ background: accentColor }}
                />
                <div className={`pointer-events-none absolute inset-0 opacity-[0.06] ${isLight ? "bg-[radial-gradient(circle_at_30%_120%,#000_0%,transparent_50%)]" : "bg-[radial-gradient(circle_at_30%_120%,#fff_0%,transparent_50%)]"}`} />
                {/* Subtle grid pattern */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.04]"
                  style={{
                    backgroundImage: `linear-gradient(${isLight ? "#000" : "#fff"} 1px,transparent 1px),linear-gradient(90deg,${isLight ? "#000" : "#fff"} 1px,transparent 1px)`,
                    backgroundSize: "22px 22px",
                  }}
                />
                {/* Holographic stripe */}
                <div
                  className="pointer-events-none absolute top-0 right-0 h-full w-24 opacity-30"
                  style={{
                    background:
                      `linear-gradient(135deg, transparent 30%, ${isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.18)"} 50%, transparent 70%)`,
                  }}
                />

                {/* Top row: bank + delete */}
                <div className="relative flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-[8px] uppercase tracking-[0.32em] ${subtle} font-semibold font-display`}>
                      Wallet
                    </p>
                    <p className="text-[15px] font-bold mt-0.5 tracking-tight font-display" style={{ color: accentColor }}>
                      {a.bank_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition" dir="rtl">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={`${isLight ? "text-slate-500 hover:text-slate-900" : "text-white/40 hover:text-white"} transition`}
                          aria-label="تغيير اللون"
                          title="تغيير لون البطاقة"
                        >
                          <Palette className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel className="text-[10px]">لون هذه البطاقة</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {CARD_THEMES.map((t) => (
                          <DropdownMenuItem
                            key={t.id}
                            onClick={() => setCardTheme(a.id, t.id)}
                            className="gap-2 text-xs cursor-pointer"
                          >
                            <span className="h-3.5 w-5 rounded border border-border/60 shrink-0" style={{ background: t.swatch }} />
                            <span className="flex-1">{t.name}</span>
                            {(cardThemes[a.id] || globalTheme) === t.id && <Check className="h-3 w-3" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button
                      onClick={() => setDeleteId(a.id)}
                      className={`${isLight ? "text-slate-500 hover:text-rose-600" : "text-white/40 hover:text-rose-400"} transition`}
                      aria-label="حذف"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Chip + wifi */}
                <div className="relative flex items-center gap-2.5 mt-4">
                  <div className={`h-8 w-10 rounded-md bg-gradient-to-br ${theme.chip} shadow-[inset_0_1px_2px_rgba(0,0,0,0.4),0_1px_0_rgba(255,255,255,0.2)] relative overflow-hidden`}>
                    {/* refined chip lines */}
                    <div className="absolute inset-[3px] rounded-[3px] border border-black/40" />
                    <div className="absolute left-[3px] right-[3px] top-1/2 -translate-y-1/2 h-px bg-black/40" />
                    <div className="absolute top-[3px] bottom-[3px] left-1/2 -translate-x-1/2 w-px bg-black/40" />
                    <div className="absolute left-[3px] right-[3px] top-[30%] h-px bg-black/25" />
                    <div className="absolute left-[3px] right-[3px] top-[70%] h-px bg-black/25" />
                  </div>
                  <Wifi className={`h-3.5 w-3.5 ${subtleSoft} rotate-90`} />
                  {/* Status pill — pushed to far right */}
                  <span
                    className="ml-auto text-[8px] uppercase tracking-[0.2em] font-bold px-2 py-1 rounded-full font-display"
                    style={{
                      background:
                        status === "owes-me"
                          ? "rgba(52,211,153,0.18)"
                          : status === "i-owe"
                          ? "rgba(251,113,133,0.18)"
                          : isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)",
                      color:
                        status === "owes-me"
                          ? "#34d399"
                          : status === "i-owe"
                          ? "#fb7185"
                          : isLight ? "#475569" : "#cbd5e1",
                    }}
                  >
                    {status === "owes-me" ? "Credit" : status === "i-owe" ? "Debit" : "Settled"}
                  </span>
                </div>

                {/* Net amount */}
                <div className="relative mt-3">
                  <p className={`text-[8px] uppercase tracking-[0.32em] ${subtleSoft} font-semibold font-display`}>
                    {status === "owes-me" ? "Owed to you" : status === "i-owe" ? "You owe" : "Net balance"}
                  </p>
                  <p
                    className="text-[28px] font-extrabold tracking-tight mt-1 font-mono-num leading-none"
                    style={{ color: accentColor }}
                  >
                    {fmt(Math.abs(net))}
                  </p>
                </div>

                {/* Masked card number — decorative */}
                <div className={`relative mt-3 flex items-center gap-2 text-[11px] font-mono-num tracking-[0.18em] ${isLight ? "text-slate-500" : "text-white/55"}`}>
                  <span>••••</span>
                  <span>••••</span>
                  <span>••••</span>
                  <span className={isLight ? "text-slate-700" : "text-white/80"}>
                    {a.id.replace(/[^0-9]/g, "").padStart(4, "0").slice(-4)}
                  </span>
                </div>

                {/* Cardholder row — single line, no overflow */}
                <div className="relative flex items-end justify-between mt-2 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={`text-[7px] uppercase tracking-[0.32em] ${subtleSoft} font-semibold font-display`}>Card Holder</p>
                    <p
                      className={`text-[13px] font-bold tracking-wide truncate mt-0.5 font-arabic ${isLight ? "text-slate-900" : "text-white"}`}
                      dir="rtl"
                    >
                      {a.owner_name}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-[7px] uppercase tracking-[0.32em] ${subtleSoft} font-semibold font-display`}>Valid Thru</p>
                    <p className={`text-[12px] font-bold tabular-nums mt-0.5 font-mono-num ${isLight ? "text-slate-900" : "text-white"}`}>
                      ∞ / ∞
                    </p>
                  </div>
                </div>
              </div>

              {/* Sent / Received chips — outside card, no overflow */}
              <div className="grid grid-cols-2 gap-1.5 px-1 pt-1">
                <div className="flex items-center justify-between gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1">
                  <span className="text-[9px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400 font-display flex items-center gap-1">
                    <ArrowUpCircle className="h-2.5 w-2.5" /> Sent
                  </span>
                  <span className="text-[10px] font-bold font-mono-num text-emerald-700 dark:text-emerald-400">
                    {fmt(totalSent)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 rounded-lg bg-rose-500/10 border border-rose-500/20 px-2 py-1">
                  <span className="text-[9px] uppercase tracking-wider font-semibold text-rose-700 dark:text-rose-400 font-display flex items-center gap-1">
                    <ArrowDownCircle className="h-2.5 w-2.5" /> Recv
                  </span>
                  <span className="text-[10px] font-bold font-mono-num text-rose-700 dark:text-rose-400">
                    {fmt(totalReceived)}
                  </span>
                </div>
              </div>

              {/* Actions below card */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  onClick={() => setTxDialog({ acc: a, type: "deposit" })}
                  className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
                >
                  <Plus className="h-3 w-3" /> أرسلت له
                </Button>
                <Button
                  size="sm"
                  onClick={() => setTxDialog({ acc: a, type: "withdraw" })}
                  className="h-8 gap-1 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl"
                >
                  <Minus className="h-3 w-3" /> أرسل لي
                </Button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Mini Transaction Log */}
      <Card className="border-border/50">
        <CardContent className="pt-5">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="text-sm font-bold text-foreground">سجل الحركات</h2>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">تصفية حسب البطاقة:</Label>
              <Select value={txFilter} onValueChange={setTxFilter}>
                <SelectTrigger className="h-8 text-xs w-[200px]">
                  <SelectValue placeholder="كل البطاقات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل البطاقات</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.owner_name} — {a.bank_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(() => {
            const filteredTxs = txFilter === "all" ? txs : txs.filter((t) => t.account_id === txFilter);
            return filteredTxs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">لا توجد عمليات بعد</p>
          ) : (
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs">التاريخ</TableHead>
                    <TableHead className="text-xs">الحساب</TableHead>
                    <TableHead className="text-xs">النوع</TableHead>
                    <TableHead className="text-xs">المبلغ</TableHead>
                    <TableHead className="text-xs">ملاحظة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTxs.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(t.created_at).toLocaleString("fr-MA", { dateStyle: "short", timeStyle: "short" })}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{accName(t.account_id)}</TableCell>
                      <TableCell>
                        {t.type === "deposit" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                            <ArrowDownCircle className="h-3 w-3" /> إضافة
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-destructive text-xs font-medium">
                            <ArrowUpCircle className="h-3 w-3" /> خصم
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-xs font-bold tabular-nums ${
                          t.type === "deposit" ? "text-emerald-600" : "text-destructive"
                        }`}
                      >
                        {t.type === "deposit" ? "+" : "-"} {fmt(Number(t.amount))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {t.note || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Add Account Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة حساب صديق</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">اسم صاحب الحساب</Label>
              <Input
                value={newAcc.owner_name}
                onChange={(e) => setNewAcc({ ...newAcc, owner_name: e.target.value })}
                placeholder="مثلاً: أيوب"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">اسم البنك</Label>
              <Input
                value={newAcc.bank_name}
                onChange={(e) => setNewAcc({ ...newAcc, bank_name: e.target.value })}
                placeholder="مثلاً: CIH"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ملاحظات (اختياري)</Label>
              <Textarea
                value={newAcc.notes}
                onChange={(e) => setNewAcc({ ...newAcc, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={() => createAccount.mutate()} disabled={createAccount.isPending}>
              حفظ
            </Button>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Dialog */}
      <Dialog
        open={!!txDialog}
        onOpenChange={(o) => {
          if (!o) {
            setTxDialog(null);
            setAmount("");
            setNote("");
          }
        }}
      >
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {txDialog?.type === "deposit" ? (
                <>
                  <ArrowDownCircle className="h-5 w-5 text-emerald-600" /> إضافة رصيد — {txDialog?.acc.owner_name}
                </>
              ) : (
                <>
                  <ArrowUpCircle className="h-5 w-5 text-destructive" /> خصم رصيد — {txDialog?.acc.owner_name}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">المبلغ (DH)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ملاحظة / السبب</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="سبب العملية..."
              />
            </div>
            {txDialog && (
              <div className="bg-muted/40 rounded-lg p-2.5 text-xs flex justify-between">
                <span className="text-muted-foreground">الرصيد بعد العملية:</span>
                <span className="font-bold tabular-nums">
                  {fmt(
                    Number(txDialog.acc.balance) +
                      (txDialog.type === "deposit" ? 1 : -1) * (parseFloat(amount) || 0),
                  )}
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button
              onClick={() => submitTx.mutate()}
              disabled={submitTx.isPending}
              className={
                txDialog?.type === "deposit"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-destructive hover:bg-destructive/90"
              }
            >
              تأكيد
            </Button>
            <Button variant="outline" onClick={() => setTxDialog(null)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الحساب؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الحساب وجميع حركاته نهائياً. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteAccount.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
