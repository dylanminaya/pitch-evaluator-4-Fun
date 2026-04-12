import Link from "next/link";
import { ArrowRight, CircleDot, Sparkles } from "lucide-react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  accent: string;
  ctaHref: string;
  ctaLabel: string;
  children: React.ReactNode;
};

const featureItems = [
  "Ranking en vivo con visual listo para proyectar",
  "QR por pitch para captar votos al instante",
  "Resumen de IA y control del flujo del evento",
];

export function AuthShell({
  eyebrow,
  title,
  description,
  accent,
  ctaHref,
  ctaLabel,
  children,
}: AuthShellProps) {
  return (
    <main className="min-h-svh overflow-hidden bg-[#0d1526] text-white">
      <div className="relative mx-auto flex min-h-svh w-full max-w-[1440px] flex-col lg:flex-row">
        <section className="relative flex flex-1 items-center overflow-hidden border-b border-[#263550] bg-[linear-gradient(160deg,#0d0d18_0%,#111120_52%,#0a1a0a_100%)] px-6 py-14 lg:border-b-0 lg:border-r lg:px-16">
          <div className="absolute left-[-120px] top-16 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(131,206,0,0.18)_0%,rgba(131,206,0,0)_72%)]" />
          <div className="absolute bottom-[-120px] right-[-80px] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(5,149,240,0.16)_0%,rgba(5,149,240,0)_72%)]" />

          <div className="relative z-10 mx-auto flex w-full max-w-[620px] flex-col gap-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#83ce00] text-sm font-black text-[#0d1526] shadow-[0_0_0_6px_rgba(131,206,0,0.12)]">
                P
              </div>
              <div>
                <p className="text-lg font-black italic tracking-tight">PITCH 4 FUN</p>
                <p className="text-xs font-bold uppercase italic tracking-[0.3em] text-[#83ce00]">
                  Menos show, mas ejecucion
                </p>
              </div>
            </div>

            <div className="flex max-w-[560px] flex-col gap-4">
              <p className="text-[11px] font-bold uppercase italic tracking-[0.36em] text-[#83ce00]">
                {eyebrow}
              </p>
              <h1 className="max-w-[10ch] text-4xl font-black italic leading-none tracking-tight md:text-6xl">
                {title}
              </h1>
              <p className="max-w-[540px] text-base leading-7 text-[#a9b3c9] md:text-lg">
                {description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#ff2d78] bg-[#1a0a0a] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ff6ea7]">
                <CircleDot className="size-3 fill-current" />
                En vivo
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#2a4a2a] bg-[#0a1a0a] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ccff00]">
                <Sparkles className="size-3" />
                Dashboard-ready
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {featureItems.map((item, index) => (
                <article
                  key={item}
                  className="rounded-2xl border border-[#263550] bg-[#121d30]/90 p-4 shadow-[0_18px_40px_rgba(2,8,23,0.28)]"
                >
                  <p className="text-[10px] font-bold uppercase italic tracking-[0.28em] text-[#8899aa]">
                    0{index + 1}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#dce4f2]">{item}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="flex w-full items-center justify-center bg-[#121d30] px-6 py-10 lg:w-[540px] lg:px-[60px]">
          <div className="w-full max-w-[420px]">
            {children}

            <Link
              href={ctaHref}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#83ce00] transition hover:text-[#b6ef50]"
            >
              <span>{ctaLabel}</span>
              <ArrowRight className="size-4" />
            </Link>

            <p className="mt-5 text-xs leading-6 text-[#8899aa]">
              {accent}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
