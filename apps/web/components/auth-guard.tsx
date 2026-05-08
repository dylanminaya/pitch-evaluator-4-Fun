"use client";

import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/better-auth/auth-client";

const publicRoutes = ["/", "/signup"];
const authRoutes = ["/", "/signup"];

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    pathname.startsWith("/organizer-invitations/") ||
    pathname.startsWith("/invitation/") ||
    pathname.startsWith("/vote/");

  const isAuthRoute = authRoutes.includes(pathname);

  useEffect(() => {
    if (isPending) return; // Still loading session

    const hasSession = !!session;

    if (!hasSession && !isPublicRoute) {
      // Redirect to login with current path as redirect
      const loginUrl = new URL("/", window.location.origin);
      loginUrl.searchParams.set("redirect", pathname);
      router.push(loginUrl.toString());
      return;
    }

    if (hasSession && isAuthRoute) {
      // Don't redirect if switching accounts
      if (searchParams.get("switchAccount") === "1") {
        return;
      }

      // Redirect authenticated users away from auth pages
      const redirect = searchParams.get("redirect");
      if (redirect?.startsWith("/")) {
        router.push(redirect);
        return;
      }

      router.push("/events");
      return;
    }
  }, [session, isPending, pathname, isPublicRoute, isAuthRoute, router, searchParams]);

  // Show loading state while checking session
  if (isPending && !isPublicRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mx-auto"></div>
          <p className="text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}