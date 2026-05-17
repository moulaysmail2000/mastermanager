import { useState } from "react";
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
import { Plus, Minus, UserPlus, Trash2, Wallet, ArrowDownCircle, ArrowUpCircle, Wifi } from "lucide-react";
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

export default function FriendAccounts() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [newAcc, setNewAcc] = useState({ owner_name: "", bank_name: "", notes: "" });

  const [txDialog, setTxDialog] = useState<{ acc: FriendAccount; type: "deposit" | "withdraw" } | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">حسابات الأصدقاء</h1>
          
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
          <UserPlus className="h-3.5 w-3.5" /> إضافة حساب
        </Button>
      </div>

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
            const cardBg =
              status === "owes-me"
                ? "bg-[linear-gradient(135deg,#064e3b_0%,#0f1a14_55%,#000000_100%)]"
                : status === "i-owe"
                ? "bg-[linear-gradient(135deg,#3f0a18_0%,#1a0a0e_55%,#000000_100%)]"
                : "bg-[linear-gradient(135deg,#1e293b_0%,#0f172a_55%,#000000_100%)]";
            const accentColor =
              status === "owes-me" ? "#34d399" : status === "i-owe" ? "#fb7185" : "#cbd5e1";
            return (
            <div key={a.id} className="group space-y-2">
              {/* Bank card */}
              <div
                className={`relative ${cardBg} text-white rounded-2xl p-5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] aspect-[1.586/1] overflow-hidden transition-all hover:shadow-[0_20px_60px_-12px_rgba(0,0,0,0.7)] hover:-translate-y-0.5`}
                dir="ltr"
              >
                {/* Decorative glow */}
                <div
                  className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full opacity-20 blur-3xl"
                  style={{ background: accentColor }}
                />
                <div className="pointer-events-none absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_30%_120%,#fff_0%,transparent_50%)]" />
                {/* Holographic stripe */}
                <div
                  className="pointer-events-none absolute top-0 right-0 h-full w-24 opacity-30"
                  style={{
                    background:
                      "linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)",
                  }}
                />

                {/* Top row: bank + delete */}
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.25em] text-white/50 font-medium">
                      Wallet
                    </p>
                    <p className="text-sm font-bold mt-0.5 tracking-wide" style={{ color: accentColor }}>
                      {a.bank_name}
                    </p>
                  </div>
                  <button
                    onClick={() => setDeleteId(a.id)}
                    className="text-white/30 hover:text-rose-400 transition opacity-0 group-hover:opacity-100"
                    aria-label="حذف"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Chip + wifi */}
                <div className="relative flex items-center gap-2 mt-5">
                  <div className="h-7 w-9 rounded-md bg-gradient-to-br from-yellow-200 via-yellow-400 to-yellow-600 shadow-inner relative overflow-hidden">
                    <div className="absolute inset-1 border border-yellow-700/40 rounded-sm" />
                    <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 h-px bg-yellow-700/40" />
                  </div>
                  <Wifi className="h-3.5 w-3.5 text-white/40 rotate-90" />
                </div>

                {/* Net amount */}
                <div className="relative mt-3">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-medium">
                    {status === "owes-me" ? "He owes" : status === "i-owe" ? "You owe" : "Net"}
                  </p>
                  <p
                    className="text-2xl font-extrabold tabular-nums tracking-tight mt-0.5"
                    style={{ color: accentColor, fontFamily: "'Inter', system-ui, sans-serif" }}
                  >
                    {fmt(Math.abs(net))}
                  </p>
                </div>

                {/* Cardholder row */}
                <div className="relative flex items-end justify-between mt-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[8px] uppercase tracking-[0.25em] text-white/40">Card Holder</p>
                    <p
                      className="text-sm font-semibold tracking-wide truncate text-white/95"
                      dir="rtl"
                      style={{ fontFamily: "'Cairo', 'Tajawal', system-ui, sans-serif" }}
                    >
                      {a.owner_name}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[8px] uppercase tracking-[0.25em] text-white/40">Sent / Received</p>
                    <p className="text-[10px] font-semibold tabular-nums text-white/80 mt-0.5">
                      <span className="text-emerald-300">+{fmt(totalSent)}</span>
                      <span className="text-white/30 mx-1">/</span>
                      <span className="text-rose-300">-{fmt(totalReceived)}</span>
                    </p>
                  </div>
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
          <h2 className="text-sm font-bold mb-3 text-foreground">سجل الحركات</h2>
          {txs.length === 0 ? (
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
                  {txs.map((t) => (
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
          )}
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
