import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Archive, Calendar, Wallet, Download, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Transaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  transaction_date: string;
};

type PeriodSummary = {
  label: string;
  key: string;
  income: number;
  expense: number;
  profit: number;
  transactions: Transaction[];
};

function groupByMonth(transactions: Transaction[]): PeriodSummary[] {
  const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const groups: Record<string, Transaction[]> = {};

  for (const t of transactions) {
    const key = t.transaction_date.substring(0, 7);
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, txns]) => {
      const [year, month] = key.split("-");
      const income = txns.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const expense = txns.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      return {
        label: `${months[parseInt(month) - 1]} ${year}`,
        key,
        income,
        expense,
        profit: income - expense,
        transactions: txns.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
      };
    });
}

export default function FinanceArchive() {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["financial_transactions_archived"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .eq("archived", true)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });

  const grouped = groupByMonth(transactions);

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const tables = ["account_categories", "financial_transactions", "capcut_accounts", "bank_accounts", "prices", "unpaid_numbers", "message_templates", "expiry_dates", "friend_accounts", "friend_transactions", "user_settings"] as const;
      const allData: Record<string, any[]> = {};

      for (const table of tables) {
        const pageSize = 1000;
        let from = 0;
        const all: any[] = [];
        while (true) {
          const { data, error } = await supabase.from(table).select("*").range(from, from + pageSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < pageSize) break;
          from += pageSize;
        }
        allData[table] = all;
      }

      let csv = "";
      for (const [table, rows] of Object.entries(allData)) {
        const tableLabel = {
          account_categories: "تصنيفات الحسابات",
          financial_transactions: "المعاملات المالية",
          capcut_accounts: "حسابات CapCut",
          bank_accounts: "الحسابات البنكية",
          prices: "الأسعار",
          unpaid_numbers: "أرقام لم تدفع",
          message_templates: "القوالب",
          expiry_dates: "تواريخ الانتهاء",
          friend_accounts: "حسابات الأصدقاء",
          friend_transactions: "معاملات الأصدقاء",
          user_settings: "الإعدادات",
        }[table] || table;

        csv += `\n=== ${tableLabel} (${table}) ===\n`;
        if (rows.length > 0) {
          const headers = Object.keys(rows[0]);
          csv += headers.join(",") + "\n";
          for (const row of rows) {
            csv += headers.map(h => {
              const raw = row[h];
              // الكائنات والمصفوفات تُسلسل JSON حتى لا تخرج [object Object]
              const str =
                raw === null || raw === undefined
                  ? ""
                  : typeof raw === "object"
                  ? JSON.stringify(raw)
                  : String(raw);
              const val = str.replace(/"/g, '""');
              // أي حرف خاص (فاصلة، سطر جديد، CR، علامة اقتباس) يستوجب التغليف
              return /[",\n\r]/.test(str) ? `"${val}"` : val;
            }).join(",") + "\n";
          }
        } else {
          csv += "لا توجد بيانات\n";
        }
      }

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير جميع البيانات بنجاح");
    } catch (e: any) {
      toast.error("فشل التصدير: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  const parseCsvLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else {
        if (ch === ',') { out.push(cur); cur = ""; }
        else if (ch === '"') inQ = true;
        else cur += ch;
      }
    }
    out.push(cur);
    return out;
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      const text = (await file.text()).replace(/^\uFEFF/, "");
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("يجب تسجيل الدخول");

      const allowed = ["account_categories", "financial_transactions", "capcut_accounts", "bank_accounts", "prices", "unpaid_numbers", "message_templates", "expiry_dates", "friend_accounts", "friend_transactions", "user_settings"] as const;
      const sections = text.split(/\n=== .*? \((.*?)\) ===\n/);
      let totalInserted = 0;
      const errors: string[] = [];
      const notNullText: Record<string, Set<string>> = {
        account_categories: new Set(["name"]),
        financial_transactions: new Set(["description", "type", "transaction_date"]),
        capcut_accounts: new Set(["username", "password_or_code", "plan_type", "status"]),
        bank_accounts: new Set(["bank_name", "account_number", "iban", "beneficiary_name"]),
        prices: new Set(["plan_type", "currency"]),
        unpaid_numbers: new Set(["phone_number", "status"]),
        message_templates: new Set(["title", "content"]),
        expiry_dates: new Set(["phone_number"]),
        friend_accounts: new Set(["owner_name", "bank_name"]),
        friend_transactions: new Set(["type"]),
        user_settings: new Set(["setting_key", "setting_value"]),
      };
      const skipFields = new Set(["created_at", "updated_at"]);

      // Parse all sections first into a map so we can control insertion order
      const tableData: Record<string, any[]> = {};
      for (let i = 1; i < sections.length; i += 2) {
        const table = sections[i].trim();
        if (!(allowed as readonly string[]).includes(table)) continue;
        const block = sections[i + 1] || "";
        const lines = block.split("\n").filter(l => l.trim() && l.trim() !== "لا توجد بيانات");
        if (lines.length < 2) continue;
        const headers = parseCsvLine(lines[0]);
        const rows: any[] = [];
        for (let j = 1; j < lines.length; j++) {
          const vals = parseCsvLine(lines[j]);
          if (vals.length !== headers.length) continue;
          const obj: any = {};
          headers.forEach((h, k) => {
            if (skipFields.has(h)) return;
            const v = vals[k];
            if (h === "user_id") return;
            if (v === "") {
              obj[h] = notNullText[table]?.has(h) ? "" : null;
            } else {
              obj[h] = v;
            }
          });
          obj.user_id = userId;
          rows.push(obj);
        }
        tableData[table] = rows;
      }

      // Sanitize FK: drop any capcut category_id that doesn't exist in account_categories
      const { data: existingCats } = await supabase.from("account_categories").select("id");
      const validCategoryIds = new Set<string>((existingCats || []).map((c: any) => c.id));
      (tableData["account_categories"] || []).forEach((r: any) => r.id && validCategoryIds.add(r.id));

      if (tableData["capcut_accounts"]) {
        for (const row of tableData["capcut_accounts"]) {
          if (!row.category_id || !validCategoryIds.has(row.category_id)) {
            row.category_id = null;
          }
        }
      }

      // Insert in dependency order
      for (const table of allowed) {
        const rows = tableData[table];
        if (!rows || rows.length === 0) continue;
        const chunkSize = 500;
        let inserted = 0;
        let failed = false;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const { error } = await supabase.from(table).upsert(chunk, { onConflict: "id" });
          if (error) {
            errors.push(`${table}: ${error.message}`);
            failed = true;
            break;
          }
          inserted += chunk.length;
        }
        if (!failed) totalInserted += inserted;
      }
      if (errors.length) throw new Error(errors.join(" | "));

      toast.success(`تم رفع ${totalInserted} سجل بنجاح`);
      queryClient.invalidateQueries();
    } catch (e: any) {
      toast.error("فشل الرفع: " + e.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  return (
    <div className="space-y-5" dir="rtl">

      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExportAll} disabled={exporting} className="gap-1.5 text-[10px]">
            <Download className="h-3 w-3" />
            {exporting ? "جاري التصدير..." : "تصدير"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="gap-1.5 text-[10px]"
          >
            <Upload className="h-3 w-3" />
            {importing ? "جاري الرفع..." : "رفع"}
          </Button>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[120px] h-8 text-[10px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="income">إيرادات</SelectItem>
              <SelectItem value="expense">مصاريف</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-success/20 bg-success/5">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">إجمالي الإيرادات</p>
                <p className="text-sm font-bold text-success">
                  {transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0).toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">إجمالي المصاريف</p>
                <p className="text-sm font-bold text-destructive">
                  {transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0).toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">الصافي</p>
                <p className="text-sm font-bold text-primary">
                  {(transactions.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0) - transactions.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0)).toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monthly Groups */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground animate-pulse text-sm">جاري التحميل...</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Archive className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">لا توجد معاملات مؤرشفة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((month, idx) => {
            const prevMonth = grouped[idx + 1];
            const profitChange = prevMonth ? month.profit - prevMonth.profit : null;

            return (
            <Card key={month.key} className={cn("border-r-4 transition-colors cursor-pointer", month.profit > 0 ? "border-success/40" : month.profit < 0 ? "border-destructive/40" : "border-border/40")}>
              <CardContent className="p-0">
                <button
                  onClick={() => setExpandedMonth(expandedMonth === month.key ? null : month.key)}
                  className="w-full p-3 flex items-center justify-between text-right"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-bold text-foreground">{month.label}</span>
                    <span className="text-[10px] text-muted-foreground">({month.transactions.length} معاملة)</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-success font-semibold">+{month.income.toFixed(2)}</span>
                    <span className="text-destructive font-semibold">-{month.expense.toFixed(2)}</span>
                    <span className={cn("font-bold px-2 py-0.5 rounded-full text-[10px]", month.profit >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                      {month.profit >= 0 ? "ربح" : "خسارة"} {Math.abs(month.profit).toFixed(2)}
                    </span>
                  </div>
                </button>

                {/* Month comparison */}
                {profitChange !== null && (
                  <div className="px-3 pb-2 flex items-center gap-1 justify-end">
                    {profitChange > 0 ? <TrendingUp className="h-3 w-3 text-success" /> : profitChange < 0 ? <TrendingDown className="h-3 w-3 text-destructive" /> : null}
                    <span className={cn("text-[10px] font-medium", profitChange > 0 ? "text-success" : profitChange < 0 ? "text-destructive" : "text-muted-foreground")}>
                      {profitChange > 0 ? "+" : ""}{profitChange.toFixed(2)} مقارنة بالشهر السابق
                    </span>
                  </div>
                )}

                {expandedMonth === month.key && (
                  <div className="border-t border-border/30 p-3 space-y-1.5">
                    {month.transactions
                      .filter(t => filterType === "all" || t.type === filterType)
                      .map((t) => {
                        const isIncome = t.type === "income";
                        return (
                          <div key={t.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/20">
                            <div className="flex items-center gap-2">
                              <div className={cn("h-5 w-5 rounded-full flex items-center justify-center", isIncome ? "bg-success/10" : "bg-destructive/10")}>
                                {isIncome ? <TrendingUp className="h-3 w-3 text-success" /> : <TrendingDown className="h-3 w-3 text-destructive" />}
                              </div>
                              <span className="text-xs text-foreground">{t.description || (isIncome ? "إيراد" : "مصروف")}</span>
                              <span className="text-[10px] text-muted-foreground">{t.transaction_date}</span>
                            </div>
                            <span className={cn("text-xs font-bold", isIncome ? "text-success" : "text-destructive")}>
                              {isIncome ? "+" : "-"}{Number(t.amount).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
