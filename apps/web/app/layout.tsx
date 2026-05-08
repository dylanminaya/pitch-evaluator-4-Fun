import "@workspace/ui/globals.css";
import { Suspense } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { QueryProvider } from "@/components/query-provider";
import { AuthGuard } from "@/components/auth-guard";
import localFont from "next/font/local";

const obvia = localFont({
  src: [
    {
      path: "../font/fonnts.com-Obvia_Thin.otf",
      weight: "100",
      style: "normal",
    },
    {
      path: "../font/fonnts.com-Obvia_Thin_Italic.otf",
      weight: "100",
      style: "italic",
    },
    {
      path: "../font/fonnts.com-Obvia_Light.otf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../font/fonnts.com-Obvia_Light_Italic.otf",
      weight: "300",
      style: "italic",
    },
    {
      path: "../font/fonnts.com-Obvia_Book.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../font/fonnts.com-Obvia_Book_Italic.otf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../font/fonnts.com-Obvia_Medium.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../font/fonnts.com-Obvia_Medium_Italic.otf",
      weight: "500",
      style: "italic",
    },
    {
      path: "../font/fonnts.com-Obvia_Bold.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../font/fonnts.com-Obvia_Bold_Italic.otf",
      weight: "700",
      style: "italic",
    },
    {
      path: "../font/fonnts.com-Obvia_Black.otf",
      weight: "900",
      style: "normal",
    },
    {
      path: "../font/fonnts.com-Obvia_Black_Italic.otf",
      weight: "900",
      style: "italic",
    },
  ],
  display: "swap",
  variable: "--font-obvia",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(obvia.variable, "font-sans antialiased")}
    >
      <body>
        <QueryProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <AuthGuard>{children}</AuthGuard>
          </Suspense>
        </QueryProvider>
      </body>
    </html>
  );
}
