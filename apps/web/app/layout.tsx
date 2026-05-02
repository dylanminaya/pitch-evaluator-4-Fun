import "@workspace/ui/globals.css";
import { cn } from "@workspace/ui/lib/utils";
import { QueryProvider } from "@/components/query-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased font-sans")}
    >
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
