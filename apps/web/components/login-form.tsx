"use client";

import { useEffect } from "react";
import Link from "next/link";
import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { useSignIn } from "@/hooks/auth";
import { signOut } from "@/lib/better-auth/auth-client";

export function LoginForm({
  className,
  redirectTo,
  forceSignOut = false,
  ...props
}: React.ComponentProps<"div"> & { redirectTo?: string; forceSignOut?: boolean }) {
  const { mutate, isPending, error } = useSignIn(redirectTo);

  useEffect(() => {
    if (!forceSignOut) return;

    void signOut();
  }, [forceSignOut]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    mutate({ email, password });
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="rounded-[28px] border border-[#263550] bg-[#1a2640] py-0 text-white shadow-[0_24px_60px_rgba(2,8,23,0.36)]">
        <CardHeader className="gap-3 border-b border-[#263550] px-6 py-6">
          <p className="text-[10px] font-bold uppercase italic tracking-[0.32em] text-[#83ce00]">
            Login
          </p>
          <CardTitle className="text-3xl font-black italic tracking-tight text-white">
            Entra a tu cuenta
          </CardTitle>
          <CardDescription className="text-sm leading-6 text-[#a9b3c9]">
            Usa tu correo y contraseña para abrir el panel del organizer.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-6">
          <form onSubmit={handleSubmit}>
            <FieldGroup className="gap-6">
              {error && (
                <div className="rounded-2xl border border-[#5a2433] bg-[#2a1018] p-3 text-sm text-[#ff8cab]">
                  {error.message}
                </div>
              )}
              <Field>
                <FieldLabel htmlFor="email" className="text-xs font-bold uppercase italic tracking-[0.24em] text-[#8899aa]">
                  Email
                </FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  disabled={isPending}
                  className="h-12 rounded-2xl border-[#263550] bg-[#0d1526] px-4 text-white placeholder:text-[#66738f] focus-visible:border-[#0595f0] focus-visible:ring-[#0595f0]/25"
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password" className="text-xs font-bold uppercase italic tracking-[0.24em] text-[#8899aa]">
                    Password
                  </FieldLabel>
                  <Link
                    href="#"
                    className="ml-auto inline-block text-sm text-[#83ce00] underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  disabled={isPending}
                  className="h-12 rounded-2xl border-[#263550] bg-[#0d1526] px-4 text-white placeholder:text-[#66738f] focus-visible:border-[#0595f0] focus-visible:ring-[#0595f0]/25"
                />
              </Field>
              <Field>
                <Button
                  type="submit"
                  className="h-12 w-full cursor-pointer rounded-full bg-[#83ce00] text-sm font-bold italic text-[#0d1526] shadow-[0_10px_24px_rgba(131,206,0,0.22)] hover:bg-[#a9e92f]"
                  disabled={isPending}
                >
                  {isPending ? "Entrando..." : "Entrar al dashboard"}
                </Button>
                <FieldDescription className="pt-2 text-center text-sm text-[#8899aa]">
                  Don&apos;t have an account?{" "}
                  <Link
                    href={redirectTo ? `/signup?redirect=${encodeURIComponent(redirectTo)}` : "/signup"}
                    className="font-semibold text-[#83ce00] underline underline-offset-4"
                  >
                    Sign up
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
