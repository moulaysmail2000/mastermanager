import { useEffect, useRef, useState } from "react";

const POS_KEY = "fw_pos_v1";
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
    if (!moved.current) {
      window.location.href = `whatsapp://send`;
    }
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
        title="فتح واتساب"
      >
        <svg viewBox="0 0 32 32" className="h-4 w-4 text-white pointer-events-none" fill="currentColor">
          <path d="M16 .396C7.164.396 0 7.56 0 16.396c0 2.836.744 5.612 2.156 8.052L.06 31.604l7.34-2.06a15.93 15.93 0 0 0 8.6 2.456h.004c8.836 0 16-7.164 16-16S24.836.396 16 .396zm0 29.18a13.18 13.18 0 0 1-6.72-1.836l-.48-.288-4.36 1.224 1.244-4.244-.312-.492A13.16 13.16 0 0 1 2.836 16.4C2.836 9.116 8.72 3.232 16 3.232S29.164 9.116 29.164 16.4 23.28 29.576 16 29.576zm7.232-9.864c-.396-.2-2.348-1.16-2.712-1.292-.364-.132-.628-.2-.892.2s-1.024 1.292-1.256 1.556c-.232.264-.46.296-.856.1-.396-.2-1.672-.616-3.184-1.964-1.176-1.048-1.972-2.344-2.204-2.74-.232-.396-.024-.612.176-.808.18-.18.396-.46.596-.692.2-.232.264-.396.396-.66.132-.264.064-.492-.032-.692-.1-.2-.892-2.148-1.224-2.94-.32-.764-.648-.66-.892-.672-.232-.012-.496-.012-.76-.012a1.46 1.46 0 0 0-1.06.496c-.364.396-1.388 1.356-1.388 3.304s1.42 3.832 1.62 4.096c.2.264 2.796 4.268 6.78 5.984.948.408 1.688.652 2.264.836.952.304 1.816.26 2.5.16.764-.116 2.348-.96 2.68-1.888.328-.928.328-1.724.232-1.888-.1-.164-.364-.264-.76-.464z"/>
        </svg>
      </div>
    </>
  );
}