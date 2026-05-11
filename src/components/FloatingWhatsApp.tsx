import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { toast } from "sonner";

const POS_KEY = "fw_pos_v1";
const NUM_KEY = "fw_number_v1";
const SIZE = 44;

export default function FloatingWhatsApp() {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 20, y: 120 };
    try {
      const s = JSON.parse(localStorage.getItem(POS_KEY) || "null");
      if (s && typeof s.x === "number" && typeof s.y === "number") return s;
    } catch {}
    return { x: 20, y: 120 };
  });
  const [expanded, setExpanded] = useState(false);
  const dragging = useRef(false);
  const moved = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const clamp = () => {
      setPos((p) => ({
        x: Math.min(Math.max(4, p.x), window.innerWidth - SIZE - 4),
        y: Math.min(Math.max(4, p.y), window.innerHeight - SIZE - 4),
      }));
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    moved.current = false;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const nx = e.clientX - offset.current.x;
    const ny = e.clientY - offset.current.y;
    if (Math.abs(nx - pos.x) > 3 || Math.abs(ny - pos.y) > 3) moved.current = true;
    setPos({
      x: Math.min(Math.max(4, nx), window.innerWidth - SIZE - 4),
      y: Math.min(Math.max(4, ny), window.innerHeight - SIZE - 4),
    });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    localStorage.setItem(POS_KEY, JSON.stringify(pos));
    if (!moved.current) setExpanded((v) => !v);
  };

  const openWhatsApp = () => {
    let num = localStorage.getItem(NUM_KEY) || "";
    if (!num) {
      const input = window.prompt("أدخل رقم واتساب البزنس بصيغة دولية بدون + (مثال: 9647XXXXXXXXX):", "");
      if (!input) return;
      num = input.replace(/\D/g, "");
      if (!num) {
        toast.error("رقم غير صالح");
        return;
      }
      localStorage.setItem(NUM_KEY, num);
    }
    // Android: target WhatsApp Business package directly
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      const intent = `intent://send/?phone=${num}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`;
      window.location.href = intent;
      setTimeout(() => {
        // fallback if business not installed
        window.location.href = `https://wa.me/${num}`;
      }, 1500);
    } else {
      window.open(`https://wa.me/${num}`, "_blank");
    }
    setExpanded(false);
  };

  const changeNumber = () => {
    localStorage.removeItem(NUM_KEY);
    toast.success("تم مسح الرقم. اضغط الزر مرة أخرى لإدخال رقم جديد.");
    setExpanded(false);
  };

  return (
    <>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={(e) => {
          e.preventDefault();
          changeNumber();
        }}
        style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE, touchAction: "none" }}
        className="fixed z-[60] rounded-full bg-[#25D366] shadow-lg shadow-black/30 flex items-center justify-center cursor-grab active:cursor-grabbing select-none ring-2 ring-white/20"
        title="واتساب — اسحب للتحريك، اضغط للفتح، ضغطة طويلة لتغيير الرقم"
      >
        <MessageCircle className="h-5 w-5 text-white" />
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-[59] bg-black/40 backdrop-blur-sm flex items-center justify-center animate-fade-in"
          onClick={() => setExpanded(false)}
        >
          <div
            className="relative flex flex-col items-center gap-4 p-8 rounded-3xl bg-card border border-border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setExpanded(false)}
              className="absolute top-2 left-2 h-8 w-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              onClick={openWhatsApp}
              className="h-28 w-28 rounded-full bg-[#25D366] hover:bg-[#1ebe57] transition-all flex items-center justify-center shadow-xl shadow-[#25D366]/40 active:scale-95"
            >
              <MessageCircle className="h-14 w-14 text-white" />
            </button>
            <p className="text-sm font-medium text-foreground">فتح واتساب بزنس</p>
            <button
              onClick={changeNumber}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              تغيير الرقم
            </button>
          </div>
        </div>
      )}
    </>
  );
}