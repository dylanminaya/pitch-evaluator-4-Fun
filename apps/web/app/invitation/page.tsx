"use client";

import Link from "next/link";
import { Button } from "@workspace/ui/components/button";

export default function InvitationIndexPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[#0d1526] px-6 text-center text-white">
      <div className="max-w-md rounded-[24px] border border-[#263550] bg-[#1a2640] px-8 py-10">
        <h1 className="text-2xl font-black tracking-tight">Invitacion no especificada</h1>
        <p className="mt-3 text-sm leading-6 text-[#a9b3c9]">
          Abre el link completo del evento para ver todos los pitches disponibles.
        </p>
        <div className="mt-6">
          <Link href="/">
            <Button className="rounded-full bg-[#83ce00] text-[#0d1526] hover:bg-[#a7ea2e]">
              Volver al inicio
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
