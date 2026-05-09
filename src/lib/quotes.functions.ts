import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

    // Allowed numbers the model may quote (everything else is hallucination)
    const allowed = new Set<number>([
      Math.round(data.todayIncome),
      Math.round(data.todayExpense),
      Math.round(todayProfit),
      Math.round(data.yesterdayIncome),
      Math.round(data.yesterdayExpense),
      Math.round(yProfit),
      Math.round(data.monthIncome),
      Math.round(data.monthExpense),
      Math.round(monthProfit),
      data.unpaid,
      0,
    ]);

    const systemPrompt = `أنت "المعلم"، مستشار أعمال يقرأ لوحة تحكم المستخدم لحظياً. كل نصيحة يجب أن تكون قراءة دقيقة للأرقام الفعلية، لا كلام عام ولا أرقام مخترعة.

اللغة: **عربية فصحى راقية فقط**. ممنوع الدارجة أو الإنجليزية أو الفرنسية.

قواعد صارمة (مخالفتها = نصيحة مرفوضة):
1. لا تذكر أي رقم إلا إذا كان من القائمة الفعلية: ${[...allowed].join("، ")}.
2. ممنوع اختراع أهداف رقمية أو توقعات (مثل "اوصل إلى 150"). استعمل فقط الأرقام الفعلية.
3. إذا ذكرت الربح، يجب أن يكون الرقم = ${todayProfit.toFixed(0)} درهم بالضبط لربح اليوم.
4. إذا ذكرت المداخيل اليوم، الرقم = ${data.todayIncome.toFixed(0)} درهم.
5. إذا ذكرت المصاريف اليوم، الرقم = ${data.todayExpense.toFixed(0)} درهم.
6. لا تقل "الربح 0" إذا كان الربح ${todayProfit.toFixed(0)}. لا تتناقض مع الأرقام أبداً.
7. راعِ الوقت (${timeContext}).
8. إذا الديون = 0: امدح. إذا > 0: نبّه بذكر الرقم.

أنتج 25 نصيحة قصيرة (10 إلى 18 كلمة)، كل واحدة في سطر، بدون ترقيم ولا شرطات ولا علامات اقتباس.`;

    const userPrompt = `الوقت: ${timeContext} (${hour}:00)

اليوم: مداخيل ${data.todayIncome.toFixed(0)} درهم، مصاريف ${data.todayExpense.toFixed(0)} درهم، ربح ${todayProfit.toFixed(0)} درهم
أمس: مداخيل ${data.yesterdayIncome.toFixed(0)} درهم، مصاريف ${data.yesterdayExpense.toFixed(0)} درهم، ربح ${yProfit.toFixed(0)} درهم
الشهر: مداخيل ${data.monthIncome.toFixed(0)} درهم، مصاريف ${data.monthExpense.toFixed(0)} درهم، ربح ${monthProfit.toFixed(0)} درهم
أرقام لم تُدفع: ${data.unpaid}

أنتج 30 نصيحة تحليلية حية تدمج هذه الأرقام مباشرة، سطر لكل نصيحة، لا شيء آخر.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI gateway error ${res.status}: ${text}`);
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

    const quotes = content
      .split("\n")
      .map((l) => l.replace(/^[-*•\d.\)\s]+/, "").trim())
      .filter((l) => l.length >= 8 && l.length <= 200)
      .filter((l) => {
        const nums = l.match(/\d+(?:[.,]\d+)?/g);
        if (!nums) return true;
        return nums.every((s) => isAllowedNumber(Number(s.replace(",", "."))));
      });

    return { quotes };
  });
