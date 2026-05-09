import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export default function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString("ar-MA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const date = now.toLocaleDateString("ar-MA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div
      dir="rtl"
      className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 backdrop-blur px-3 py-1 sm:py-1.5 shadow-sm"
    >
      <Clock className="h-3.5 w-3.5 text-primary" />
      <span className="text-[10px] sm:text-xs font-bold tabular-nums text-foreground">
        {time}
      </span>
      <span className="h-3 w-px bg-border/60" />
      <span className="text-[9px] sm:text-[10px] text-muted-foreground">{date}</span>
    </div>
  );
}
