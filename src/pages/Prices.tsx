import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCopy } from "@/hooks/useCopy";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Copy, Pencil, Save, X, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

export default function Prices() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const copy = useCopy();
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const { data: prices = [], isLoading } = useQuery({
    queryKey: ["prices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("prices").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, text }: { id?: string; text: string }) => {
      if (id) {
        const { error } = await supabase.from("prices").update({ plan_type: text }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("prices").insert({ plan_type: text, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prices"] });
      setAdding(false); setNewText(""); setEditingId(null); setEditText("");
      toast.success("تم الحفظ");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["prices"] }); toast.success("تم الحذف"); },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">الأسعار</h1>
        <Button onClick={() => setAdding(true)} size="sm" disabled={adding} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> إضافة
        </Button>
      </div>

      {adding && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-3">
            <Textarea placeholder="الصق نص الأسعار هنا..." value={newText} onChange={(e) => setNewText(e.target.value)} rows={5} className="resize-y text-sm" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveMutation.mutate({ text: newText })} disabled={saveMutation.isPending || !newText.trim()} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> حفظ
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setAdding(false); setNewText(""); }} className="gap-1.5">
                <X className="h-3.5 w-3.5" /> إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground animate-pulse text-sm">جاري التحميل...</p>
        </div>
      ) : prices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Tag className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">لا توجد أسعار بعد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {prices.map((p) => {
            const isEditing = editingId === p.id;
            return (
              <Card key={p.id} className="border-border/50 hover:border-border transition-colors">
                <CardContent className="pt-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={5} className="resize-y text-sm" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveMutation.mutate({ id: p.id, text: editText })} disabled={saveMutation.isPending} className="gap-1.5">
                          <Save className="h-3.5 w-3.5" /> حفظ
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="gap-1.5">
                          <X className="h-3.5 w-3.5" /> إلغاء
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="whitespace-pre-line text-sm leading-relaxed bg-muted/30 rounded-lg p-3">
                        {p.plan_type}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" onClick={() => copy(p.plan_type)} className="gap-1.5 h-8 text-xs">
                          <Copy className="h-3 w-3" /> نسخ
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingId(p.id); setEditText(p.plan_type); }} className="gap-1.5 h-8 text-xs">
                          <Pencil className="h-3 w-3" /> تعديل
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive gap-1.5 h-8 text-xs" onClick={() => deleteMutation.mutate(p.id)}>
                          <Trash2 className="h-3 w-3" /> حذف
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
