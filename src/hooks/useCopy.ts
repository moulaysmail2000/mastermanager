import { toast } from "sonner";

export function useCopy() {
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("تم النسخ بنجاح!");
    } catch {
      toast.error("فشل النسخ");
    }
  };
  return copy;
}
