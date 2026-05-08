import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, BarChart3, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

type Transaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  transaction_date: string;
};

type PeriodSummary = {
  label: string;
  income: number;
  expense: number;
  profit: number;
};

function getWeekNumber(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${weekNum}`;
}

function getWeekLabel(key: string): string {
  const [year, w] = key.split("-W");
  return `الأسبوع ${w} - ${year}`;
}

function getMonthLabel(key: string): string {
  const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const [year, month] = key.split("-");
  return `${months[parseInt(month) - 1]} ${year}`;
}

function groupTransactions(transactions: Transaction[], mode: "daily" | "weekly" | "monthly"): PeriodSummary[] {
  const groups: Record<string, { income: number; expense: number }> = {};

  for (const t of transactions) {
    let key: string;
    if (mode === "daily") {
      key = t.transaction_date;
    } else if (mode === "weekly") {
      key = getWeekNumber(new Date(t.transaction_date));
    } else {
      key = t.transaction_date.substring(0, 7);
    }

    if (!groups[key]) groups[key] = { income: 0, expense: 0 };
    if (t.type === "income") groups[key].income += Number(t.amount);
    else groups[key].expense += Number(t.amount);
  }

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, val]) => ({
      label: mode === "daily" ? key : mode === "weekly" ? getWeekLabel(key) : getMonthLabel(key),
      income: val.income,
      expense: val.expense,
      profit: val.income - val.expense,
    }));
}

export default function FinancialAnalytics({ transactions }: { transactions: Transaction[] }) {
  const [tab, setTab] = useState("monthly");

  const daily = useMemo(() => groupTransactions(transactions, "daily"), [transactions]);
  const weekly = useMemo(() => groupTransactions(transactions, "weekly"), [transactions]);
  const monthly = useMemo(() => groupTransactions(transactions, "monthly"), [transactions]);

  const dataMap = { daily, weekly, monthly };

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">التحليل المالي</h2>
        </div>

        <Tabs value={tab} onValueChange={setTab} dir="rtl">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="daily" className="text-[11px]">يومي</TabsTrigger>
            <TabsTrigger value="weekly" className="text-[11px]">أسبوعي</TabsTrigger>
            <TabsTrigger value="monthly" className="text-[11px]">شهري</TabsTrigger>
          </TabsList>

          {(["daily", "weekly", "monthly"] as const).map((period) => (
            <TabsContent key={period} value={period} className="mt-3 space-y-2">
              {dataMap[period].length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  لا توجد بيانات
                </div>
              ) : (
                dataMap[period].map((s, i) => {
                  const prevItem = dataMap[period][i + 1];
                  const profitChange = prevItem ? s.profit - prevItem.profit : null;

                  return (
                    <Card key={s.label} className={cn(
                      "border-r-4 transition-colors",
                      s.profit > 0 ? "border-success/40" : s.profit < 0 ? "border-destructive/40" : "border-border/40"
                    )}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-foreground">{s.label}</span>
                          <span className={cn(
                            "text-xs font-bold px-2 py-0.5 rounded-full",
                            s.profit > 0 ? "bg-success/10 text-success" : s.profit < 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                          )}>
                            {s.profit > 0 ? "ربح" : s.profit < 0 ? "خسارة" : "تعادل"}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[10px] text-muted-foreground">إيرادات</p>
                            <p className="text-xs font-bold text-success">{s.income.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">مصاريف</p>
                            <p className="text-xs font-bold text-destructive">{s.expense.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">صافي</p>
                            <p className={cn("text-xs font-bold", s.profit >= 0 ? "text-success" : "text-destructive")}>
                              {s.profit.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {profitChange !== null && (
                          <div className="mt-2 pt-2 border-t border-border/30 flex items-center gap-1 justify-end">
                            {profitChange > 0 ? (
                              <TrendingUp className="h-3 w-3 text-success" />
                            ) : profitChange < 0 ? (
                              <TrendingDown className="h-3 w-3 text-destructive" />
                            ) : null}
                            <span className={cn(
                              "text-[10px] font-medium",
                              profitChange > 0 ? "text-success" : profitChange < 0 ? "text-destructive" : "text-muted-foreground"
                            )}>
                              {profitChange > 0 ? "+" : ""}{profitChange.toFixed(2)} مقارنة بالفترة السابقة
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
