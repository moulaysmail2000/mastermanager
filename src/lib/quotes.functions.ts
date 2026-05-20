import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  todayIncome: z.number(),
  todayExpense: z.number(),
  yesterdayIncome: z.number(),
  yesterdayExpense: z.number(),
  monthIncome: z.number(),
  monthExpense: z.number(),
  unpaid: z.number(),
});

export const generateDailyQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const todayProfit = data.todayIncome - data.todayExpense;
    const yProfit = data.yesterdayIncome - data.yesterdayExpense;
    const monthProfit = data.monthIncome - data.monthExpense;

    const hour = new Date().getHours();
    let timeContext = "الليل";
    if (hour < 12) timeContext = "الصباح";
    else if (hour < 17) timeContext = "الزوال";
    else if (hour < 21) timeContext = "المساء";

    // Exact allowed numeric values (rounded). Any other number = hallucination.
    const tIn = Math.round(data.todayIncome);
    const tEx = Math.round(data.todayExpense);
    const tPr = Math.round(todayProfit);
    const yIn = Math.round(data.yesterdayIncome);
    const yEx = Math.round(data.yesterdayExpense);
    const yPr = Math.round(yProfit);
    const mIn = Math.round(data.monthIncome);
    const mEx = Math.round(data.monthExpense);
    const mPr = Math.round(monthProfit);
    const unp = data.unpaid;

    const allowed = new Set<number>([tIn, tEx, tPr, yIn, yEx, yPr, mIn, mEx, mPr, unp, 0]);

    // Comparative facts the model can reference safely (no invented numbers)
    const profitDirection =
      tPr > yPr ? "ربح اليوم أعلى من أمس" : tPr < yPr ? "ربح اليوم أقل من أمس" : "ربح اليوم مساوٍ لأمس";
    const incomeDirection =
      tIn > yIn ? "مداخيل اليوم أعلى من أمس" : tIn < yIn ? "مداخيل اليوم أقل من أمس" : "مداخيل اليوم مساوية لأمس";
    const profitState = tPr > 0 ? "اليوم رابح" : tPr < 0 ? "اليوم خاسر" : "اليوم متعادل";
    const debtState = unp === 0 ? "لا توجد ديون" : `هناك ${unp} رقم غير مدفوع`;

    const systemPrompt = `أنت "المعلم"، مستشار أعمال عربي يقرأ لوحة تحكم المستخدم بدقة مطلقة. مهمتك إنتاج نصائح قصيرة مبنية حصراً على الأرقام الحقيقية أدناه.

اللغة: عربية فصحى راقية فقط. ممنوع الدارجة، الإنجليزية، أو الفرنسية.

قواعد لا يجوز خرقها أبداً:
1) ممنوع منعاً باتاً ذكر أي رقم لا ينتمي حرفياً إلى هذه القائمة: ${[...allowed].join("، ")}.
2) ممنوع اختراع أهداف، توقعات، نسب مئوية، أو متوسطات. لا "اوصل إلى ١٠٠"، لا "زد ٢٠٪".
3) إذا ذكرت ربح اليوم فالرقم = ${tPr} درهم بالضبط. إذا ذكرت مداخيل اليوم فالرقم = ${tIn}. إذا ذكرت مصاريف اليوم فالرقم = ${tEx}.
4) ممنوع التناقض مع الحقائق: ${profitState}، ${profitDirection}، ${incomeDirection}، ${debtState}.
5) لا تقل "ربح صفر" إلا إذا كان ${tPr} = 0. لا تقل "خسارة" إلا إذا كان ${tPr} < 0.
6) إذا لم تكن متأكداً من رقم، لا تذكر أي رقم في تلك النصيحة واكتفِ بنصيحة عامة دقيقة.
7) راعِ الوقت الحالي: ${timeContext}.
8) كل نصيحة من 8 إلى 16 كلمة، سطر واحد، بدون ترقيم أو رموز أو علامات اقتباس.

أنتج 20 نصيحة دقيقة. كل سطر = نصيحة واحدة، ولا شيء آخر.`;

    const userPrompt = `الوقت: ${timeContext} (${hour}:00)

الأرقام الحقيقية الوحيدة المسموح بها:
- اليوم: مداخيل ${tIn}، مصاريف ${tEx}، ربح ${tPr}
- أمس: مداخيل ${yIn}، مصاريف ${yEx}، ربح ${yPr}
- الشهر: مداخيل ${mIn}، مصاريف ${mEx}، ربح ${mPr}
- أرقام غير مدفوعة: ${unp}

حقائق مقارنة جاهزة (استعملها كما هي دون أرقام إضافية):
- ${profitState}
- ${profitDirection}
- ${incomeDirection}
- ${debtState}

اكتب 20 نصيحة دقيقة مبنية على هذه البيانات فقط.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`AI gateway error ${res.status}: ${text}`);
      const error =
        res.status === 402
          ? "نفدت أرصدة الذكاء الاصطناعي. يرجى إضافة رصيد."
          : res.status === 429
            ? "تم تجاوز الحد. حاول لاحقاً."
            : "تعذّر توليد النصائح حالياً.";
      return { quotes: [] as string[], error };
    }

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";

    // Post-filter: drop quotes that contain numbers not in the allowed set
    // (catches hallucinated targets / contradictions like "الربح 0" when it isn't).
    const isAllowedNumber = (n: number) => {
      for (const a of allowed) {
        if (Math.abs(a - n) <= 1) return true; // tolerate rounding
      }
      return false;
    };

    // Reject quotes that contradict facts even without numbers
    const contradictsFacts = (l: string): boolean => {
      const t = l.toLowerCase();
      if (tPr > 0 && /(خسارة|خاسر|تراجع الربح إلى الصفر|ربح صفر|الربح صفر)/.test(l)) return true;
      if (tPr < 0 && /(ربح ممتاز|أرباح جيدة|اليوم رابح)/.test(l)) return true;
      if (tPr === 0 && /(ربح ممتاز|أرباح كبيرة)/.test(l)) return true;
      if (unp === 0 && /(ديون متراكمة|سدد الديون|حصّل الديون|الديون المتأخرة)/.test(l)) return true;
      if (unp > 0 && /(لا توجد ديون|خالٍ من الديون|بدون ديون)/.test(l)) return true;
      return t.length === 0;
    };

    const quotes = content
      .split("\n")
      .map((l) => l.replace(/^[-*•\d.\)\s]+/, "").trim())
      .filter((l) => l.length >= 8 && l.length <= 200)
      .filter((l) => {
        const nums = l.match(/\d+(?:[.,]\d+)?/g);
        if (!nums) return true;
        return nums.every((s) => isAllowedNumber(Number(s.replace(",", "."))));
      })
      .filter((l) => !contradictsFacts(l));

    return { quotes, error: null as string | null };
  });
