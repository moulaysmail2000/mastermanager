import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCopy } from "@/hooks/useCopy";
import { toast } from "sonner";
import { format, differenceInDays, addMonths, addYears } from "date-fns";
import { ar } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Copy, Trash2, PhoneOff, CalendarClock, Tags, CalendarIcon, Camera, Loader2, ClipboardPaste, XCircle, Hourglass, RefreshCw, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Move, GripVertical } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const STATUS_CONFIG = {
  not_paid:        { label: "لم يدفع",       icon: XCircle,       dot: "bg-red-500",     border: "border-red-500/40",     bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400",       solid: "bg-red-500 text-white",     ring: "ring-red-500/40" },
  waiting_account: { label: "بانتظار حساب",  icon: Hourglass,     dot: "bg-amber-500",   border: "border-amber-500/40",   bg: "bg-amber-500/10",   text: "text-amber-600 dark:text-amber-400",   solid: "bg-amber-500 text-white",   ring: "ring-amber-500/40" },
  replace_account: { label: "تبديل حساب",    icon: RefreshCw,     dot: "bg-sky-500",     border: "border-sky-500/40",     bg: "bg-sky-500/10",     text: "text-sky-600 dark:text-sky-400",       solid: "bg-sky-500 text-white",     ring: "ring-sky-500/40" },
  attention:       { label: "انتباه",        icon: AlertTriangle, dot: "bg-fuchsia-500", border: "border-fuchsia-500/40", bg: "bg-fuchsia-500/10", text: "text-fuchsia-600 dark:text-fuchsia-400", solid: "bg-fuchsia-500 text-white", ring: "ring-fuchsia-500/40" },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

function openWhatsAppDirect(raw: string) {
  let full = (raw || "").replace(/\D/g, "");
  if (!full) return;
  // Moroccan local number starting with 0 → +212
  if (full.startsWith("0")) full = "212" + full.slice(1);
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    window.location.href = `intent://send/?phone=${full}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`;
    setTimeout(() => {
      window.location.href = `intent://send/?phone=${full}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
    }, 1200);
  } else {
    window.location.href = `whatsapp://send?phone=${full}`;
  }
}

function WhatsAppBtn({ phone }: { phone: string }) {
  return (
    <button
      type="button"
      onClick={() => openWhatsAppDirect(phone)}
      title="فتح في واتساب"
      className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-md"
      style={{ background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)" }}
    >
      <svg viewBox="0 0 32 32" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
        <path
          fill="#FFFFFF"
          d="M22.5 18.6c-.36-.18-2.13-1.05-2.46-1.17-.33-.12-.57-.18-.81.18-.24.36-.93 1.17-1.14 1.41-.21.24-.42.27-.78.09-.36-.18-1.52-.56-2.89-1.78-1.07-.95-1.79-2.13-2-2.49-.21-.36-.02-.55.16-.73.16-.16.36-.42.54-.63.18-.21.24-.36.36-.6.12-.24.06-.45-.03-.63-.09-.18-.81-1.95-1.11-2.67-.29-.7-.59-.6-.81-.61-.21-.01-.45-.01-.69-.01-.24 0-.63.09-.96.45-.33.36-1.26 1.23-1.26 3 0 1.77 1.29 3.48 1.47 3.72.18.24 2.54 3.88 6.16 5.44.86.37 1.53.59 2.05.76.86.27 1.65.23 2.27.14.69-.1 2.13-.87 2.43-1.71.3-.84.3-1.56.21-1.71-.09-.15-.33-.24-.69-.42z"
        />
        <path
          fill="#FFFFFF"
          d="M27.2 4.8C24.2 1.7 20.2 0 16 0 7.4 0 .4 7 .4 15.6c0 2.7.7 5.4 2.1 7.7L.3 32l8.9-2.3c2.2 1.2 4.7 1.9 7.2 1.9h.01c8.6 0 15.6-7 15.6-15.6 0-4.2-1.6-8.1-4.6-11.1zM16 28.95h-.01c-2.3 0-4.55-.62-6.51-1.78l-.47-.28-4.84 1.27 1.29-4.71-.3-.49a13.04 13.04 0 0 1-2-6.95c0-7.18 5.85-13.03 13.04-13.03 3.48 0 6.75 1.36 9.21 3.82a12.94 12.94 0 0 1 3.82 9.22c0 7.18-5.85 13.03-13.04 13.03z"
        />
      </svg>
    </button>
  );
}

function getExpiryColor(expiryDate: string) {
  const days = differenceInDays(new Date(expiryDate), new Date());
  if (days < 0) return { label: "منتهي", dot: "bg-destructive", border: "border-destructive/30", bg: "bg-destructive/10", text: "text-destructive" };
  if (days <= 3) return { label: `${days} أيام`, dot: "bg-warning", border: "border-warning/30", bg: "bg-warning/10", text: "text-warning" };
  if (days <= 7) return { label: `${days} أيام`, dot: "bg-info", border: "border-info/30", bg: "bg-info/10", text: "text-info" };
  return { label: `${days} يوم`, dot: "bg-success", border: "border-success/30", bg: "bg-success/10", text: "text-success" };
}

export default function UnpaidNumbers() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const copy = useCopy();
  const [newNumber, setNewNumber] = useState("");
  const [newStatus, setNewStatus] = useState<StatusKey>(() => {
    try {
      const saved = localStorage.getItem("unpaid_last_status");
      if (saved && saved in STATUS_CONFIG) return saved as StatusKey;
    } catch {}
    return "waiting_account";
  });
  useEffect(() => {
    try { localStorage.setItem("unpaid_last_status", newStatus); } catch {}
  }, [newStatus]);
  const [adding, setAdding] = useState(false);
  const [addingExpiry, setAddingExpiry] = useState(false);
  const [newExpiryNumber, setNewExpiryNumber] = useState("");
  const [newExpiryStartDate, setNewExpiryStartDate] = useState<Date>(new Date());
  const [newExpiryDuration, setNewExpiryDuration] = useState<number | null>(null);
  const [newExpiryNotes, setNewExpiryNotes] = useState("");
  const [manualDateMode, setManualDateMode] = useState(false);
  const [manualEndDate, setManualEndDate] = useState<Date>(new Date());
  const [filterStatus, setFilterStatus] = useState<StatusKey | "all">("all");
  const [tabsOrder, setTabsOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("unpaid_tabs_order");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 2) return parsed;
      }
    } catch {}
    return ["expiry", "classification"];
  });
  const [activeTab, setActiveTab] = useState(tabsOrder[0]);
  const [reorderMode, setReorderMode] = useState(false);
  const [orderedUnpaidIds, setOrderedUnpaidIds] = useState<string[] | null>(null);
  const [orderedExpiryIds, setOrderedExpiryIds] = useState<string[] | null>(null);

  // Camera OCR state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraNumber, setCameraNumber] = useState("");
  const [cameraDuration, setCameraDuration] = useState<number | null>(null);
  const [cameraProcessing, setCameraProcessing] = useState(false);
  const [cameraStep, setCameraStep] = useState<"capture" | "confirm">("capture");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Unpaid numbers query
  const { data: numbers = [], isLoading } = useQuery({
    queryKey: ["unpaid_numbers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("unpaid_numbers").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Expiry dates query
  const { data: expiryDates = [], isLoading: isLoadingExpiry } = useQuery({
    queryKey: ["expiry_dates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expiry_dates").select("*").order("sort_order", { ascending: true }).order("expiry_date", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  // Unpaid mutations
  const addMutation = useMutation({
    mutationFn: async ({ phone, status }: { phone: string; status: string }) => {
      const { error } = await supabase.from("unpaid_numbers").insert({ phone_number: phone, user_id: session!.user.id, status });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["unpaid_numbers"] }); setNewNumber(""); setAdding(false); toast.success("تمت الإضافة"); },
    onError: () => toast.error("فشلت الإضافة"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const sort_order = Math.floor(9999999999999 - Date.now());
      const { error } = await supabase.from("unpaid_numbers").update({ status, sort_order }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["unpaid_numbers"] }); toast.success("تم تحديث الحالة"); },
    onError: () => toast.error("فشل التحديث"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("unpaid_numbers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["unpaid_numbers"] }); toast.success("تم الحذف"); },
    onError: () => toast.error("فشل الحذف"),
  });

  const DURATION_OPTIONS = [
    { label: "شهر", months: 1 },
    { label: "شهرين", months: 2 },
    { label: "3 أشهر", months: 3 },
    { label: "6 أشهر", months: 6 },
    { label: "عام", months: 12 },
  ];

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraProcessing(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("extract-phone", { body: { image: base64 } });
      if (error) throw error;
      const phone = data?.phoneNumber;
      if (!phone || phone === "NOT_FOUND") {
        toast.error("لم يتم العثور على رقم في الصورة");
        setCameraProcessing(false);
        return;
      }
      setCameraNumber(phone);
      setCameraStep("confirm");
    } catch (err) {
      console.error(err);
      toast.error("فشل استخراج الرقم");
    }
    setCameraProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCameraSave = () => {
    if (!cameraNumber || cameraDuration === null) return;
    const start = new Date();
    const end = addMonths(start, cameraDuration);
    addExpiryMutation.mutate({
      phone: cameraNumber,
      start_date: format(start, "yyyy-MM-dd"),
      expiry_date: format(end, "yyyy-MM-dd"),
      notes: "",
    });
    setCameraOpen(false);
    setCameraNumber("");
    setCameraDuration(null);
    setCameraStep("capture");
  };

  const computedExpiryDate = newExpiryDuration !== null ? addMonths(newExpiryStartDate, newExpiryDuration) : null;

  const addExpiryMutation = useMutation({
    mutationFn: async ({ phone, start_date, expiry_date, notes }: { phone: string; start_date: string; expiry_date: string; notes: string }) => {
      const { error } = await supabase.from("expiry_dates").insert({ phone_number: phone, start_date, expiry_date, notes, user_id: session!.user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expiry_dates"] });
      setNewExpiryNumber(""); setNewExpiryStartDate(new Date()); setNewExpiryDuration(null); setNewExpiryNotes(""); setAddingExpiry(false);
      toast.success("تمت الإضافة");
    },
    onError: () => toast.error("فشلت الإضافة"),
  });

  const deleteExpiryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expiry_dates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expiry_dates"] }); toast.success("تم الحذف"); },
    onError: () => toast.error("فشل الحذف"),
  });

  const reorderUnpaidMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id, idx) => supabase.from("unpaid_numbers").update({ sort_order: idx }).eq("id", id)));
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["unpaid_numbers"] }); toast.success("تم حفظ الترتيب"); },
    onError: () => toast.error("فشل الترتيب"),
  });

  const reorderExpiryMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id, idx) => supabase.from("expiry_dates").update({ sort_order: idx }).eq("id", id)));
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expiry_dates"] }); toast.success("تم حفظ الترتيب"); },
    onError: () => toast.error("فشل الترتيب"),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const handleTabsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const next = arrayMove(tabsOrder, tabsOrder.indexOf(active.id as string), tabsOrder.indexOf(over.id as string));
    setTabsOrder(next);
    try { localStorage.setItem("unpaid_tabs_order", JSON.stringify(next)); } catch {}
    toast.success("تم حفظ ترتيب التبويبات");
  };

  const TAB_META: Record<string, { label: string; icon: typeof CalendarClock }> = {
    expiry: { label: "تواريخ الانتهاء", icon: CalendarClock },
    classification: { label: "تصنيف الأرقام", icon: Tags },
  };

  const displayUnpaid = (() => {
    const filtered = (numbers as any[]).filter(n => filterStatus === "all" || n.status === filterStatus);
    if (!orderedUnpaidIds) return filtered;
    const map = new Map(filtered.map((a) => [a.id, a]));
    return orderedUnpaidIds.map((id) => map.get(id)).filter(Boolean);
  })();

  const displayExpiry = (() => {
    if (!orderedExpiryIds) return expiryDates as any[];
    const map = new Map((expiryDates as any[]).map((a) => [a.id, a]));
    return orderedExpiryIds.map((id) => map.get(id)).filter(Boolean);
  })();

  const handleUnpaidDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = displayUnpaid.map((a: any) => a.id);
    const next = arrayMove(ids, ids.indexOf(active.id as string), ids.indexOf(over.id as string));
    setOrderedUnpaidIds(next);
    reorderUnpaidMutation.mutate(next);
  };

  const handleExpiryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = displayExpiry.map((a: any) => a.id);
    const next = arrayMove(ids, ids.indexOf(active.id as string), ids.indexOf(over.id as string));
    setOrderedExpiryIds(next);
    reorderExpiryMutation.mutate(next);
  };

  return (
    <div className="space-y-3">
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <div className="flex items-center justify-between">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTabsDragEnd}>
            <SortableContext items={tabsOrder} strategy={verticalListSortingStrategy}>
              <TabsList className="bg-muted/50">
                {tabsOrder.map((tabKey) => {
                  const meta = TAB_META[tabKey];
                  const Icon = meta.icon;
                  return (
                    <SortableRow key={tabKey} id={tabKey} reorderMode={reorderMode}>
                      <TabsTrigger value={tabKey} className="gap-1.5 text-xs" disabled={reorderMode}>
                        {reorderMode && <GripVertical className="h-3 w-3 text-muted-foreground" />}
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </TabsTrigger>
                    </SortableRow>
                  );
                })}
              </TabsList>
            </SortableContext>
          </DndContext>
          <div className="flex gap-2">
            <Button size="sm" variant={reorderMode ? "default" : "outline"} onClick={() => setReorderMode(v => !v)} className="gap-1.5">
              <Move className="h-3.5 w-3.5" /> {reorderMode ? "إنهاء" : "ترتيب التبويبات"}
            </Button>
            {activeTab === "classification" && !adding && !reorderMode && (
              <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  title="إضافة من الحافظة"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      const digits = (text || "").replace(/\D/g, "");
                      if (!digits || digits.length < 6) { toast.error("لا يوجد رقم في الحافظة"); return; }
                       setNewNumber(digits);
                       setAdding(true);
                    } catch {
                      toast.error("تعذر قراءة الحافظة");
                    }
                  }}
                >
                  <ClipboardPaste className="h-3.5 w-3.5" /> لصق
              </Button>
            )}
            {activeTab === "expiry" && !addingExpiry && !reorderMode && (
              <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  title="لصق رقم من الحافظة"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      const digits = (text || "").replace(/\D/g, "");
                      if (!digits || digits.length < 6) { toast.error("لا يوجد رقم في الحافظة"); return; }
                      setNewExpiryNumber(digits);
                      setAddingExpiry(true);
                    } catch {
                      toast.error("تعذر قراءة الحافظة");
                    }
                  }}
                >
                  <ClipboardPaste className="h-3.5 w-3.5" /> لصق
              </Button>
            )}
          </div>
        </div>

        {/* ===== Classification Tab ===== */}
        <TabsContent value="classification" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterStatus("all")}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all",
                filterStatus === "all" ? "border-primary/30 bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:border-border"
              )}
            >الكل</button>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key as StatusKey)}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all",
                  filterStatus === key ? cn(cfg.bg, cfg.border, cfg.text) : "border-border/50 text-muted-foreground hover:border-border"
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", cfg.dot)} />
                {cfg.label}
              </button>
            ))}
          </div>

          {adding && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <Input placeholder="أدخل الرقم..." value={newNumber} onChange={(e) => setNewNumber(e.target.value)} dir="ltr" className="h-9 text-sm" />
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setNewStatus(key as StatusKey)}
                      className={cn(
                        "text-xs font-semibold py-1.5 px-3 rounded-lg border-2 transition-all",
                        newStatus === key ? cn(cfg.bg, cfg.border, cfg.text) : "border-border/50 text-muted-foreground hover:border-border"
                      )}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewNumber(""); }}>إلغاء</Button>
                  <Button size="sm" onClick={() => newNumber.trim() && addMutation.mutate({ phone: newNumber.trim(), status: newStatus })} disabled={addMutation.isPending}>حفظ</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-muted-foreground animate-pulse text-sm">جاري التحميل...</p>
            </div>
          ) : numbers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <PhoneOff className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">لا توجد أرقام</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleUnpaidDragEnd}>
              <SortableContext items={displayUnpaid.map((a: any) => a.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {displayUnpaid.map((n: any) => {
                    const status = n.status as StatusKey;
                    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.waiting_account;
                    return (
                      <SortableRow key={n.id} id={n.id} reorderMode={false}>
                        <Card className={cn("border-r-4 transition-all hover:shadow-md", cfg.border, cfg.bg)}>
                          <CardContent className="p-2 flex items-center gap-2" dir="ltr">
                            <WhatsAppBtn phone={n.phone_number} />
                            <div className="flex items-center gap-1 shrink-0">
                              <div className="flex gap-1">
                                {Object.entries(STATUS_CONFIG).map(([key, c]) => {
                                  const active = key === status;
                                  return (
                                    <button
                                      key={key}
                                      title={c.label}
                                      onClick={() => !active && updateStatusMutation.mutate({ id: n.id, status: key })}
                                      className={cn(
                                        "h-3.5 w-3.5 rounded-full transition-all hover:scale-125",
                                        active ? cn(c.dot, "ring-2 ring-foreground/40 shadow") : cn(c.dot, "opacity-30 hover:opacity-100")
                                      )}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 shadow-sm", cfg.solid)}>
                                {cfg.label}
                              </span>
                              <span className={cn("font-semibold text-sm truncate", cfg.text)} dir="ltr">{n.phone_number}</span>
                            </div>
                            <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent dir="rtl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                      <AlertDialogDescription>هل أنت متأكد من حذف الرقم {n.phone_number}؟</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="flex-row-reverse gap-2">
                                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate(n.id)}>حذف</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                          </CardContent>
                        </Card>
                      </SortableRow>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </TabsContent>

        {/* ===== Expiry Tab ===== */}
        <TabsContent value="expiry" className="space-y-4">
          {addingExpiry && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <Input placeholder="أدخل الرقم..." value={newExpiryNumber} onChange={(e) => setNewExpiryNumber(e.target.value)} dir="ltr" className="h-9 text-sm" />
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("flex-1 justify-start text-right font-normal h-9 text-sm")}>
                        <CalendarIcon className="ml-2 h-3.5 w-3.5" />
                        تاريخ البداية: {format(newExpiryStartDate, "yyyy/MM/dd")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={newExpiryStartDate} onSelect={(d) => d && setNewExpiryStartDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
                {!manualDateMode && (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {DURATION_OPTIONS.map((opt) => (
                        <button
                          key={opt.months}
                          onClick={() => setNewExpiryDuration(opt.months)}
                          className={cn(
                            "text-xs font-semibold py-1.5 px-3 rounded-lg border-2 transition-all",
                            newExpiryDuration === opt.months ? "border-primary/50 bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:border-border"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {computedExpiryDate && (
                      <p className="text-xs text-muted-foreground">
                        تاريخ الانتهاء: <span className="text-foreground font-medium">{format(computedExpiryDate, "yyyy/MM/dd")}</span>
                      </p>
                    )}
                  </>
                )}
                {manualDateMode && (
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="flex-1 justify-start text-right font-normal h-9 text-sm">
                          <CalendarIcon className="ml-2 h-3.5 w-3.5" />
                          تاريخ الانتهاء: {format(manualEndDate, "yyyy/MM/dd")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={manualEndDate} onSelect={(d) => d && setManualEndDate(d)} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input placeholder="ملاحظات (اختياري)..." value={newExpiryNotes} onChange={(e) => setNewExpiryNotes(e.target.value)} className="h-9 text-sm flex-1" />
                  <Button
                    size="sm"
                    variant={manualDateMode ? "default" : "outline"}
                    className="text-xs h-9 shrink-0"
                    onClick={() => { setManualDateMode(!manualDateMode); setNewExpiryDuration(null); }}
                  >
                    {manualDateMode ? "وضع يدوي ✓" : "يدوي"}
                  </Button>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => { setAddingExpiry(false); setNewExpiryNumber(""); setNewExpiryStartDate(new Date()); setNewExpiryDuration(null); setNewExpiryNotes(""); setManualDateMode(false); }}>إلغاء</Button>
                  <Button
                    size="sm"
                    disabled={!newExpiryNumber.trim() || (!manualDateMode && !computedExpiryDate) || addExpiryMutation.isPending}
                    onClick={() => {
                      const finalEnd = manualDateMode ? manualEndDate : computedExpiryDate;
                      if (newExpiryNumber.trim() && finalEnd) {
                        addExpiryMutation.mutate({
                          phone: newExpiryNumber.trim(),
                          start_date: format(newExpiryStartDate, "yyyy-MM-dd"),
                          expiry_date: format(finalEnd, "yyyy-MM-dd"),
                          notes: newExpiryNotes.trim(),
                        });
                      }
                    }}
                  >حفظ</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoadingExpiry ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-muted-foreground animate-pulse text-sm">جاري التحميل...</p>
            </div>
          ) : expiryDates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <CalendarClock className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">لا توجد تواريخ انتهاء</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleExpiryDragEnd}>
              <SortableContext items={displayExpiry.map((a: any) => a.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {displayExpiry.map((item: any) => {
                    const color = getExpiryColor(item.expiry_date);
                    return (
                      <SortableRow key={item.id} id={item.id} reorderMode={false}>
                        <Card className={cn("border-r-4 transition-colors hover:bg-muted/20", color.border, color.bg)}>
                          <CardContent className="p-2 space-y-1" dir="ltr">
                      {/* Row 1: Number + actions */}
                      <div className="flex items-center gap-2">
                        <WhatsAppBtn phone={item.phone_number} />
                        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                          {item.notes && <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">{item.notes} —</span>}
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 shadow-sm text-white", color.dot)}>
                            {color.label}
                          </span>
                          <span className={cn("font-semibold text-sm truncate", color.text)} dir="ltr">{item.phone_number}</span>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                <AlertDialogDescription>هل أنت متأكد من حذف {item.phone_number}؟</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex-row-reverse gap-2">
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteExpiryMutation.mutate(item.id)}>حذف</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                      </div>
                      {/* Row 2: Dates + notes (mobile) */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pr-3">
                        <span dir="ltr">
                          {format(new Date(item.start_date), "MM/dd")} → {format(new Date(item.expiry_date), "MM/dd")}
                        </span>
                        {item.notes && <span className="sm:hidden truncate max-w-[100px]">{item.notes}</span>}
                      </div>
                          </CardContent>
                        </Card>
                      </SortableRow>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </TabsContent>
      </Tabs>

      {/* Camera FAB */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
      />
      <button
        onClick={() => {
          setCameraStep("capture");
          setCameraNumber("");
          setCameraDuration(null);
          setCameraOpen(true);
          setTimeout(() => fileInputRef.current?.click(), 100);
        }}
        className="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center transition-transform hover:scale-110"
      >
        {cameraProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
      </button>

      {/* Camera confirm dialog */}
      <Dialog open={cameraOpen && cameraStep === "confirm"} onOpenChange={(open) => { if (!open) { setCameraOpen(false); setCameraStep("capture"); } }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>إضافة رقم سريعة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-muted-foreground text-sm mb-1">الرقم المستخرج</p>
              <p className="text-2xl font-bold tracking-wider" dir="ltr">{cameraNumber}</p>
            </div>
            <Input
              value={cameraNumber}
              onChange={(e) => setCameraNumber(e.target.value)}
              dir="ltr"
              className="text-center text-lg h-11"
              placeholder="تعديل الرقم..."
            />
            <div>
              <p className="text-sm text-muted-foreground mb-2">اختر المدة:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.months}
                    onClick={() => setCameraDuration(opt.months)}
                    className={cn(
                      "text-sm font-semibold py-2 px-4 rounded-lg border-2 transition-all",
                      cameraDuration === opt.months
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border/50 text-muted-foreground hover:border-border"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {cameraDuration !== null && (
              <p className="text-xs text-muted-foreground text-center">
                {format(new Date(), "yyyy/MM/dd")} → <span className="text-foreground font-medium">{format(addMonths(new Date(), cameraDuration), "yyyy/MM/dd")}</span>
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setCameraOpen(false); setCameraStep("capture"); }}>إلغاء</Button>
              <Button disabled={!cameraNumber.trim() || cameraDuration === null} onClick={handleCameraSave}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableRow({ id, reorderMode, children }: { id: string; reorderMode: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !reorderMode });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...(reorderMode ? { ...attributes, ...listeners } : {})} className={reorderMode ? "cursor-grab active:cursor-grabbing touch-none select-none" : undefined}>
      {children}
    </div>
  );
}
