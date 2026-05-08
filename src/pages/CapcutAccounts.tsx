import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCopy } from "@/hooks/useCopy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ClipboardPaste, Trash2, Save, Search, Settings2, Send, UserCheck, Pencil, Plus, X, Lock, LockOpen, MessageSquare, FileText, MonitorSmartphone, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type CapcutAccount = { id: string; username: string; password_or_code: string; plan_type: string; status: string; delivered_count: number; category_id: string | null };
type Category = { id: string; name: string };

const ACCOUNT_STATUS_CONFIG = {
  "متاح": { label: "شغال", dot: "bg-success", text: "text-success" },
  "لايشتغل": { label: "لايشتغل", dot: "bg-destructive", text: "text-destructive" },
} as const;

const DEFAULT_MESSAGE = `Email:   {email}

Password:  {password}

ملاحظة هامة:

يرجى عدم تغيير البريد الإلكتروني أو كلمة السر.

يرجى تجاهل تاريخ التجديد، فهذه الحسابات تتجدد تلقائيًا.

تنبيه:

إذا كنت ترغب في استخدام الحساب على كل من الهاتف والحاسوب، يُرجى اتباع الخطوات التالية:

أولاً، قم بتسجيل الدخول من الهاتف المحمول.

بعد ذلك، قم بربط الحساب مع الحاسوب باستخدام ماسح رمز QR.

نقدم امكانية استبدال الحساب اذا وجهت اي مشكل مع ضمان طول مدة الاشتراك

في حال واجهت أي مشكلة، سواء أثناء تسجيل الدخول أو لاحقًا، لا تتردد في التواصل معنا .

   *🙏 من فضلك الى بان ليك الاشهار ديالنا خلي لينا شي تعليق زوين  *`;

export default function CapcutAccounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const copy = useCopy();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [tempMessage, setTempMessage] = useState("");
  const [activeTab, setActiveTab] = useState<string>("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [samePassword, setSamePassword] = useState(true);
  const [perEmailPasswordOpen, setPerEmailPasswordOpen] = useState(false);
  const [perEmailPassword, setPerEmailPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["account_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("account_categories").select("*").order("created_at");
      if (error) throw error;
      return data as Category[];
    },
  });

  useEffect(() => {
    if (categories.length > 0 && (!activeTab || !categories.find(c => c.id === activeTab))) {
      setActiveTab(categories[0].id);
    }
  }, [categories]);

  const UNCAT = "__uncategorized__";
  const moveAccountMutation = useMutation({
    mutationFn: async ({ id, category_id }: { id: string; category_id: string }) => {
      const { error } = await supabase.from("capcut_accounts").update({ category_id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capcut_accounts"] });
      toast.success("تم نقل الحساب");
    },
    onError: (e: any) => toast.error(e.message),
  });
  const moveBulkMutation = useMutation({
    mutationFn: async ({ ids, category_id }: { ids: string[]; category_id: string }) => {
      const { error } = await supabase.from("capcut_accounts").update({ category_id }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capcut_accounts"] });
      setSelectedIds(new Set());
      toast.success("تم النقل");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_settings").select("*").in("setting_key", ["shared_password", "message_template"]);
      if (error) throw error;
      const map: Record<string, string> = {};
      data.forEach((s: any) => { map[s.setting_key] = s.setting_value; });
      return map;
    },
  });

  const sharedPassword = settings?.shared_password || "";
  const messageTemplate = settings?.message_template || DEFAULT_MESSAGE;

  const saveSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase.from("user_settings").upsert({ user_id: user!.id, setting_key: key, setting_value: value }, { onConflict: "user_id,setting_key" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user_settings"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const addCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from("account_categories").insert({ name, user_id: user!.id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["account_categories"] });
      setNewCategoryName("");
      setAddCategoryOpen(false);
      setActiveTab(data.id);
      toast.success("تم إضافة التصنيف");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("account_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account_categories"] });
      queryClient.invalidateQueries({ queryKey: ["capcut_accounts"] });
      setActiveTab("");
      toast.success("تم حذف التصنيف");
    },
  });

  const renameCategoryMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("account_categories").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account_categories"] });
      setEditCategoryId(null);
      setEditCategoryName("");
      toast.success("تم تعديل اسم التصنيف");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteOneId, setDeleteOneId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["capcut_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("capcut_accounts").select("*").order("created_at");
      if (error) throw error;
      return data as CapcutAccount[];
    },
  });

  const insertMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const categoryId = activeTab || null;
      const { error } = await supabase.from("capcut_accounts").insert({
        username: email.trim(), password_or_code: password, plan_type: "Pro", status: "متاح", user_id: user!.id, category_id: categoryId,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["capcut_accounts"] }); toast.success("تم إضافة الحساب"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("capcut_accounts").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["capcut_accounts"] }); setSelectedIds(new Set()); toast.success("تم الحذف"); },
  });

  const toggleAccountStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("capcut_accounts").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["capcut_accounts"] }),
    onError: () => toast.error("فشل تحديث الحالة"),
  });

  const handlePaste = async () => {
    if (samePassword && !sharedPassword) { toast.error("يرجى تعيين كلمة المرور أولاً"); setPasswordDialogOpen(true); return; }
    if (!activeTab) { toast.error("يرجى اختيار تصنيف أولاً"); return; }
    try {
      const text = await navigator.clipboard.readText();
      const email = text.trim();
      if (!email) { toast.error("الحافظة فارغة"); return; }
      if (samePassword) { insertMutation.mutate({ email, password: sharedPassword }); }
      else { setPendingEmail(email); setPerEmailPassword(""); setPerEmailPasswordOpen(true); }
    } catch { toast.error("لا يمكن الوصول إلى الحافظة"); }
  };

  const handleConfirmPerEmailPassword = () => {
    if (!perEmailPassword.trim()) { toast.error("يرجى إدخال كلمة المرور"); return; }
    insertMutation.mutate({ email: pendingEmail, password: perEmailPassword.trim() });
    setPerEmailPasswordOpen(false); setPendingEmail(""); setPerEmailPassword("");
  };

  const handleSavePassword = () => {
    saveSettingMutation.mutate({ key: "shared_password", value: tempPassword });
    setPasswordDialogOpen(false); toast.success("تم حفظ كلمة المرور");
  };

  const handleSaveMessage = () => {
    saveSettingMutation.mutate({ key: "message_template", value: tempMessage });
    setIsEditingMessage(false); setMessageDialogOpen(false); toast.success("تم حفظ الرسالة");
  };

  const handleDeliver = async (account: CapcutAccount, mode: "message" | "credentials" = "message") => {
    const textToCopy = mode === "message"
      ? messageTemplate.replace("{email}", account.username).replace("{password}", account.password_or_code)
      : `${account.username}\n${account.password_or_code}`;
    await copy(textToCopy);
    const newCount = (account.delivered_count || 0) + 1;
    const newStatus = newCount >= 2 ? "مباع" : "متاح";
    await supabase.from("capcut_accounts").update({ delivered_count: newCount, status: newStatus }).eq("id", account.id);
    queryClient.invalidateQueries({ queryKey: ["capcut_accounts"] });
    toast.success(`تم النسخ (${newCount}/2)`);
  };

  const handleUndoDeliver = async (account: CapcutAccount) => {
    const newCount = Math.max(0, (account.delivered_count || 0) - 1);
    const newStatus = newCount < 2 ? "متاح" : "مباع";
    await supabase.from("capcut_accounts").update({ delivered_count: newCount, status: newStatus }).eq("id", account.id);
    queryClient.invalidateQueries({ queryKey: ["capcut_accounts"] });
    toast.success("تم التراجع");
  };

  const activeCategoryName = categories.find(c => c.id === activeTab)?.name?.toUpperCase() || "";
  const isCerackCategory = activeCategoryName.includes("CERACK") || activeCategoryName.includes("CERACH");

  const filtered = accounts.filter((a) => {
    const matchesCategory =
      !activeTab
        ? true
        : activeTab === UNCAT
        ? a.category_id === null
        : a.category_id === activeTab;
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    return matchesCategory && matchesStatus;
  }).sort((a, b) => {
    // delivered_count === 1 first (needs 2nd delivery), then 0 (unused), then 2+ (sold) last
    const priority = (count: number) => count === 1 ? 0 : count === 0 ? 1 : 2;
    return priority(a.delivered_count) - priority(b.delivered_count);
  });

  const allSelected = filtered.length > 0 && filtered.every((a) => selectedIds.has(a.id));
  const toggleSelectAll = () => {
    if (!selectionMode) { setSelectionMode(true); setSelectedIds(new Set(filtered.map((a) => a.id))); }
    else if (allSelected) { setSelectedIds(new Set()); setSelectionMode(false); }
    else { setSelectedIds(new Set(filtered.map((a) => a.id))); }
  };
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const getCategoryCount = (categoryId: string) => accounts.filter(a => a.category_id === categoryId).length;
  const uncategorizedCount = accounts.filter(a => a.category_id === null).length;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">الحسابات</h1>
          <div className="flex items-center gap-1.5">
            <Button onClick={handlePaste} size="sm" disabled={insertMutation.isPending || !activeTab} className="gap-1.5">
              <ClipboardPaste className="h-3.5 w-3.5" /> لصق
            </Button>
            <Button onClick={() => setAddCategoryOpen(true)} size="sm" variant="outline" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> تصنيف
            </Button>
          </div>
        </div>

        {/* Quick Settings Row */}
        <div className="flex flex-nowrap items-center gap-1.5 sm:gap-3 overflow-x-auto">
          <button
            onClick={() => setSamePassword(!samePassword)}
            className={cn(
              "flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap shrink-0",
              samePassword
                ? "border-primary/30 bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:border-border/80"
            )}
          >
            {samePassword ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
            {samePassword ? "سر موحد" : "سر مختلف"}
          </button>
          <button
            onClick={() => { setTempPassword(sharedPassword); setPasswordDialogOpen(true); }}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-border text-[10px] sm:text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-all whitespace-nowrap shrink-0"
          >
            <Settings2 className="h-3 w-3" /> كلمة المرور
          </button>
          <button
            onClick={() => { setTempMessage(messageTemplate); setIsEditingMessage(false); setMessageDialogOpen(true); }}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-border text-[10px] sm:text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-all whitespace-nowrap shrink-0"
          >
            <FileText className="h-3 w-3" /> رسالة التسليم
          </button>
          <button
            onClick={() => { setSelectionMode((m) => !m); setSelectedIds(new Set()); }}
            className={cn(
              "flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap shrink-0",
              selectionMode
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
            )}
          >
            {selectionMode ? "إلغاء" : "تحديد"}
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={() => setBulkDeleteOpen(true)}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-destructive bg-destructive text-destructive-foreground text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap shrink-0 hover:bg-destructive/90"
            >
              <Trash2 className="h-3 w-3" /> حذف {selectedIds.size}
            </button>
          )}
        </div>
      </div>

      {/* Password Warning */}
      {!sharedPassword && samePassword && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
          <span>⚠️</span>
          <span className="flex-1">لم يتم تعيين كلمة المرور المشتركة بعد.</span>
          <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => { setTempPassword(""); setPasswordDialogOpen(true); }}>
            تعيين الآن
          </Button>
        </div>
      )}

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedIds(new Set()); setSelectionMode(false); }}>
        <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
          <TabsList className="inline-flex flex-row-reverse h-auto gap-1.5 bg-transparent p-0">
            {uncategorizedCount > 0 && (
              <TabsTrigger
                value={UNCAT}
                className={cn(
                  "relative text-xs font-medium px-3 py-1.5 rounded-lg border flex flex-row-reverse items-center gap-1.5 transition-all",
                  activeTab === UNCAT
                    ? "bg-warning text-warning-foreground border-warning shadow-sm"
                    : "bg-card text-muted-foreground border-warning/40 hover:border-warning/70 hover:text-foreground"
                )}
              >
                <span className="flex items-center gap-1">
                  <span>بدون تصنيف</span>
                  <span className={cn(
                    "inline-flex items-center justify-center min-w-[1rem] h-4 px-1 rounded text-[9px] font-bold",
                    activeTab === UNCAT ? "bg-warning-foreground/20" : "bg-warning/20 text-warning"
                  )}>
                    {uncategorizedCount}
                  </span>
                </span>
              </TabsTrigger>
            )}
            {categories.map((cat) => {
              const count = getCategoryCount(cat.id);
              const isActive = activeTab === cat.id;
              return (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className={cn(
                    "relative text-xs font-medium px-3 py-1.5 rounded-lg border flex flex-row-reverse items-center gap-1.5 group transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card text-muted-foreground border-border/50 hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  <span className="flex items-center gap-1">
                    <span>{cat.name}</span>
                    <span className={cn(
                      "inline-flex items-center justify-center min-w-[1rem] h-4 px-1 rounded text-[9px] font-bold",
                      isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      {count}
                    </span>
                  </span>
                  <div className={cn("flex items-center gap-0.5 transition-opacity", "opacity-0 group-hover:opacity-100")}>
                    <button onClick={(e) => { e.stopPropagation(); setEditCategoryId(cat.id); setEditCategoryName(cat.name); }}
                      className="p-0.5 rounded hover:bg-primary-foreground/10"><Pencil className="h-2.5 w-2.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteCategoryId(cat.id); }}
                      className="p-0.5 rounded hover:bg-destructive/20"><X className="h-2.5 w-2.5" /></button>
                  </div>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <div className="mt-4 space-y-3">

          {/* CERACK status legend */}
          {isCerackCategory && (
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /><span className="text-muted-foreground">شغال</span></div>
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" /><span className="text-muted-foreground">لايشتغل</span></div>
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" /><span className="text-muted-foreground">مباع</span></div>
              <span className="text-[10px] text-muted-foreground/60">اضغط النقطة لتغيير الحالة</span>
            </div>
          )}

          {/* Accounts Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-muted-foreground animate-pulse text-sm">جاري التحميل...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <MonitorSmartphone className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">لا توجد حسابات في هذا التصنيف</p>
            </div>
          ) : (
            <Card className="overflow-hidden border-border/50">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      {selectionMode && (
                        <TableHead className="w-[40px]">
                          <Checkbox checked={selectionMode && allSelected} onCheckedChange={toggleSelectAll} />
                        </TableHead>
                      )}
                      <TableHead className="text-right text-xs font-semibold text-muted-foreground">الإيميل</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-muted-foreground">كلمة السر</TableHead>
                      <TableHead className="w-[70px] text-center text-xs font-semibold text-muted-foreground">الحالة</TableHead>
                      <TableHead className="w-[90px] text-center text-xs font-semibold text-muted-foreground">تسليم</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((a) => {
                      const count = a.delivered_count || 0;
                      const isSold = a.status === "مباع";
                      const isNotWorking = a.status === "لايشتغل";
                      return (
                        <TableRow key={a.id} className={cn(
                          "transition-colors",
                          isSold && "opacity-40",
                          isNotWorking && isCerackCategory && "opacity-50 bg-destructive/5"
                        )}>
                          {selectionMode && (
                            <TableCell><Checkbox checked={selectedIds.has(a.id)} onCheckedChange={() => toggleSelect(a.id)} /></TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {isCerackCategory ? (
                                <button
                                  title={isNotWorking ? "تحويل إلى شغال" : "تحويل إلى لايشتغل"}
                                  onClick={() => toggleAccountStatusMutation.mutate({ id: a.id, status: isNotWorking ? "متاح" : "لايشتغل" })}
                                  className={cn(
                                    "flex-shrink-0 w-2.5 h-2.5 rounded-full transition-all hover:scale-150 cursor-pointer ring-2 ring-offset-1 ring-offset-background",
                                    isNotWorking ? "bg-destructive ring-destructive/30" : isSold ? "bg-warning ring-warning/30" : "bg-success ring-success/30"
                                  )}
                                />
                              ) : (
                                <div className={cn(
                                  "flex-shrink-0 w-2 h-2 rounded-full",
                                  isSold ? "bg-destructive" : count === 1 ? "bg-warning" : "bg-success"
                                )} />
                              )}
                              <span className={cn("font-mono text-sm truncate max-w-[200px]", isNotWorking && isCerackCategory && "line-through text-muted-foreground")}>{a.username}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{a.password_or_code}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              {count > 0 && (
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-warning" onClick={() => handleUndoDeliver(a)} title="تراجع">
                                  <Undo2 className="h-3 w-3" />
                                </Button>
                              )}
                              <UserCheck className={`h-3.5 w-3.5 ${count >= 1 ? "text-primary" : "text-muted-foreground/20"}`} />
                              <UserCheck className={`h-3.5 w-3.5 ${count >= 2 ? "text-primary" : "text-muted-foreground/20"}`} />
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-row-reverse items-center justify-center gap-1.5">
                              <Button size="icon" variant="ghost" className="h-10 w-10 text-primary hover:text-primary [&_svg]:size-5" onClick={() => handleDeliver(a)} disabled={isSold || isNotWorking} title="نسخ الرسالة">
                                <MessageSquare />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-10 w-10 text-muted-foreground [&_svg]:size-5" onClick={() => handleDeliver(a, "credentials")} disabled={isSold || isNotWorking} title="نسخ البيانات">
                                <ClipboardPaste />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {/* Table footer with count */}
              <div className="px-4 py-2 border-t border-border/30 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
                <span>{filtered.length} حساب</span>
                <button
                  onClick={() => { setSelectionMode((m) => !m); setSelectedIds(new Set()); }}
                  className="hover:text-foreground transition-colors"
                >
                  {selectionMode ? "إلغاء التحديد" : "تحديد"}
                </button>
              </div>
            </Card>
          )}
        </div>
      </Tabs>

      {/* ===== DIALOGS ===== */}

      {/* Message Template Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> رسالة التسليم
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={isEditingMessage ? tempMessage : messageTemplate}
              onChange={(e) => setTempMessage(e.target.value)}
              rows={12}
              className="text-sm font-mono resize-none"
              placeholder="اكتب رسالة التسليم هنا..."
              dir="rtl"
              readOnly={!isEditingMessage}
            />
            <p className="text-xs text-muted-foreground">
              استخدم <code className="bg-muted px-1 rounded">{"{email}"}</code> و <code className="bg-muted px-1 rounded">{"{password}"}</code> كمتغيرات
            </p>
            <div className="flex gap-2 justify-end">
              {isEditingMessage ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => setIsEditingMessage(false)}>إلغاء</Button>
                  <Button size="sm" onClick={handleSaveMessage}><Save className="h-3.5 w-3.5 ml-1" /> حفظ</Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => { setTempMessage(messageTemplate); setIsEditingMessage(true); }}>
                  <Pencil className="h-3.5 w-3.5 ml-1" /> تعديل
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>إضافة تصنيف جديد</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="اسم التصنيف" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
            <Button className="w-full" onClick={() => addCategoryMutation.mutate(newCategoryName.trim())} disabled={!newCategoryName.trim() || addCategoryMutation.isPending}>
              <Plus className="h-4 w-4 ml-1" /> إضافة
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Category Dialog */}
      <Dialog open={!!editCategoryId} onOpenChange={(open) => { if (!open) { setEditCategoryId(null); setEditCategoryName(""); } }}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>تعديل اسم التصنيف</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="الاسم الجديد" value={editCategoryName} onChange={(e) => setEditCategoryName(e.target.value)} />
            <Button className="w-full" onClick={() => editCategoryId && renameCategoryMutation.mutate({ id: editCategoryId, name: editCategoryName.trim() })} disabled={!editCategoryName.trim() || renameCategoryMutation.isPending}>
              <Save className="h-4 w-4 ml-1" /> حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>كلمة المرور المشتركة</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">هذه كلمة المرور ستُستخدم لكل الحسابات الجديدة.</p>
            <Input placeholder="كلمة المرور" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} />
            <Button className="w-full" onClick={handleSavePassword} disabled={!tempPassword.trim()}>
              <Save className="h-4 w-4 ml-1" /> حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Per-Email Password Dialog */}
      <Dialog open={perEmailPasswordOpen} onOpenChange={setPerEmailPasswordOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle>كلمة مرور الحساب</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">أدخل كلمة المرور للإيميل: <strong className="text-foreground">{pendingEmail}</strong></p>
            <Input placeholder="كلمة المرور" value={perEmailPassword} onChange={(e) => setPerEmailPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleConfirmPerEmailPassword()} />
            <Button className="w-full" onClick={handleConfirmPerEmailPassword} disabled={!perEmailPassword.trim()}>
              <Save className="h-4 w-4 ml-1" /> إضافة
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete One */}
      <AlertDialog open={!!deleteOneId} onOpenChange={(open) => !open && setDeleteOneId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا الحساب؟ لا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteOneId) deleteMutation.mutate([deleteOneId]); setDeleteOneId(null); }}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف {selectedIds.size} حساب</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف جميع الحسابات المحددة؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { deleteMutation.mutate(Array.from(selectedIds)); setBulkDeleteOpen(false); }}>حذف الكل</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Category */}
      <AlertDialog open={!!deleteCategoryId} onOpenChange={(open) => !open && setDeleteCategoryId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف التصنيف</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف التصنيف وجميع الحسابات المرتبطة به.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteCategoryId) deleteCategoryMutation.mutate(deleteCategoryId); setDeleteCategoryId(null); }}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
