import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

const POS_KEY = "fw_pos_v1";
const LAST_KEY = "fw_last_local_v1";
const SIZE = 32;

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
  const [num, setNum] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(LAST_KEY) || "";
  });
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
    const full = num.replace(/\D/g, "");
    if (!full) {
      toast.error("أدخل رقم الهاتف");
      return;
    }
    if (full.length < 8) {
      toast.error("الرقم قصير جداً");
      return;
    }
    localStorage.setItem(LAST_KEY, num);
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      window.location.href = `intent://send/?phone=${full}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`;
      setTimeout(() => {
        window.location.href = `intent://send/?phone=${full}#Intent;scheme=whatsapp;package=com.whatsapp;end`;
      }, 1200);
    } else {
      window.location.href = `whatsapp://send?phone=${full}`;
    }
    setExpanded(false);
  };

  return (
    <>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE, touchAction: "none" }}
        className="fixed z-[60] rounded-full bg-[#25D366] shadow-lg shadow-black/30 flex items-center justify-center cursor-grab active:cursor-grabbing select-none ring-2 ring-white/20"
        title="واتساب — اسحب للتحريك، اضغط للفتح، ضغطة طويلة لتغيير الرقم"
      >
        <svg viewBox="0 0 32 32" className="h-4 w-4 text-white pointer-events-none" fill="currentColor">
          <path d="M16 .396C7.164.396 0 7.56 0 16.396c0 2.836.744 5.612 2.156 8.052L.06 31.604l7.34-2.06a15.93 15.93 0 0 0 8.6 2.456h.004c8.836 0 16-7.164 16-16S24.836.396 16 .396zm0 29.18a13.18 13.18 0 0 1-6.72-1.836l-.48-.288-4.36 1.224 1.244-4.244-.312-.492A13.16 13.16 0 0 1 2.836 16.4C2.836 9.116 8.72 3.232 16 3.232S29.164 9.116 29.164 16.4 23.28 29.576 16 29.576zm7.232-9.864c-.396-.2-2.348-1.16-2.712-1.292-.364-.132-.628-.2-.892.2s-1.024 1.292-1.256 1.556c-.232.264-.46.296-.856.1-.396-.2-1.672-.616-3.184-1.964-1.176-1.048-1.972-2.344-2.204-2.74-.232-.396-.024-.612.176-.808.18-.18.396-.46.596-.692.2-.232.264-.396.396-.66.132-.264.064-.492-.032-.692-.1-.2-.892-2.148-1.224-2.94-.32-.764-.648-.66-.892-.672-.232-.012-.496-.012-.76-.012a1.46 1.46 0 0 0-1.06.496c-.364.396-1.388 1.356-1.388 3.304s1.42 3.832 1.62 4.096c.2.264 2.796 4.268 6.78 5.984.948.408 1.688.652 2.264.836.952.304 1.816.26 2.5.16.764-.116 2.348-.96 2.68-1.888.328-.928.328-1.724.232-1.888-.1-.164-.364-.264-.76-.464z"/>
        </svg>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-[59] bg-black/40 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="relative flex flex-col items-center gap-5 p-6 pt-8 rounded-3xl bg-gradient-to-br from-card via-card to-[#25D366]/5 border border-border shadow-2xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setExpanded(false)}
              className="absolute top-2 left-2 h-8 w-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center gap-1">
              <div className="h-12 w-12 rounded-2xl bg-[#25D366]/15 flex items-center justify-center">
                <svg viewBox="0 0 32 32" className="h-7 w-7 text-[#25D366]" fill="currentColor">
                  <path d="M16 .396C7.164.396 0 7.56 0 16.396c0 2.836.744 5.612 2.156 8.052L.06 31.604l7.34-2.06a15.93 15.93 0 0 0 8.6 2.456h.004c8.836 0 16-7.164 16-16S24.836.396 16 .396zm7.232 19.316c-.396-.2-2.348-1.16-2.712-1.292-.364-.132-.628-.2-.892.2s-1.024 1.292-1.256 1.556c-.232.264-.46.296-.856.1-.396-.2-1.672-.616-3.184-1.964-1.176-1.048-1.972-2.344-2.204-2.74-.232-.396-.024-.612.176-.808.18-.18.396-.46.596-.692.2-.232.264-.396.396-.66.132-.264.064-.492-.032-.692-.1-.2-.892-2.148-1.224-2.94-.32-.764-.648-.66-.892-.672-.232-.012-.496-.012-.76-.012a1.46 1.46 0 0 0-1.06.496c-.364.396-1.388 1.356-1.388 3.304s1.42 3.832 1.62 4.096c.2.264 2.796 4.268 6.78 5.984.948.408 1.688.652 2.264.836.952.304 1.816.26 2.5.16.764-.116 2.348-.96 2.68-1.888.328-.928.328-1.724.232-1.888-.1-.164-.364-.264-.76-.464z"/>
                </svg>
              </div>
              <p className="text-xs text-muted-foreground">أدخل رقم الهاتف للتواصل مباشرة</p>
            </div>

            <div className="w-full">
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">رقم الهاتف مع رمز الدولة</label>
              <input
                type="tel"
                dir="ltr"
                inputMode="tel"
                autoFocus
                value={num}
                onChange={(e) => setNum(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") openWhatsApp(); }}
                placeholder="+212621256548"
                className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-foreground text-sm tracking-wide placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40 focus:border-[#25D366]/40 transition-all"
              />
              <p className="text-[10.5px] text-muted-foreground mt-1.5 text-right">
                مثال: +212621256548
              </p>
            </div>

            <button
              onClick={openWhatsApp}
              className="w-full h-11 rounded-xl bg-[#25D366] hover:bg-[#1ebe57] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/30 active:scale-[0.98] text-white font-semibold text-sm"
            >
              <svg viewBox="0 0 32 32" className="h-4 w-4" fill="currentColor">
                <path d="M16 .396C7.164.396 0 7.56 0 16.396c0 2.836.744 5.612 2.156 8.052L.06 31.604l7.34-2.06a15.93 15.93 0 0 0 8.6 2.456h.004c8.836 0 16-7.164 16-16S24.836.396 16 .396zm0 29.18a13.18 13.18 0 0 1-6.72-1.836l-.48-.288-4.36 1.224 1.244-4.244-.312-.492A13.16 13.16 0 0 1 2.836 16.4C2.836 9.116 8.72 3.232 16 3.232S29.164 9.116 29.164 16.4 23.28 29.576 16 29.576zm7.232-9.864c-.396-.2-2.348-1.16-2.712-1.292-.364-.132-.628-.2-.892.2s-1.024 1.292-1.256 1.556c-.232.264-.46.296-.856.1-.396-.2-1.672-.616-3.184-1.964-1.176-1.048-1.972-2.344-2.204-2.74-.232-.396-.024-.612.176-.808.18-.18.396-.46.596-.692.2-.232.264-.396.396-.66.132-.264.064-.492-.032-.692-.1-.2-.892-2.148-1.224-2.94-.32-.764-.648-.66-.892-.672-.232-.012-.496-.012-.76-.012a1.46 1.46 0 0 0-1.06.496c-.364.396-1.388 1.356-1.388 3.304s1.42 3.832 1.62 4.096c.2.264 2.796 4.268 6.78 5.984.948.408 1.688.652 2.264.836.952.304 1.816.26 2.5.16.764-.116 2.348-.96 2.68-1.888.328-.928.328-1.724.232-1.888-.1-.164-.364-.264-.76-.464z"/>
              </svg>
              فتح المحادثة
            </button>
          </div>
        </div>
      )}
    </>
  );
}