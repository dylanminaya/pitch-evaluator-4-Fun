"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { useSignUp } from "@/hooks/auth";
import { signOut } from "@/lib/better-auth/auth-client";

export function SignupForm({
  redirectTo,
  forceSignOut = false,
  ...props
}: React.ComponentProps<typeof Card> & { redirectTo?: string; forceSignOut?: boolean }) {
  const { mutate, isPending, error: mutationError } = useSignUp(redirectTo);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const error = confirmError ?? mutationError?.message ?? null;

  useEffect(() => {
    if (!forceSignOut) return;

    void signOut();
  }, [forceSignOut]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setConfirmError(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirm-password") as string;

    if (password !== confirmPassword) {
      setConfirmError("Passwords do not match");
      return;
    }

    mutate({ email, password, name });
  }

  return (
    <Card
      {...props}
      className="rounded-[28px] border border-[#263550] bg-[#1a2640] py-0 text-white shadow-[0_24px_60px_rgba(2,8,23,0.36)]"
    >
      <CardHeader className="gap-3 border-b border-[#263550] px-6 py-6">
        <p className="text-[10px] font-bold uppercase italic tracking-[0.32em] text-[#83ce00]">
          Register
        </p>
        <CardTitle className="text-3xl font-black italic tracking-tight text-white">
          Create an account
        </CardTitle>
        <CardDescription className="text-sm leading-6 text-[#a9b3c9]">
          Registra tu perfil organizer para crear eventos y activar votaciones.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 py-6">
        <form onSubmit={handleSubmit}>
          <FieldGroup className="gap-6">
            {error && (
              <div className="rounded-2xl border border-[#5a2433] bg-[#2a1018] p-3 text-sm text-[#ff8cab]">
                {error}
              </div>
            )}
            <Field>
              <FieldLabel htmlFor="name" className="text-xs font-bold uppercase italic tracking-[0.24em] text-[#8899aa]">
                Full Name
              </FieldLabel>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                required
                disabled={isPending}
                className="h-12 rounded-2xl border-[#263550] bg-[#0d1526] px-4 text-white placeholder:text-[#66738f] focus-visible:border-[#0595f0] focus-visible:ring-[#0595f0]/25"
              />
            </Field>
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
              <FieldDescription className="text-sm text-[#8899aa]">
                We&apos;ll use this to contact you. We will not share your email
                with anyone else.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="password" className="text-xs font-bold uppercase italic tracking-[0.24em] text-[#8899aa]">
                Password
              </FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                required
                disabled={isPending}
                className="h-12 rounded-2xl border-[#263550] bg-[#0d1526] px-4 text-white placeholder:text-[#66738f] focus-visible:border-[#0595f0] focus-visible:ring-[#0595f0]/25"
              />
              <FieldDescription className="text-sm text-[#8899aa]">
                Must be at least 8 characters long.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel
                htmlFor="confirm-password"
                className="text-xs font-bold uppercase italic tracking-[0.24em] text-[#8899aa]"
              >
                Confirm Password
              </FieldLabel>
              <Input
                id="confirm-password"
                name="confirm-password"
                type="password"
                required
                disabled={isPending}
                className="h-12 rounded-2xl border-[#263550] bg-[#0d1526] px-4 text-white placeholder:text-[#66738f] focus-visible:border-[#0595f0] focus-visible:ring-[#0595f0]/25"
              />
              <FieldDescription className="text-sm text-[#8899aa]">Please confirm your password.</FieldDescription>
            </Field>
            <FieldGroup>
              <Field>
                <Button
                  type="submit"
                  className="h-12 w-full rounded-full bg-[#83ce00] text-sm font-bold italic text-[#0d1526] shadow-[0_10px_24px_rgba(131,206,0,0.22)] hover:bg-[#a9e92f]"
                  disabled={isPending}
                >
                  {isPending ? "Creating account..." : "Create account"}
                </Button>
                <FieldDescription className="px-6 pt-2 text-center text-sm text-[#8899aa]">
                  Already have an account?{" "}
                  <Link
                    href={redirectTo ? `/?redirect=${encodeURIComponent(redirectTo)}` : "/"}
                    className="font-semibold text-[#83ce00] underline underline-offset-4"
                  >
                    Sign in
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
