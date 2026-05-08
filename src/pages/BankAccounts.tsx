import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCopy } from "@/hooks/useCopy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Copy, Pencil, Save, X, Trash2, Landmark, GripVertical, Move, Wallet, Bitcoin } from "lucide-react";
import { toast } from "sonner";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const BinanceLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 126.61 126.61" className={className} aria-label="Binance">
    <g fill="#f3ba2f">
      <path d="M38.73 53.2L63.31 28.62 87.9 53.21 102.2 38.91 63.31 0 24.43 38.9z"/>
      <path d="M0 63.31l14.3-14.3 14.29 14.3-14.3 14.29z"/>
      <path d="M38.73 73.41L63.31 97.99 87.9 73.4 102.2 87.7 63.32 126.6 24.43 87.71 24.43 87.7z"/>
      <path d="M98.02 63.31l14.3-14.3 14.29 14.3-14.3 14.3z"/>
      <path d="M77.81 63.3L63.31 48.78 52.59 59.5 51.36 60.73 48.83 63.27 48.81 63.29 48.81 63.31 48.83 63.33 63.31 77.83 77.82 63.32 77.83 63.31z"/>
    </g>
  </svg>
);

const PayPalLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 124 33" className={className} aria-label="PayPal">
    <path fill="#003087" d="M46.21 6.75h-6.84a.95.95 0 00-.94.8l-2.77 17.54a.57.57 0 00.56.66h3.27a.95.95 0 00.94-.8l.74-4.73a.95.95 0 01.94-.8h2.16c4.51 0 7.11-2.18 7.79-6.5.31-1.89.01-3.38-.87-4.42-.97-1.14-2.7-1.75-4.98-1.75zm.79 6.41c-.37 2.45-2.24 2.45-4.05 2.45h-1.03l.72-4.58a.57.57 0 01.57-.48h.47c1.23 0 2.39 0 2.99.7.36.42.47 1.04.33 1.91zM65.99 13.08h-3.28a.57.57 0 00-.57.48l-.14.92-.23-.33c-.71-1.03-2.3-1.38-3.88-1.38-3.64 0-6.75 2.76-7.36 6.63-.31 1.93.14 3.78 1.24 5.07.99 1.18 2.42 1.67 4.11 1.67a6.27 6.27 0 004.54-1.88l-.15.91a.57.57 0 00.56.66h2.95a.95.95 0 00.94-.8l1.77-11.21a.57.57 0 00-.5-.74zm-4.57 6.42c-.31 1.88-1.81 3.15-3.71 3.15-.96 0-1.72-.31-2.21-.89-.49-.58-.67-1.41-.51-2.34.29-1.87 1.81-3.18 3.69-3.18.94 0 1.7.31 2.2.9.5.6.7 1.43.54 2.36zM83.5 13.08h-3.3a.95.95 0 00-.79.42l-4.55 6.7-1.93-6.44a.95.95 0 00-.91-.68h-3.24a.57.57 0 00-.54.75l3.63 10.66-3.42 4.82a.57.57 0 00.46.9h3.29a.95.95 0 00.78-.41l10.97-15.83a.57.57 0 00-.45-.89z"/>
    <path fill="#0070e0" d="M94.42 6.75h-6.84a.95.95 0 00-.94.8l-2.77 17.54a.57.57 0 00.56.66h3.51a.66.66 0 00.66-.56l.78-4.97a.95.95 0 01.94-.8h2.16c4.51 0 7.11-2.18 7.79-6.5.31-1.89.01-3.38-.87-4.42-.97-1.14-2.7-1.75-4.98-1.75zm.79 6.41c-.37 2.45-2.24 2.45-4.05 2.45h-1.03l.72-4.58a.57.57 0 01.57-.48h.47c1.23 0 2.39 0 2.99.7.36.42.47 1.04.33 1.91zM114.21 13.08h-3.28a.57.57 0 00-.56.48l-.14.92-.23-.33c-.71-1.03-2.3-1.38-3.88-1.38-3.64 0-6.75 2.76-7.36 6.63-.31 1.93.14 3.78 1.24 5.07.99 1.18 2.42 1.67 4.11 1.67a6.27 6.27 0 004.54-1.88l-.15.91a.57.57 0 00.56.66h2.95a.95.95 0 00.94-.8l1.77-11.21a.57.57 0 00-.51-.74zm-4.57 6.42c-.31 1.88-1.81 3.15-3.71 3.15-.96 0-1.72-.31-2.21-.89-.49-.58-.67-1.41-.51-2.34.29-1.87 1.81-3.18 3.69-3.18.94 0 1.7.31 2.2.9.5.6.7 1.43.54 2.36zM118.08 7.23l-2.81 17.86a.57.57 0 00.56.66h2.82a.95.95 0 00.94-.8l2.78-17.54a.57.57 0 00-.56-.66h-3.16a.57.57 0 00-.57.48z"/>
  </svg>
);

type BankAccount = {
  id: string;
  bank_name: string;
  account_number: string;
  iban: string;
  beneficiary_name: string;
  notes: string | null;
  sort_order?: number;
  account_type?: string;
};

type AcctType = "bank" | "paypal" | "binance";

const TYPE_META: Record<AcctType, { label: string; icon: any }> = {
  bank: { label: "بنكي", icon: Landmark },
  paypal: { label: "PayPal", icon: Wallet },
  binance: { label: "Binance", icon: Bitcoin },
};

export default function BankAccounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const copy = useCopy();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<BankAccount>>({});
  const [adding, setAdding] = useState(false);
  const [newData, setNewData] = useState<Partial<BankAccount>>({ bank_name: "", account_number: "", iban: "", beneficiary_name: "", account_type: "bank" });
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
      setNewData({ bank_name: "", account_number: "", iban: "", beneficiary_name: "", account_type: "bank" });
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
    const t = (a.account_type || "bank") as AcctType;
    if (t === "paypal") {
      let msg = `PayPal\n${a.beneficiary_name}`;
      if (a.account_number) msg += `\nEmail: ${a.account_number}`;
      if (a.iban) msg += `\n${a.iban}`;
      return msg;
    }
    if (t === "binance") {
      let msg = `Binance\n${a.beneficiary_name}`;
      if (a.account_number) msg += `\nID: ${a.account_number}`;
      return msg;
    }
    let msg = `${a.bank_name}\n${a.beneficiary_name}`;
    if (a.account_number) msg += `\nN.Compt ${a.account_number}`;
    if (a.iban) msg += `\nRIB ${a.iban}`;
    return msg;
  };

  const formatWithoutRib = (a: BankAccount) => {
    const t = (a.account_type || "bank") as AcctType;
    if (t === "paypal") {
      let msg = `PayPal\n${a.beneficiary_name}`;
      if (a.account_number) msg += `\nEmail: ${a.account_number}`;
      return msg;
    }
    let msg = `${a.bank_name}\n${a.beneficiary_name}`;
    if (a.account_number) msg += `\nN.Compt ${a.account_number}`;
    return msg;
  };

  const startEdit = (a: BankAccount) => { setEditingId(a.id); setEditData({ ...a }); };

  const fields = (data: Partial<BankAccount>, setData: (d: Partial<BankAccount>) => void) => {
    const t = ((data.account_type as AcctType) || "bank");
    return (
      <div className="space-y-2.5">
        <div className="flex gap-1.5">
          {(Object.keys(TYPE_META) as AcctType[]).map((k) => {
            const Icon = TYPE_META[k].icon;
            const active = t === k;
            return (
              <Button
                key={k}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => setData({ ...data, account_type: k, ...(k !== "bank" ? { bank_name: TYPE_META[k].label } : {}) })}
                className="gap-1.5 h-8 text-xs flex-1"
              >
                <Icon className="h-3.5 w-3.5" /> {TYPE_META[k].label}
              </Button>
            );
          })}
        </div>
        {t === "bank" && (
          <Input placeholder="اسم البنك" value={data.bank_name || ""} onChange={(e) => setData({ ...data, bank_name: e.target.value })} className="h-9 text-sm" />
        )}
        <Input placeholder={t === "binance" ? "اسم صاحب الحساب" : "اسم صاحب الحساب"} value={data.beneficiary_name || ""} onChange={(e) => setData({ ...data, beneficiary_name: e.target.value })} className="h-9 text-sm" />
        {t === "bank" && (
          <>
            <Input placeholder="رقم الحساب (اختياري)" value={data.account_number || ""} onChange={(e) => setData({ ...data, account_number: e.target.value })} className="h-9 text-sm" />
            <Input placeholder="RIB" value={data.iban || ""} onChange={(e) => setData({ ...data, iban: e.target.value })} className="h-9 text-sm" />
          </>
        )}
        {t === "paypal" && (
          <>
            <Input placeholder="البريد الإلكتروني (PayPal)" value={data.account_number || ""} onChange={(e) => setData({ ...data, account_number: e.target.value })} className="h-9 text-sm" />
            <Input placeholder="ملاحظة إضافية (اختياري)" value={data.iban || ""} onChange={(e) => setData({ ...data, iban: e.target.value })} className="h-9 text-sm" />
          </>
        )}
        {t === "binance" && (
          <Input placeholder="Binance ID" value={data.account_number || ""} onChange={(e) => setData({ ...data, account_number: e.target.value })} className="h-9 text-sm" />
        )}
      </div>
    );
  };

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
                {(account.account_type || "bank") === "bank" && (
                  <Button size="sm" variant="secondary" onClick={() => copy(formatWithoutRib(account))} className="gap-1.5 h-8 text-xs">
                    <Copy className="h-3 w-3" /> بدون RIB
                  </Button>
                )}
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
