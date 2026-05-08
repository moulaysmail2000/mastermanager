import { useState } from "react";
import { Lightbulb, Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  context?: string;
};

export function ConsultDialog({ context }: Props) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("financial");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");

  const submit = async () => {
    if (!question.trim()) {
      toast.error("اكتب سؤالك أولاً");
      return;
    }
    setLoading(true);
    setAnswer("");
    try {
      const { data, error } = await supabase.functions.invoke("consult", {
        body: { topic, question, context },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAnswer((data as any)?.answer || "");
    } catch (e: any) {
      toast.error(e?.message || "فشل الحصول على الاستشارة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title="استشارة مالية / عمل عبر الإنترنت"
          className="group relative h-9 w-9 rounded-xl bg-gradient-to-br from-warning/30 to-warning/10 border border-warning/40 flex items-center justify-center text-warning hover:scale-105 transition-transform shadow-sm hover:shadow-warning/30"
        >
          <Lightbulb className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-warning animate-pulse" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-warning" />
            استشارة ذكية
          </DialogTitle>
          <DialogDescription>
            احصل على نصيحة فورية في الإدارة المالية أو العمل عبر الإنترنت.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">الموضوع</Label>
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="financial">استشارة مالية</SelectItem>
                <SelectItem value="online">العمل عبر الإنترنت</SelectItem>
                <SelectItem value="marketing">تسويق ومبيعات</SelectItem>
                <SelectItem value="general">عام</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">سؤالك</Label>
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="اكتب سؤالك هنا..."
              rows={4}
            />
          </div>
          <Button onClick={submit} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "جاري التفكير..." : "احصل على الاستشارة"}
          </Button>

          {answer && (
            <div className="mt-2 rounded-lg border border-border/60 bg-muted/40 p-3 max-h-72 overflow-y-auto">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{answer}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
