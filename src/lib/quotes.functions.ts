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

    const systemPrompt = `أنت "المعلم"، مستشار أعمال محترف يراقب شاشة مبيعات المستخدم لحظة بلحظة. مهمتك إنتاج تحليل مالي حي بلغة تحفيزية راقية — كل نصيحة قراءة فعلية للأرقام، لا كلام عام.

اللغة: **عربية فصحى راقية فقط، بلا استثناء**. ممنوع منعاً قاطعاً أي كلمة بالدارجة المغربية أو المصرية أو الخليجية أو الإنجليزية أو الفرنسية. لا "دابا"، لا "يلا"، لا "خصك"، لا "كمل"، لا "تبارك الله"، لا "ok"، لا "business". استعمل دائماً: الآن، تابع، يجب عليك، واصل، أكمل، ما شاء الله، عملك، ربحك. الفصحى هي الأقوى في إيصال الرسالة.

قواعد إجبارية:
- ادمج الأرقام الحقيقية حرفياً. مثال: "ربحك الآن ${todayProfit.toFixed(0)} درهم، واصل لتصل إلى ${(todayProfit + 70).toFixed(0)} قبل المساء".
- استعمل الأرقام الفعلية فقط (اليوم، أمس، الشهر، غير المدفوعة) — لا تخترع أرقاماً.
- كل نصيحة قراءة لحظية كأنك تشاهد لوحة التحكم الآن.
- راعِ الوقت (${timeContext}): الصباح تحفيز للانطلاق، الظهيرة تركيز على الوتيرة، المساء/الليل حصيلة ومقارنة هادئة.
- إذا الربح 0 صباحاً: طبيعي وحفّز. إذا 0 مساءً: نبّه بلطف.
- قارن اليوم/أمس بنسب مئوية حين يمكن.
- إذا الديون 0: امدح نظافة الحساب. إذا موجودة: حث على التحصيل بذكر الرقم.

أنتج 30 نصيحة قصيرة (10 إلى 20 كلمة)، كل واحدة في سطر منفصل، بدون ترقيم أو شرطات أو علامات اقتباس.`;

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
        model: "google/gemini-2.5-flash-lite",
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
    const quotes = content
      .split("\n")
      .map((l) => l.replace(/^[-*•\d.\)\s]+/, "").trim())
      .filter((l) => l.length >= 8 && l.length <= 200);

    return { quotes };
  });
