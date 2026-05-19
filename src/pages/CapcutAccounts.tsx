import { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
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
import { ClipboardPaste, Trash2, Save, Search, Settings2, Send, UserCheck, Pencil, Plus, X, Lock, LockOpen, MessageSquare, FileText, MonitorSmartphone, Undo2, Upload, Repeat, ChevronDown, LayoutGrid, Rows3 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type CapcutAccount = { id: string; username: string; password_or_code: string; plan_type: string; status: string; delivered_count: number; category_id: string | null };
type Category = { id: string; name: string; delivery_limit?: number };

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
  const [viewMode, setViewMode] = useState<"table" | "cards">(() => {
    if (typeof window === "undefined") return "table";
    return (localStorage.getItem("capcut_view_mode") as "table" | "cards") || "table";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("capcut_view_mode", viewMode);
  }, [viewMode]);
  const [perEmailPasswordOpen, setPerEmailPasswordOpen] = useState(false);
  const [perEmailPassword, setPerEmailPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");

  // G2G CSV import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importRows, setImportRows] = useState<{ email: string; password: string; selected: boolean }[]>([]);

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
      const { data, error } = await supabase.from("user_settings").select("*").in("setting_key", ["shared_password", "message_template", "triple_delivery"]);
      if (error) throw error;
      const map: Record<string, string> = {};
      data.forEach((s: any) => { map[s.setting_key] = s.setting_value; });
      return map;
    },
  });

  const sharedPassword = settings?.shared_password || "";
  const messageTemplate = settings?.message_template || DEFAULT_MESSAGE;
  const tripleMode = settings?.triple_delivery === "1";
  const defaultDeliveryLimit = tripleMode ? 3 : 2;
  const getLimitForCategory = (categoryId: string | null) => {
    if (!categoryId) return defaultDeliveryLimit;
    const cat = categories.find((c) => c.id === categoryId);
    return (cat?.delivery_limit as number | undefined) ?? defaultDeliveryLimit;
  };
  const getLimitForAccount = (acc: { category_id: string | null }) => getLimitForCategory(acc.category_id);

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

  const setCategoryLimitMutation = useMutation({
    mutationFn: async ({ id, limit }: { id: string; limit: number }) => {
      const { error } = await supabase.from("account_categories").update({ delivery_limit: limit } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account_categories"] });
      toast.success("تم تحديث عدد التسليمات");
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
      const categoryId = !activeTab || activeTab === UNCAT ? null : activeTab;
      const { error } = await supabase.from("capcut_accounts").insert({
        username: email.trim(), password_or_code: password, plan_type: "Pro", status: "متاح", user_id: user!.id, category_id: categoryId,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["capcut_accounts"] }); toast.success("تم إضافة الحساب"); },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkInsertMutation = useMutation({
    mutationFn: async (rows: { email: string; password: string }[]) => {
      const categoryId = !activeTab || activeTab === UNCAT ? null : activeTab;
      const payload = rows.map(r => ({
        username: r.email.trim(),
        password_or_code: r.password,
        plan_type: "Pro",
        status: "متاح",
        user_id: user!.id,
        category_id: categoryId,
      }));
      const { error } = await supabase.from("capcut_accounts").insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["capcut_accounts"] });
      setImportDialogOpen(false);
      setImportRows([]);
      toast.success(`تم إضافة ${count} حساب`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!activeTab) { toast.error("يرجى اختيار تصنيف أولاً"); return; }
    const isTxt = /\.txt$/i.test(file.name) || file.type === "text/plain";
    if (isTxt) {
      file.text().then((text) => {
        const seen = new Set<string>();
        const rows: { email: string; password: string; selected: boolean }[] = [];
        const blocks = text.split(/\n\s*-{3,}\s*\n|\r?\n\r?\n/);
        const parseBlock = (block: string) => {
          const emailMatch = block.match(/Account\s*[:：]\s*([^\s\r\n]+)/i) || block.match(EMAIL_RE);
          const pwdMatch = block.match(/(?:Password|Remark|Pass|PWD)\s*[:：]\s*([^\s\r\n]+)/i);
          if (!emailMatch || !pwdMatch) return;
          const rawEmail = emailMatch[1] || emailMatch[0];
          const m = rawEmail.match(EMAIL_RE);
          const email = m ? m[0] : rawEmail.trim();
          const password = pwdMatch[1].trim();
          if (!email || !password) return;
          if (seen.has(email.toLowerCase())) return;
          seen.add(email.toLowerCase());
          rows.push({ email, password, selected: true });
        };
        blocks.forEach(parseBlock);
        if (!rows.length) { toast.error("لم يتم العثور على حسابات صالحة"); return; }
        setImportRows(rows);
        setImportDialogOpen(true);
      }).catch(() => toast.error("فشل قراءة الملف"));
      return;
    }
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (res) => {
        const data = res.data as string[][];
        if (!data.length) { toast.error("الملف فارغ"); return; }
        // Detect header row & column indices
        let emailIdx = 1, pwdIdx = 3, startRow = 0;
        const header = data[0].map(c => (c || "").toLowerCase());
        const eIdx = header.findIndex(c => c.includes("email") || c.includes("user id"));
        const pIdx = header.findIndex(c => c.includes("password"));
        if (eIdx !== -1 && pIdx !== -1) { emailIdx = eIdx; pwdIdx = pIdx; startRow = 1; }
        const seen = new Set<string>();
        const rows: { email: string; password: string; selected: boolean }[] = [];
        for (let i = startRow; i < data.length; i++) {
          const row = data[i];
          if (!row) continue;
          const rawEmail = (row[emailIdx] || "").replace(/^['"\s]+|['"\s]+$/g, "");
          const password = (row[pwdIdx] || "").trim();
          const m = rawEmail.match(EMAIL_RE);
          const email = m ? m[0] : rawEmail;
          if (!email || !password) continue;
          if (seen.has(email.toLowerCase())) continue;
          seen.add(email.toLowerCase());
          rows.push({ email, password, selected: true });
        }
        if (!rows.length) { toast.error("لم يتم العثور على حسابات صالحة"); return; }
        setImportRows(rows);
        setImportDialogOpen(true);
      },
      error: () => toast.error("فشل قراءة الملف"),
    });
  };

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
      const raw = text.trim();
      if (!raw) { toast.error("الحافظة فارغة"); return; }
      // Detect WhatsApp / multi-account format (Account: ... Remark/Password: ...)
      if (/Account\s*[:：]/i.test(raw)) {
        const blocks = raw.split(/\n\s*-{3,}\s*\n|\r?\n\r?\n/);
        const seen = new Set<string>();
        const rows: { email: string; password: string; selected: boolean }[] = [];
        blocks.forEach((block) => {
          const emailMatch = block.match(/Account\s*[:：]\s*([^\s\r\n]+)/i) || block.match(EMAIL_RE);
          const pwdMatch = block.match(/(?:Password|Remark|Pass|PWD)\s*[:：]\s*([^\s\r\n]+)/i);
          if (!emailMatch) return;
          const rawEmail = (emailMatch[1] || emailMatch[0]).trim();
          const m = rawEmail.match(EMAIL_RE);
          const email = m ? m[0] : rawEmail;
          const password = pwdMatch ? pwdMatch[1].trim() : (samePassword ? sharedPassword : "");
          if (!email || !password) return;
          if (seen.has(email.toLowerCase())) return;
          seen.add(email.toLowerCase());
          rows.push({ email, password, selected: true });
        });
        if (!rows.length) { toast.error("لم يتم العثور على حسابات صالحة"); return; }
        setImportRows(rows);
        setImportDialogOpen(true);
        return;
      }
      const email = raw;
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
    const limit = getLimitForAccount(account);
    const newCount = (account.delivered_count || 0) + 1;
    const newStatus = newCount >= limit ? "مباع" : "متاح";
    await supabase.from("capcut_accounts").update({ delivered_count: newCount, status: newStatus, updated_at: new Date().toISOString() }).eq("id", account.id);
    queryClient.invalidateQueries({ queryKey: ["capcut_accounts"] });
    toast.success(`تم النسخ (${newCount}/${limit})`);
  };

  const handleUndoDeliver = async (account: CapcutAccount) => {
    const limit = getLimitForAccount(account);
    const newCount = Math.max(0, (account.delivered_count || 0) - 1);
    const newStatus = newCount < limit ? "متاح" : "مباع";
    await supabase.from("capcut_accounts").update({ delivered_count: newCount, status: newStatus, updated_at: new Date().toISOString() }).eq("id", account.id);
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
    // In-progress (1..limit-1) first, then untouched (0), then completed (>=limit) last
    const priority = (count: number, limit: number) =>
      count > 0 && count < limit ? 0 : count === 0 ? 1 : 2;
    const pa = priority(a.delivered_count, getLimitForAccount(a));
    const pb = priority(b.delivered_count, getLimitForAccount(b));
    if (pa !== pb) return pa - pb;
    // Within completed (priority 2), most recently sold appears first
    if (pa === 2) {
      const ua = new Date((a as any).updated_at || 0).getTime();
      const ub = new Date((b as any).updated_at || 0).getTime();
      return ub - ua;
    }
    return 0;
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
            <input ref={fileInputRef} type="file" accept=".csv,.txt,.xlsx,.xls,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden" onChange={handleFileUpload} />
            <Button onClick={() => fileInputRef.current?.click()} size="sm" variant="outline" disabled={!activeTab} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> رفع G2G
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
          {selectedIds.size > 0 && activeTab === UNCAT && categories.length > 0 && (
            <Select onValueChange={(v) => moveBulkMutation.mutate({ ids: Array.from(selectedIds), category_id: v })}>
              <SelectTrigger className="h-7 w-auto gap-1 text-[10px] sm:text-xs px-2 sm:px-3 shrink-0">
                <SelectValue placeholder={`نقل ${selectedIds.size} إلى...`} />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
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
        <div className="relative rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/20 p-2.5 shadow-sm">
          <div className="flex flex-row-reverse items-center gap-2">
            {/* View mode toggle (table / cards) */}
            <div
              className="flex flex-row-reverse shrink-0 items-center rounded-full border border-border/70 bg-background/60 p-0.5 backdrop-blur-sm"
              title="طريقة العرض"
            >
              <button
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex items-center justify-center h-6 w-7 rounded-full transition-all",
                  viewMode === "table"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Rows3 className="h-3 w-3" />
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={cn(
                  "flex items-center justify-center h-6 w-7 rounded-full transition-all",
                  viewMode === "cards"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-3 w-3" />
              </button>
            </div>

            <div className="h-6 w-px bg-border/60 shrink-0" />

            <div className="flex-1 overflow-x-auto scrollbar-hide">
              <TabsList className="inline-flex flex-row-reverse h-auto gap-1.5 bg-transparent p-0">
            {uncategorizedCount > 0 && (
              <TabsTrigger
                value={UNCAT}
                className={cn(
                  "relative text-xs font-medium px-3 py-1.5 rounded-full border-2 flex flex-row-reverse items-center gap-2 transition-all",
                  activeTab === UNCAT
                    ? "bg-card text-foreground border-warning shadow-[0_0_0_3px_hsl(var(--warning)/0.15)]"
                    : "bg-card text-muted-foreground border-warning/30 hover:border-warning/60 hover:text-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  <span>بدون تصنيف</span>
                  <span className={cn(
                    "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-md text-[10px] font-bold tabular-nums",
                    activeTab === UNCAT ? "bg-warning/20 text-warning" : "bg-muted/60 text-muted-foreground"
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
                    "relative text-xs font-medium px-3 py-1.5 rounded-full border-2 flex flex-row-reverse items-center gap-2 transition-all",
                    isActive
                      ? "bg-card text-foreground border-success shadow-[0_0_0_3px_hsl(var(--success)/0.15)]"
                      : "bg-card text-muted-foreground border-border/60 hover:border-success/50 hover:text-foreground"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span>{cat.name}</span>
                    <span className={cn(
                      "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-md text-[10px] font-bold tabular-nums",
                      isActive ? "bg-muted text-foreground" : "bg-muted/60 text-muted-foreground"
                    )}>
                      {count}
                    </span>
                  </span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <span
                        role="button"
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "inline-flex items-center justify-center h-5 w-5 rounded-full cursor-pointer transition-colors hover:bg-muted text-muted-foreground"
                        )}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </span>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-44 p-1.5" dir="rtl">
                      <div className="flex flex-col gap-0.5">
                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground tracking-wide">{cat.name}</div>
                        <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold text-muted-foreground/80">عدد التسليمات لكل حساب</div>
                        <div className="flex items-center gap-1 px-1.5 pb-1.5">
                          {[1, 2, 3].map((n) => {
                            const currentLimit = (cat.delivery_limit as number | undefined) ?? 2;
                            const isSelected = currentLimit === n;
                            return (
                              <button
                                key={n}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isSelected) setCategoryLimitMutation.mutate({ id: cat.id, limit: n });
                                }}
                                className={cn(
                                  "flex-1 px-2 py-1 rounded-md text-[11px] font-bold tabular-nums transition-all border",
                                  isSelected
                                    ? "bg-success text-success-foreground border-success shadow-sm"
                                    : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground"
                                )}
                              >
                                x{n}
                              </button>
                            );
                          })}
                        </div>
                        <div className="h-px bg-border/60 my-0.5" />
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditCategoryId(cat.id); setEditCategoryName(cat.name); }}
                          className="flex flex-row-reverse items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium hover:bg-muted text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>إعادة تسمية</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteCategoryId(cat.id); }}
                          className="flex flex-row-reverse items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium hover:bg-destructive/15 text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>حذف التصنيف</span>
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </TabsTrigger>
              );
            })}
              </TabsList>
            </div>
          </div>
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
          ) : viewMode === "cards" ? (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filtered.map((a) => {
                  const count = a.delivered_count || 0;
                  const isSold = a.status === "مباع";
                  const isNotWorking = a.status === "لايشتغل";
                  const rowLimit = getLimitForAccount(a);
                  const isSelected = selectedIds.has(a.id);
                  const statusLabel = isNotWorking ? "لايشتغل" : isSold ? "مباع" : count >= rowLimit ? "مكتمل" : count > 0 ? "قيد التسليم" : "متاح";
                  const statusTone = isNotWorking
                    ? "bg-destructive/15 text-destructive ring-destructive/30"
                    : isSold
                    ? "bg-warning/15 text-warning ring-warning/30"
                    : count >= rowLimit
                    ? "bg-muted text-muted-foreground ring-border"
                    : count > 0
                    ? "bg-warning/10 text-warning ring-warning/25"
                    : "bg-success/10 text-success ring-success/25";
                  const dotTone = isNotWorking
                    ? "bg-destructive"
                    : isSold
                    ? "bg-warning"
                    : count > 0
                    ? "bg-warning"
                    : "bg-success";
                  const initial = (a.username || "?").trim().charAt(0).toUpperCase();
                  return (
                    <div
                      key={a.id}
                      onClick={() => { if (selectionMode) toggleSelect(a.id); }}
                      className={cn(
                        "group relative overflow-hidden rounded-2xl border p-3 flex flex-col gap-2.5 transition-all duration-200",
                        "bg-gradient-to-b from-card to-card/60",
                        "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_-6px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.06),0_12px_28px_-12px_rgba(0,0,0,0.18)]",
                        isSold && "opacity-55",
                        isNotWorking && "from-destructive/[0.06] to-destructive/[0.02] border-destructive/30",
                        isSelected ? "border-primary ring-2 ring-primary/30" : "border-border/60 hover:border-border",
                        selectionMode && "cursor-pointer"
                      )}
                    >
                      {/* Accent stripe at top */}
                      <span
                        className={cn(
                          "pointer-events-none absolute inset-x-0 top-0 h-[3px]",
                          isNotWorking
                            ? "bg-gradient-to-r from-destructive/50 via-destructive to-destructive/50"
                            : isSold
                            ? "bg-gradient-to-r from-warning/50 via-warning to-warning/50"
                            : count > 0
                            ? "bg-gradient-to-r from-warning/40 via-warning/70 to-warning/40"
                            : "bg-gradient-to-r from-primary/40 via-primary to-primary/40 opacity-0 group-hover:opacity-100 transition-opacity"
                        )}
                      />

                      {/* Top: status pill + delivery dots + selection */}
                      <div className="flex items-center justify-between gap-1.5">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ring-1 font-arabic leading-none",
                          statusTone
                        )}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", dotTone)} />
                          {statusLabel}
                        </span>
                        <div className="flex items-center gap-0.5" title={`${count} / ${rowLimit}`}>
                          <UserCheck className={cn("h-3 w-3", count >= 1 ? "text-primary" : "text-muted-foreground/20")} />
                          {rowLimit >= 2 && <UserCheck className={cn("h-3 w-3", count >= 2 ? "text-primary" : "text-muted-foreground/20")} />}
                          {rowLimit >= 3 && <UserCheck className={cn("h-3 w-3", count >= 3 ? "text-primary" : "text-muted-foreground/20")} />}
                        </div>
                        {selectionMode && (
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(a.id)} className="h-3.5 w-3.5" />
                        )}
                      </div>

                      {/* Body: avatar + credentials */}
                      <div className="flex items-start gap-2 min-w-0">
                        <div className={cn(
                          "shrink-0 h-9 w-9 rounded-lg flex items-center justify-center font-bold text-[13px] ring-1",
                          isNotWorking
                            ? "bg-destructive/10 text-destructive ring-destructive/20"
                            : "bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-primary/20"
                        )}>
                          {initial}
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className={cn(
                            "font-mono text-[11px] font-semibold text-foreground truncate leading-tight",
                            isNotWorking && "line-through text-muted-foreground"
                          )} title={a.username}>
                            {a.username}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <Lock className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
                            <span className="font-mono text-[10px] text-muted-foreground truncate" title={a.password_or_code}>
                              {a.password_or_code}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer: actions */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-md text-muted-foreground hover:text-warning hover:bg-warning/10 disabled:opacity-30"
                          onClick={(e) => { e.stopPropagation(); handleUndoDeliver(a); }}
                          disabled={count === 0}
                          title="تراجع"
                        >
                          <Undo2 className="h-3 w-3" />
                        </Button>
                        <div className="flex items-center gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                            onClick={(e) => { e.stopPropagation(); handleDeliver(a, "credentials"); }}
                            disabled={isSold || isNotWorking}
                            title="نسخ البيانات"
                          >
                            <ClipboardPaste className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-md text-primary hover:text-primary hover:bg-primary/10"
                            onClick={(e) => { e.stopPropagation(); handleDeliver(a); }}
                            disabled={isSold || isNotWorking}
                            title="نسخ الرسالة"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 px-3 py-2 rounded-lg border border-border/40 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
                <span>{filtered.length} حساب</span>
                <button
                  onClick={() => { setSelectionMode((m) => !m); setSelectedIds(new Set()); }}
                  className="hover:text-foreground transition-colors"
                >
                  {selectionMode ? "إلغاء التحديد" : "تحديد"}
                </button>
              </div>
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
                      <TableHead className="text-left text-xs font-semibold text-muted-foreground">الإيميل</TableHead>
                      <TableHead className="text-left text-xs font-semibold text-muted-foreground">كلمة السر</TableHead>
                      <TableHead className="w-[70px] text-center text-xs font-semibold text-muted-foreground">الحالة</TableHead>
                      <TableHead className="w-[90px] text-center text-xs font-semibold text-muted-foreground">تسليم</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((a) => {
                      const count = a.delivered_count || 0;
                      const isSold = a.status === "مباع";
                      const isNotWorking = a.status === "لايشتغل";
                      const rowLimit = getLimitForAccount(a);
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
                              {rowLimit >= 2 && (
                                <UserCheck className={`h-3.5 w-3.5 ${count >= 2 ? "text-primary" : "text-muted-foreground/20"}`} />
                              )}
                              {rowLimit >= 3 && (
                                <UserCheck className={`h-3.5 w-3.5 ${count >= 3 ? "text-primary" : "text-muted-foreground/20"}`} />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-row-reverse items-center justify-center gap-1.5">
                              {activeTab === UNCAT && categories.length > 0 && (
                                <Select onValueChange={(v) => moveAccountMutation.mutate({ id: a.id, category_id: v })}>
                                  <SelectTrigger className="h-8 w-[110px] text-[10px]">
                                    <SelectValue placeholder="نقل إلى..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              )}
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

      {/* G2G Import Preview */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" /> معاينة الاستيراد ({importRows.filter(r => r.selected).length}/{importRows.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">سيتم الإضافة إلى: <strong className="text-foreground">{categories.find(c => c.id === activeTab)?.name || "بدون تصنيف"}</strong></span>
              <button
                onClick={() => setImportRows(rows => rows.map(r => ({ ...r, selected: !rows.every(x => x.selected) })))}
                className="text-primary hover:underline"
              >
                {importRows.every(r => r.selected) ? "إلغاء تحديد الكل" : "تحديد الكل"}
              </button>
            </div>
            <div className="max-h-[400px] overflow-y-auto border border-border/50 rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead className="text-right text-xs">الإيميل</TableHead>
                    <TableHead className="text-right text-xs">كلمة السر</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importRows.map((r, i) => (
                    <TableRow key={i} className={cn(!r.selected && "opacity-40")}>
                      <TableCell>
                        <Checkbox checked={r.selected} onCheckedChange={() => setImportRows(rows => rows.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.email}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{r.password}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setImportDialogOpen(false)}>إلغاء</Button>
              <Button
                size="sm"
                onClick={() => bulkInsertMutation.mutate(importRows.filter(r => r.selected))}
                disabled={bulkInsertMutation.isPending || !importRows.some(r => r.selected)}
              >
                <Save className="h-3.5 w-3.5 ml-1" /> حفظ {importRows.filter(r => r.selected).length} حساب
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
