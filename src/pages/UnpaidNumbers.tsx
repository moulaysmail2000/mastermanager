import { useState, useRef } from "react";
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
import { Plus, Copy, Trash2, PhoneOff, CalendarClock, Tags, CalendarIcon, Camera, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STATUS_CONFIG = {
  not_paid: { label: "لم يدفع", dot: "bg-destructive", border: "border-destructive/30", bg: "bg-destructive/10", text: "text-destructive" },
  waiting_account: { label: "بانتظار حساب", dot: "bg-warning", border: "border-warning/30", bg: "bg-warning/10", text: "text-warning" },
  replace_account: { label: "تبديل حساب", dot: "bg-info", border: "border-info/30", bg: "bg-info/10", text: "text-info" },
  attention: { label: "انتباه", dot: "bg-accent", border: "border-accent/30", bg: "bg-accent/10", text: "text-accent" },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

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
  const [newStatus, setNewStatus] = useState<StatusKey>("waiting_account");
  const [adding, setAdding] = useState(false);
  const [addingExpiry, setAddingExpiry] = useState(false);
  const [newExpiryNumber, setNewExpiryNumber] = useState("");
  const [newExpiryStartDate, setNewExpiryStartDate] = useState<Date>(new Date());
  const [newExpiryDuration, setNewExpiryDuration] = useState<number | null>(null);
  const [newExpiryNotes, setNewExpiryNotes] = useState("");
  const [manualDateMode, setManualDateMode] = useState(false);
  const [manualEndDate, setManualEndDate] = useState<Date>(new Date());
  const [filterStatus, setFilterStatus] = useState<StatusKey | "all">("all");
  const [activeTab, setActiveTab] = useState("expiry");

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
      const { data, error } = await supabase.from("unpaid_numbers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Expiry dates query
  const { data: expiryDates = [], isLoading: isLoadingExpiry } = useQuery({
    queryKey: ["expiry_dates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expiry_dates").select("*").order("expiry_date", { ascending: true });
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
      const { error } = await supabase.from("unpaid_numbers").update({ status }).eq("id", id);
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

  return (
    <div className="space-y-3">
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="expiry" className="gap-1.5 text-xs">
              <CalendarClock className="h-3.5 w-3.5" />
              تواريخ الانتهاء
            </TabsTrigger>
            <TabsTrigger value="classification" className="gap-1.5 text-xs">
              <Tags className="h-3.5 w-3.5" />
              تصنيف الأرقام
            </TabsTrigger>
          </TabsList>
          {activeTab === "classification" && !adding && (
            <Button size="sm" onClick={() => setAdding(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> إضافة رقم
            </Button>
          )}
          {activeTab === "expiry" && !addingExpiry && (
            <Button size="sm" onClick={() => setAddingExpiry(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> إضافة رقم
            </Button>
          )}
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
            <div className="space-y-1">
              {numbers.filter(n => filterStatus === "all" || (n as any).status === filterStatus).map((n) => {
                const status = (n as any).status as StatusKey;
                const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.waiting_account;
                return (
                  <Card key={n.id} className={cn("border-r-4 transition-colors hover:bg-muted/20", cfg.border)}>
                    <CardContent className="p-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
                        <span className="font-medium text-xs text-foreground" dir="ltr">{n.phone_number}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="flex gap-0.5 mr-2">
                          {Object.entries(STATUS_CONFIG).map(([key, c]) => (
                            <button
                              key={key}
                              title={c.label}
                              onClick={() => key !== status && updateStatusMutation.mutate({ id: n.id, status: key })}
                              className={cn(
                                "h-3 w-3 rounded-full border-2 transition-all hover:scale-125",
                                key === status ? cn(c.dot, "border-foreground/20") : "border-border/40 opacity-30 hover:opacity-100"
                              )}
                            >
                              <span className={cn("block h-full w-full rounded-full", key !== status ? c.dot : "")} />
                            </button>
                          ))}
                        </div>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(n.phone_number)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
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
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
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
            <div className="space-y-1">
              {expiryDates.map((item) => {
                const color = getExpiryColor(item.expiry_date);
                return (
                  <Card key={item.id} className={cn("border-r-4 transition-colors hover:bg-muted/20", color.border)}>
                    <CardContent className="p-2 space-y-1">
                      {/* Row 1: Number + actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", color.dot)} />
                          <span className="font-medium text-xs text-foreground truncate" dir="ltr">{item.phone_number}</span>
                          {item.notes && <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">— {item.notes}</span>}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-md", color.bg, color.text)}>
                            {color.label}
                          </span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(item.phone_number)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-3 w-3" />
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
                );
              })}
            </div>
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
