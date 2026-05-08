import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { init as initInteractionDebug } from "@/lib/interaction-debug";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google", content: "notranslate" },
      { httpEquiv: "Content-Language", content: "ar" },
      { title: "Master Manager" },
      { name: "description", content: "Master Manager - نظام إدارة متكامل." },
      { property: "og:title", content: "Master Manager" },
      { name: "twitter:title", content: "Master Manager" },
      { property: "og:description", content: "Master Manager - نظام إدارة متكامل." },
      { name: "twitter:description", content: "Master Manager - نظام إدارة متكامل." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/RclejtOOygPJ4dAXwGOUvkuIJXS2/social-images/social-1778193929716-اعد_رسم_الصورة_واستبدل_Digital_202605072345.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/RclejtOOygPJ4dAXwGOUvkuIJXS2/social-images/social-1778193929716-اعد_رسم_الصورة_واستبدل_Digital_202605072345.webp" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background" dir="rtl">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-muted-foreground">الصفحة غير موجودة</p>
        <a href="/" className="text-primary underline mt-4 inline-block">العودة للرئيسية</a>
      </div>
    </div>
  ),
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" translate="no" className="notranslate">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => { initInteractionDebug(); }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster richColors position="top-center" dir="rtl" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
