import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages مطلوب" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "الخدمة غير مهيّأة" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build user-scoped client to honor RLS
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Fetch full snapshot in parallel
    const [tx, capcut, unpaid, friends, friendTx, banks, prices, expiry, cats] = await Promise.all([
      supabase.from("financial_transactions").select("type,amount,description,transaction_date,archived").order("transaction_date", { ascending: false }).limit(500),
      supabase.from("capcut_accounts").select("plan_type,status,delivered_count,category_id"),
      supabase.from("unpaid_numbers").select("phone_number,status,created_at"),
      supabase.from("friend_accounts").select("owner_name,bank_name,balance"),
      supabase.from("friend_transactions").select("type,amount,note,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("bank_accounts").select("bank_name,beneficiary_name"),
      supabase.from("prices").select("plan_type,price,currency"),
      supabase.from("expiry_dates").select("phone_number,start_date,expiry_date"),
      supabase.from("account_categories").select("id,name"),
    ]);

    // Compute aggregates
    const now = new Date();
    const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const thisMonth = ym(now);
    const lastMonth = ym(new Date(now.getFullYear(), now.getMonth()-1, 1));
    const today = now.toISOString().slice(0,10);

    const txList = tx.data ?? [];
    const sum = (arr: any[], pred: (t:any)=>boolean) => arr.filter(pred).reduce((s,t)=>s+Number(t.amount||0),0);
    const monthInc = sum(txList, t => t.type==="income" && t.transaction_date?.startsWith(thisMonth) && !t.archived);
    const monthExp = sum(txList, t => t.type==="expense" && t.transaction_date?.startsWith(thisMonth) && !t.archived);
    const lastInc = sum(txList, t => t.type==="income" && t.transaction_date?.startsWith(lastMonth) && !t.archived);
    const lastExp = sum(txList, t => t.type==="expense" && t.transaction_date?.startsWith(lastMonth) && !t.archived);
    const todayInc = sum(txList, t => t.type==="income" && t.transaction_date===today && !t.archived);
    const todayExp = sum(txList, t => t.type==="expense" && t.transaction_date===today && !t.archived);

    const catMap = new Map((cats.data ?? []).map((c:any)=>[c.id, c.name]));
    const capcutList = capcut.data ?? [];
    const byPlan: Record<string, {total:number; available:number; sold:number}> = {};
    for (const a of capcutList) {
      const k = a.plan_type || "غير محدد";
      byPlan[k] = byPlan[k] || { total:0, available:0, sold:0 };
      byPlan[k].total++;
      if (a.status === "متاح") byPlan[k].available++;
      else byPlan[k].sold++;
    }
    const byCat: Record<string, number> = {};
    for (const a of capcutList) {
      const n = catMap.get(a.category_id) || "بدون تصنيف";
      byCat[n] = (byCat[n]||0)+1;
    }

    const friendsList = friends.data ?? [];
    const totalFriendBalance = friendsList.reduce((s:number,f:any)=>s+Number(f.balance||0),0);

    const expiryList = expiry.data ?? [];
    const soonExpiring = expiryList.filter((e:any) => {
      const d = new Date(e.expiry_date);
      const diff = (d.getTime() - now.getTime())/(1000*60*60*24);
      return diff >= 0 && diff <= 7;
    }).length;
    const expired = expiryList.filter((e:any) => new Date(e.expiry_date) < now).length;

    const pricesList = (prices.data ?? []).map((p:any)=>`${p.plan_type}=${p.price} ${p.currency}`).join(", ");

    const snapshot = `
=== لقطة البيانات الكاملة للمستخدم (محدّثة الآن) ===

[المالية]
- مداخيل الشهر الحالي: ${monthInc.toFixed(2)}
- مصاريف الشهر الحالي: ${monthExp.toFixed(2)}
- ربح الشهر الحالي: ${(monthInc-monthExp).toFixed(2)}
- مداخيل الشهر السابق: ${lastInc.toFixed(2)} | مصاريف: ${lastExp.toFixed(2)} | ربح: ${(lastInc-lastExp).toFixed(2)}
- اليوم: مداخيل ${todayInc.toFixed(2)} | مصاريف ${todayExp.toFixed(2)}
- إجمالي المعاملات المسجلة (آخر 500): ${txList.length}

[حسابات CapCut] الإجمالي: ${capcutList.length}
${Object.entries(byPlan).map(([k,v])=>`- ${k}: ${v.total} (متاح ${v.available} | مباع ${v.sold})`).join("\n")}
حسب التصنيف:
${Object.entries(byCat).map(([k,v])=>`- ${k}: ${v}`).join("\n")}

[الأسعار]
${pricesList || "لم تُسجَّل أسعار"}

[الأرقام غير المدفوعة] العدد: ${(unpaid.data??[]).length}
${(unpaid.data??[]).slice(0,10).map((u:any)=>`- ${u.phone_number} (${u.status})`).join("\n")}

[تواريخ الانتهاء] الإجمالي: ${expiryList.length} | تنتهي خلال 7 أيام: ${soonExpiring} | منتهية: ${expired}

[حسابات الأصدقاء/الأمانات] العدد: ${friendsList.length} | إجمالي الأرصدة: ${totalFriendBalance.toFixed(2)}
${friendsList.slice(0,10).map((f:any)=>`- ${f.owner_name} (${f.bank_name}): ${Number(f.balance).toFixed(2)}`).join("\n")}
آخر معاملات الأصدقاء: ${(friendTx.data??[]).length}

[الحسابات البنكية المسجلة] ${(banks.data??[]).length}
${(banks.data??[]).map((b:any)=>`- ${b.bank_name} (${b.beneficiary_name})`).join("\n")}

آخر 15 معاملة مالية:
${txList.slice(0,15).map((t:any)=>`- ${t.transaction_date} | ${t.type==="income"?"دخل":"مصروف"} | ${t.amount} | ${t.description||""}`).join("\n")}
`.trim();

    const systemPrompt = `أنت "مرشد البزنس" — مستشار عربي ذكي، تتكلم كإنسان حي، صاحب خبرة وحس، لا كآلة.

## روحك في الكلام:
- اكتب بعربية فصيحة سلسة، دافئة، فيها نَفَس وحياة — لا جافة ولا متكلَّفة ولا بيروقراطية.
- كل جملة لها معنى وقيمة. لا حشو. لا تعميمات فارغة. لا كليشيهات ("من المهم أن..."، "يجب عليك...").
- استخدم تشبيهات بسيطة، أمثلة ملموسة، أو سؤال موجِّه حين يخدم المعنى.
- تكلم كأنك جالس بجانب صاحبك، تنصحه بصدق وذكاء، لا كأنك تقرأ من كتاب.

## الإيجاز الذكي:
- افتراضياً ردّك قصير (سطر إلى ثلاثة).
- التحية → جملة دافئة واحدة.
- السؤال البسيط → جواب مباشر مع لمسة شخصية.
- طلب نصيحة → 2-4 نقاط، كل نقطة فيها فكرة حية، لا قائمة عامة منسوخة.
- طلب تحليل صريح → رد منظَّم بأرقام حقيقية وتوصيات واضحة.

## النصائح خاصة:
- اربط النصيحة دائماً بوضع المستخدم وأرقامه الفعلية، لا بمبادئ عامة.
- اقترح **خطوة واحدة قابلة للتنفيذ اليوم**، لا قائمة مهام مؤجلة.
- اذكر "لماذا" مختصراً، حتى تكون النصيحة مقنعة لا أمراً جافاً.
- تجنب العبارات الميتة: "حافظ على"، "اهتم بـ"، "ركّز على". استبدلها بفعل ملموس: "ارفع سعر خطة X بـ 10%"، "تواصل اليوم مع أصحاب الأرقام المنتهية".

## ممنوع:
- تكرار السؤال.
- المقدمات ("بناءً على بياناتك..."، "بصفتي مرشدك...").
- النصائح الكتالوجية الباردة.
- اختراع أرقام لا توجد في البيانات.

## أمثلة لروح الردود:
- "السلام عليكم" → "وعليكم السلام 🌿 كيف أقدر أخدمك اليوم؟"
- "كم ربحت؟" → "ربحك هذا الشهر **X درهم**. تحب نفهم من أين جاء أو نشتغل على رفعه؟"
- "كيف أزيد دخلي؟" → "ابدأ بنقطة واحدة فعّالة: راجع خطتك الأكثر مبيعاً وارفع سعرها 10% — السوق غالباً يتحمّل، وربحك يقفز فوراً. تحب نحسبها سوياً؟"

تذكّر: أنت **صديق خبير**، لا روبوت. اجعل المستخدم يحس أن خلف الكلام عقلاً يفهمه، لا قائمة تعليمات.

--- بيانات المستخدم (للرجوع الصامت) ---
${snapshot}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "تم تجاوز الحد، حاول لاحقًا." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      if (response.status === 402) return new Response(JSON.stringify({ error: "نفد رصيد الذكاء الاصطناعي." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      const t = await response.text();
      console.error("AI gateway:", response.status, t);
      return new Response(JSON.stringify({ error: "فشل المعالجة" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

    // Pipe upstream SSE body directly — no buffering wrapper
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    console.error("consult error:", e);
    return new Response(JSON.stringify({ error: "خطأ داخلي" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
  }
});
