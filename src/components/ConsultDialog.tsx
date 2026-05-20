import { useState, useRef, useEffect } from "react";
import { Lightbulb, Loader2, Send, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

export function ConsultDialog({ context: _ctx }: { context?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
      if (!session?.access_token) {
        throw new Error("يجب تسجيل الدخول لاستخدام المرشد.");
      }
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consult`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error("تجاوزت حد الاستخدام، انتظر دقيقة.");
        if (resp.status === 402) throw new Error("نفد رصيد الذكاء الاصطناعي.");
        throw new Error("فشل الاتصال");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let fullText = ""; // total received
      let displayed = ""; // currently rendered
      let streamDone = false;
      setMessages((p) => [...p, { role: "assistant", content: "" }]);

      // Smooth typewriter: reveal characters at a steady pace,
      // adapting speed to keep up with the buffer.
      const typer = (async () => {
        while (!streamDone || displayed.length < fullText.length) {
          const remaining = fullText.length - displayed.length;
          if (remaining === 0) {
            await new Promise((r) => setTimeout(r, 20));
            continue;
          }
          // adaptive: drain faster when buffer is large
          const step = remaining > 80 ? 4 : remaining > 30 ? 2 : 1;
          displayed = fullText.slice(0, displayed.length + step);
          const snapshot = displayed;
          setMessages((p) => p.map((m, i) => i === p.length - 1 ? { ...m, content: snapshot } : m));
          await new Promise((r) => setTimeout(r, 12));
        }
      })();

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
            if (delta) fullText += delta;
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
      streamDone = true;
      await typer;
    } catch (e: any) {
      toast.error(e?.message || "خطأ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title="مرشد البزنس"
          className="relative h-9 w-9 rounded-xl bg-warning/15 border border-warning/30 flex items-center justify-center text-warning hover:bg-warning/25 transition-colors"
        >
          <Lightbulb className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-warning animate-pulse" />
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-w-xl p-0 gap-0 overflow-hidden h-[80vh] flex flex-col"
        dir="rtl"
      >
        <DialogHeader className="px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-warning/15 flex items-center justify-center text-warning">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-right">مرشد البزنس</DialogTitle>
            </div>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="text-xs h-7">
                جديدة
              </Button>
            )}
          </div>
        </DialogHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Lightbulb className="h-10 w-10 mb-3 text-warning/60" />
              <p className="text-sm">مرحباً، كيف يمكنني مساعدتك؟</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}>
                {m.content || (loading && i === messages.length - 1 ? "..." : "")}
              </div>
            </div>
          ))}

          {loading && messages[messages.length-1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-3.5 py-2.5 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="اكتب رسالتك..."
              rows={1}
              className="flex-1 resize-none min-h-[40px] max-h-32 text-sm rounded-xl"
              disabled={loading}
            />
            <Button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              size="icon"
              className="h-10 w-10 rounded-xl shrink-0"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
