import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DailyStatsBar() {
  const today = new Date().toISOString().split("T")[0];

  const { data } = useQuery({
    queryKey: ["daily_stats_bar", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("type, amount")
        .eq("transaction_date", today);
      if (error) throw error;
      let income = 0, expense = 0;
      for (const t of data || []) {
        if (t.type === "income") income += Number(t.amount);
        else expense += Number(t.amount);
      }
      return { income, expense, profit: income - expense };
    },
    refetchInterval: 60_000,
  });

  const income = data?.income ?? 0;
  const expense = data?.expense ?? 0;
  const profit = data?.profit ?? 0;

  return (
    <div
      dir="rtl"
      className="inline-flex items-center gap-1.5 sm:gap-3 rounded-full border border-border/60 bg-card/80 backdrop-blur px-2 sm:px-4 py-1 sm:py-1.5 shadow-sm max-w-full flex-wrap justify-center"
    >
      <span className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">اليوم</span>
      <span className="h-3 w-px bg-border/60" />
      <div className="flex items-center gap-1">
        <TrendingUp className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-success" />
        <span className="text-[9px] sm:text-[10px] text-muted-foreground">مداخل</span>
        <span className="text-[10px] sm:text-xs font-bold text-success tabular-nums">{income.toFixed(2)}</span>
      </div>
      <span className="h-3 w-px bg-border/60" />
      <div className="flex items-center gap-1">
        <TrendingDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-destructive" />
        <span className="text-[9px] sm:text-[10px] text-muted-foreground">مصاريف</span>
        <span className="text-[10px] sm:text-xs font-bold text-destructive tabular-nums">{expense.toFixed(2)}</span>
      </div>
      <span className="h-3 w-px bg-border/60" />
      <div className="flex items-center gap-1">
        <Wallet className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", profit >= 0 ? "text-primary" : "text-destructive")} />
        <span className="text-[9px] sm:text-[10px] text-muted-foreground">الربح</span>
        <span className={cn("text-[10px] sm:text-xs font-bold tabular-nums", profit >= 0 ? "text-primary" : "text-destructive")}>{profit.toFixed(2)}</span>
      </div>
    </div>
  );
}
