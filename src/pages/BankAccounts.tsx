import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCopy } from "@/hooks/useCopy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Copy, Pencil, Save, X, Trash2, Landmark, GripVertical, Move } from "lucide-react";
import { toast } from "sonner";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type BankAccount = {
  id: string;
  bank_name: string;
  account_number: string;
  iban: string;
  beneficiary_name: string;
  notes: string | null;
  sort_order?: number;
};

export default function BankAccounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const copy = useCopy();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<BankAccount>>({});
  const [adding, setAdding] = useState(false);
  const [newData, setNewData] = useState<Partial<BankAccount>>({ bank_name: "", account_number: "", iban: "", beneficiary_name: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [orderedIds, setOrderedIds] = useState<string[] | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["bank_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").order("sort_order").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (account: Partial<BankAccount>) => {
      if (account.id) {
        const { error } = await supabase.from("bank_accounts").update(account).eq("id", account.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bank_accounts").insert({ ...account, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_accounts"] });
      setEditingId(null); setEditData({}); setAdding(false);
      setNewData({ bank_name: "", account_number: "", iban: "", beneficiary_name: "" });
      toast.success("تم الحفظ");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["bank_accounts"] }); setDeleteId(null); toast.success("تم الحذف"); },
    onError: (e: any) => toast.error(e.message),
  });

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id, idx) =>
          supabase.from("bank_accounts").update({ sort_order: idx }).eq("id", id)
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_accounts"] });
      toast.success("تم حفظ الترتيب");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const displayAccounts = (() => {
    if (!orderedIds) return accounts as BankAccount[];
    const map = new Map((accounts as BankAccount[]).map((a) => [a.id, a]));
    return orderedIds.map((id) => map.get(id)).filter(Boolean) as BankAccount[];
  })();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = displayAccounts.map((a) => a.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    const next = arrayMove(ids, oldIndex, newIndex);
    setOrderedIds(next);
    reorderMutation.mutate(next);
  };

  const formatFull = (a: BankAccount) => {
    let msg = `${a.bank_name}\n${a.beneficiary_name}`;
    if (a.account_number) msg += `\nN.Compt ${a.account_number}`;
    msg += `\nRIB ${a.iban}`;
    return msg;
  };

  const formatWithoutRib = (a: BankAccount) => {
    let msg = `${a.bank_name}\n${a.beneficiary_name}`;
    if (a.account_number) msg += `\nN.Compt ${a.account_number}`;
    return msg;
  };

  const startEdit = (a: BankAccount) => { setEditingId(a.id); setEditData({ ...a }); };

  const fields = (data: Partial<BankAccount>, setData: (d: Partial<BankAccount>) => void) => (
    <div className="space-y-2.5">
      <Input placeholder="اسم البنك" value={data.bank_name || ""} onChange={(e) => setData({ ...data, bank_name: e.target.value })} className="h-9 text-sm" />
      <Input placeholder="اسم صاحب الحساب" value={data.beneficiary_name || ""} onChange={(e) => setData({ ...data, beneficiary_name: e.target.value })} className="h-9 text-sm" />
      <Input placeholder="رقم الحساب (اختياري)" value={data.account_number || ""} onChange={(e) => setData({ ...data, account_number: e.target.value })} className="h-9 text-sm" />
      <Input placeholder="RIB" value={data.iban || ""} onChange={(e) => setData({ ...data, iban: e.target.value })} className="h-9 text-sm" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">الحسابات البنكية</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => { setReorderMode((v) => !v); setOrderedIds(null); }}
            size="sm"
            variant={reorderMode ? "default" : "outline"}
            className="gap-1.5"
            disabled={accounts.length < 2}
          >
            <Move className="h-3.5 w-3.5" /> {reorderMode ? "إنهاء الترتيب" : "ترتيب"}
          </Button>
          <Button onClick={() => setAdding(true)} size="sm" disabled={adding || reorderMode} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> إضافة
          </Button>
        </div>
      </div>

      {adding && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-3">
            {fields(newData, setNewData)}
            <div className="flex gap-2">
              <Button onClick={() => upsertMutation.mutate(newData)} disabled={upsertMutation.isPending} size="sm" className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> حفظ
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAdding(false)} className="gap-1.5">
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
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Landmark className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">لا توجد حسابات بنكية بعد</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={displayAccounts.map((a) => a.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {displayAccounts.map((account) => (
                <SortableAccountCard
                  key={account.id}
                  account={account}
                  reorderMode={reorderMode}
                  isEditing={editingId === account.id}
                  editData={editData}
                  setEditData={setEditData}
                  fields={fields}
                  formatFull={formatFull}
                  formatWithoutRib={formatWithoutRib}
                  copy={copy}
                  startEdit={startEdit}
                  setEditingId={setEditingId}
                  setDeleteId={setDeleteId}
                  upsertMutation={upsertMutation}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف هذا الحساب البنكي نهائياً.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableAccountCard({
  account, reorderMode, isEditing, editData, setEditData, fields,
  formatFull, formatWithoutRib, copy, startEdit, setEditingId, setDeleteId, upsertMutation,
}: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: account.id,
    disabled: !reorderMode,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`border-border/50 hover:border-border transition-colors ${reorderMode ? "ring-2 ring-primary/30" : ""}`}>
        <CardContent className="pt-4">
          {reorderMode ? (
            <div className="flex items-center gap-3 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
              <GripVertical className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="whitespace-pre-line text-sm leading-relaxed bg-muted/30 rounded-lg p-3 font-mono flex-1">
                {formatFull(account)}
              </div>
            </div>
          ) : isEditing ? (
            <div className="space-y-3">
              {fields(editData, setEditData)}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => upsertMutation.mutate(editData)} disabled={upsertMutation.isPending} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> حفظ
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="gap-1.5">
                  <X className="h-3.5 w-3.5" /> إلغاء
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="whitespace-pre-line text-sm leading-relaxed bg-muted/30 rounded-lg p-3 font-mono">
                {formatFull(account)}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" onClick={() => copy(formatFull(account))} className="gap-1.5 h-8 text-xs">
                  <Copy className="h-3 w-3" /> نسخ الكل
                </Button>
                <Button size="sm" variant="secondary" onClick={() => copy(formatWithoutRib(account))} className="gap-1.5 h-8 text-xs">
                  <Copy className="h-3 w-3" /> بدون RIB
                </Button>
                <Button size="sm" variant="outline" onClick={() => startEdit(account)} className="gap-1.5 h-8 text-xs">
                  <Pencil className="h-3 w-3" /> تعديل
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive gap-1.5 h-8 text-xs" onClick={() => setDeleteId(account.id)}>
                  <Trash2 className="h-3 w-3" /> حذف
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
