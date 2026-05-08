import { useState, useRef, useEffect } from "react";
import { Lightbulb, Loader2, Send, Sparkles, TrendingUp, Wallet, Target, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  { icon: TrendingUp, label: "تحليل أداء الشهر", prompt: "حلّل أداءي المالي لهذا الشهر مقارنة بالشهر السابق، واذكر نقاط القوة والضعف بالأرقام." },
  { icon: Wallet, label: "كيف أزيد ربحي؟", prompt: "بناءً على بياناتي الحالية، اقترح 5 خطوات عملية لزيادة ربحي خلال 30 يوم القادمة." },
  { icon: Target, label: "تسعير ذكي", prompt: "هل أسعاري الحالية مناسبة؟ اقترح استراتيجية تسعير أفضل لخططي." },
  { icon: Users, label: "إدارة الأصدقاء/الأمانات", prompt: "راجع حسابات الأصدقاء والأمانات وأخبرني هل هناك مخاطر أو ديون متراكمة." },
];

export function ConsultDialog({ context: _ctx }: { context?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const newMessages: Msg[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consult`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error("تجاوزت حد الاستخدام، انتظر دقيقة.");
        if (resp.status === 402) throw new Error("نفد رصيد الذكاء الاصطناعي.");
        throw new Error("فشل الاتصال بالمرشد");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      setMessages((p) => [...p, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") continue;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setMessages((p) => p.map((m, i) => i === p.length - 1 ? { ...m, content: acc } : m));
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "خطأ");
      setMessages((p) => p.filter((_, i) => i !== p.length - 1 || p[p.length-1].role !== "assistant" || p[p.length-1].content));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title="مرشد البزنس الذكي"
          className="group relative h-9 w-9 rounded-xl bg-gradient-to-br from-warning via-warning/80 to-amber-500 border border-warning/50 flex items-center justify-center text-white hover:scale-110 transition-all shadow-lg shadow-warning/30 hover:shadow-warning/60"
        >
          <Lightbulb className="h-4 w-4 drop-shadow" />
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse" />
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-w-3xl p-0 gap-0 overflow-hidden h-[85vh] flex flex-col"
        dir="rtl"
      >
        {/* Header */}
        <DialogHeader className="relative px-5 py-4 border-b bg-gradient-to-l from-warning/10 via-amber-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-warning to-amber-500 flex items-center justify-center shadow-lg shadow-warning/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                مرشد البزنس
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  • متصل
                </span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                يحلّل بياناتك الفعلية ويعطيك نصائح مخصصة
              </p>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMessages([])}
                className="text-xs h-8"
              >
                محادثة جديدة
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-gradient-to-b from-muted/20 to-transparent">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-5">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-warning to-amber-500 blur-2xl opacity-30 rounded-full" />
                <div className="relative h-20 w-20 rounded-3xl bg-gradient-to-br from-warning to-amber-500 flex items-center justify-center shadow-2xl">
                  <Lightbulb className="h-10 w-10 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">كيف يمكنني مساعدتك اليوم؟</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  أنا مرشدك الشخصي في البزنس. أعرف كل تفاصيل نظامك — مالياتك، حساباتك، أسعارك، ودينك. اسألني أي شيء.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl pt-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => send(q.prompt)}
                    className="group text-right p-3 rounded-xl border border-border/60 bg-card/50 hover:bg-card hover:border-warning/40 hover:shadow-md transition-all flex items-start gap-3"
                  >
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-warning/20 to-amber-500/10 flex items-center justify-center text-warning group-hover:scale-110 transition-transform shrink-0">
                      <q.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{q.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{q.prompt}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
                m.role === "user" ? "justify-start flex-row-reverse" : "justify-start"
              )}
            >
              <div className={cn(
                "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow",
                m.role === "user"
                  ? "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground"
                  : "bg-gradient-to-br from-warning to-amber-500 text-white"
              )}>
                {m.role === "user" ? <span className="text-xs font-bold">أنت</span> : <Sparkles className="h-4 w-4" />}
              </div>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-card border border-border/60 rounded-tl-sm shadow-sm"
              )}>
                <p className="whitespace-pre-wrap break-words">{m.content || (loading && i === messages.length-1 ? "..." : "")}</p>
              </div>
            </div>
          ))}

          {loading && messages[messages.length-1]?.role === "user" && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-warning to-amber-500 flex items-center justify-center shadow">
                <Sparkles className="h-4 w-4 text-white animate-pulse" />
              </div>
              <div className="bg-card border border-border/60 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-warning animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 rounded-full bg-warning animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 rounded-full bg-warning animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t bg-card/50 backdrop-blur p-3">
          <div className="flex items-end gap-2 bg-background border border-border/80 rounded-2xl p-2 focus-within:border-warning/60 focus-within:ring-2 focus-within:ring-warning/20 transition-all">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="اسأل مرشدك عن أي شيء يخص بزنسك..."
              rows={1}
              className="flex-1 border-0 resize-none focus-visible:ring-0 shadow-none min-h-[40px] max-h-32 bg-transparent text-sm"
              disabled={loading}
            />
            <Button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              size="icon"
              className="h-10 w-10 rounded-xl bg-gradient-to-br from-warning to-amber-500 hover:from-warning hover:to-amber-600 text-white shadow-lg shadow-warning/30 shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            مرشد البزنس يقرأ بياناتك الحقيقية لإعطاء نصائح دقيقة • Enter للإرسال
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
