import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Lightbulb } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { generateDailyQuotes } from "@/lib/quotes.functions";

type Props = {
  todayIncome: number;
  todayExpense: number;
  yesterdayIncome: number;
  yesterdayExpense: number;
  monthIncome: number;
  monthExpense: number;
  unpaid: number;
};

const QUOTE_DURATION = 6500;
const CACHE_PREFIX = "mq_v4_";
// Threshold: invalidate cache if today's profit changed by more than this
const PROFIT_DELTA_THRESHOLD = 25;

type CachedPayload = {
  quotes: string[];
  todayProfit: number;
  unpaid: number;
};

function periodKey() {
  const now = new Date();
  const period = Math.floor(now.getHours() / 3);
  return `${CACHE_PREFIX}${now.toISOString().split("T")[0]}_p${period}`;
}

function readCache(key: string): CachedPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.quotes)) return parsed as CachedPayload;
  } catch {}
  return null;
}

function writeCache(key: string, payload: CachedPayload) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(payload));
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX) && k !== key) localStorage.removeItem(k);
      if (k && k.startsWith("mq_v3_")) localStorage.removeItem(k);
      if (k && k.startsWith("mq.daily.")) localStorage.removeItem(k);
    }
  } catch {}
}

const fallbackPool = [
  "ابدأ يومك بنية واضحة — كل خطوة تقربك من الربح.",
  "راجع أرقامك الآن، القرارات الذكية تبنى على البيانات.",
  "وقتك أغلى رأس مال — استثمره فيما يضاعف دخلك.",
  "ركز على هامش الربح، لا على حجم المبيعات فقط.",
  "زبون راضٍ اليوم = ثلاثة زبائن غدًا.",
];

export function MotivationalQuotes(props: Props) {
  const generate = useServerFn(generateDailyQuotes);
  const [quotes, setQuotes] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const inFlightRef = useRef(false);

  const todayProfit = props.todayIncome - props.todayExpense;

  useEffect(() => {
    if (inFlightRef.current) return;
    const key = periodKey();
    const cached = readCache(key);

    if (
      cached &&
      Math.abs(cached.todayProfit - todayProfit) < PROFIT_DELTA_THRESHOLD &&
      cached.unpaid === props.unpaid
    ) {
      setQuotes(cached.quotes);
      return;
    }

    if (!quotes.length) setQuotes(fallbackPool);
    inFlightRef.current = true;

    generate({
      data: {
        todayIncome: props.todayIncome,
        todayExpense: props.todayExpense,
        yesterdayIncome: props.yesterdayIncome,
        yesterdayExpense: props.yesterdayExpense,
        monthIncome: props.monthIncome,
        monthExpense: props.monthExpense,
        unpaid: props.unpaid,
      },
    })
      .then((res) => {
        if (res?.quotes?.length) {
          setQuotes(res.quotes);
          setIndex(0);
          writeCache(key, { quotes: res.quotes, todayProfit, unpaid: props.unpaid });
        }
      })
      .catch((e) => console.error("quotes generation failed", e))
      .finally(() => {
        inFlightRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayProfit, props.unpaid]);

  useEffect(() => {
    if (quotes.length < 2) return;
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % quotes.length);
    }, QUOTE_DURATION);
    return () => clearTimeout(t);
  }, [index, quotes.length]);

  const text = quotes[index] ?? "";
  const Icon = useMemo(() => (index % 2 === 0 ? Sparkles : Lightbulb), [index]);
  const tones = ["text-primary", "text-success", "text-warning", "text-info", "text-destructive"];
  const tone = tones[index % tones.length];

  return (
    <div className="mt-3 relative min-h-[3rem] sm:min-h-[2.75rem] overflow-hidden">
      <AnimatePresence mode="wait">
        {text && (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex items-center gap-2.5"
          >
            <Icon className={`h-[1.05rem] w-[1.05rem] sm:h-[1.15rem] sm:w-[1.15rem] shrink-0 ${tone}`} />
            <p className="text-[0.9rem] sm:text-base font-semibold text-foreground/90 leading-snug tracking-tight">
              {text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
