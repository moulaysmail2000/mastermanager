import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("كلمة المرور قصيرة جداً");
      return;
    }
    if (password !== confirm) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("تم تحديث كلمة المرور بنجاح");
      navigate({ to: "/capcut-accounts" });
    } catch (error: any) {
      toast.error(error.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <KeyRound className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">إعادة تعيين كلمة المرور</CardTitle>
          <p className="text-muted-foreground text-sm">
            {ready ? "أدخل كلمة المرور الجديدة" : "جاري التحقق من الرابط..."}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="كلمة المرور الجديدة"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              dir="ltr"
              className="text-right"
              disabled={!ready}
            />
            <Input
              type="password"
              placeholder="تأكيد كلمة المرور"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              dir="ltr"
              className="text-right"
              disabled={!ready}
            />
            <Button type="submit" className="w-full" disabled={loading || !ready}>
              {loading ? "جاري الحفظ..." : "حفظ كلمة المرور"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}