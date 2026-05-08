import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Save, X, Trash2, TrendingUp, TrendingDown, Wallet, Archive, CheckSquare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import FinancialAnalytics from "@/components/finance/FinancialAnalytics";

type Transaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  transaction_date: string;
};

export default function Finance() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newData, setNewData] = useState({ type: "income" as "income" | "expense", amount: "", description: "", transaction_date: new Date().toISOString().split("T")[0] });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const currentMonth = new Date().toISOString().substring(0, 7);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["financial_transactions"],
    queryFn: async () => {
      // Auto-archive previous months' transactions
      const { error: archiveError } = await supabase
        .from("financial_transactions")
        .update({ archived: true })
        .eq("archived", false)
        .lt("transaction_date", `${currentMonth}-01`);
      if (archiveError) console.error("Auto-archive error:", archiveError);

      const { data, error } = await supabase.from("financial_transactions").select("*").eq("archived", false).gte("transaction_date", `${currentMonth}-01`).order("transaction_date", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("financial_transactions").update({ archived: true }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_transactions"] });
      setSelectedIds(new Set());
      toast.success("تم الأرشفة بنجاح");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addMutation = useMutation({
    mutationFn: async (t: Omit<Transaction, "id">) => {
      const { error } = await supabase.from("financial_transactions").insert({ ...t, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_transactions"] });
      setAdding(false);
      setNewData({ type: "income", amount: "", description: "", transaction_date: new Date().toISOString().split("T")[0] });
      toast.success("تمت الإضافة");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_transactions"] });
      setDeleteId(null);
      toast.success("تم الحذف");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = filterType === "all" ? transactions : transactions.filter(t => t.type === filterType);

  const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  const handleAdd = () => {
    if (!newData.amount || Number(newData.amount) <= 0) { toast.error("يرجى إدخال مبلغ صحيح"); return; }
    addMutation.mutate({
      type: newData.type,
      amount: Number(newData.amount),
      description: newData.description,
      transaction_date: newData.transaction_date,
    });
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">الإدارة المالية</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate({ to: "/finance-archive" })} className="gap-1.5 text-xs">
            <Archive className="h-3.5 w-3.5" /> الأرشيف
          </Button>
          {selectedIds.size > 0 && (
            <Button size="sm" variant="secondary" onClick={() => archiveMutation.mutate(Array.from(selectedIds))} disabled={archiveMutation.isPending} className="gap-1.5 text-xs">
              <Archive className="h-3.5 w-3.5" /> أرشفة ({selectedIds.size})
            </Button>
          )}
          {!adding && (
            <Button size="sm" onClick={() => setAdding(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> إضافة معاملة
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-success/20 bg-success/5">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">الإيرادات</p>
              <p className="text-sm font-bold text-success">{totalIncome.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">المصاريف</p>
              <p className="text-sm font-bold text-destructive">{totalExpense.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("border-border/50", balance >= 0 ? "bg-primary/5 border-primary/20" : "bg-destructive/5 border-destructive/20")}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">
              <Wallet className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">الرصيد</p>
              <p className={cn("text-sm font-bold", balance >= 0 ? "text-primary" : "text-destructive")}>{balance.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="income">إيرادات</SelectItem>
            <SelectItem value="expense">مصاريف</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Add Form */}
      {adding && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setNewData({ ...newData, type: "income" })}
                className={cn("flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all",
                  newData.type === "income" ? "border-success/50 bg-success/10 text-success" : "border-border/50 text-muted-foreground"
                )}
              >إيراد</button>
              <button
                onClick={() => setNewData({ ...newData, type: "expense" })}
                className={cn("flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all",
                  newData.type === "expense" ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-border/50 text-muted-foreground"
                )}
              >مصروف</button>
            </div>
            <Input type="number" placeholder="المبلغ" value={newData.amount} onChange={(e) => setNewData({ ...newData, amount: e.target.value })} className="h-9 text-sm" dir="ltr" />
            <Input placeholder="الوصف (اختياري)" value={newData.description} onChange={(e) => setNewData({ ...newData, description: e.target.value })} className="h-9 text-sm" />
            <Input type="date" value={newData.transaction_date} onChange={(e) => setNewData({ ...newData, transaction_date: e.target.value })} className="h-9 text-sm" dir="ltr" />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>إلغاء</Button>
              <Button size="sm" onClick={handleAdd} disabled={addMutation.isPending}>حفظ</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground animate-pulse text-sm">جاري التحميل...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Wallet className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">لا توجد معاملات</p>
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto space-y-1.5 scrollbar-hide">
          {filtered.map((t) => {
            const isIncome = t.type === "income";
            return (
              <Card key={t.id} className={cn("border-r-4 transition-colors hover:bg-muted/20", isIncome ? "border-success/40" : "border-destructive/40")}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedIds.has(t.id)}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedIds);
                        if (checked) next.add(t.id); else next.delete(t.id);
                        setSelectedIds(next);
                      }}
                      className="h-4 w-4"
                    />
                    <div className={cn("h-7 w-7 rounded-full flex items-center justify-center", isIncome ? "bg-success/10" : "bg-destructive/10")}>
                      {isIncome ? <TrendingUp className="h-3.5 w-3.5 text-success" /> : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t.description || (isIncome ? "إيراد" : "مصروف")}</p>
                      <p className="text-[10px] text-muted-foreground">{t.transaction_date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-bold", isIncome ? "text-success" : "text-destructive")}>
                      {isIncome ? "+" : "-"}{Number(t.amount).toFixed(2)}
                    </span>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Analytics */}
      <FinancialAnalytics transactions={transactions} />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذه المعاملة؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
