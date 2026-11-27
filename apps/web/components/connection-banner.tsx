import { WifiOff } from "lucide-react";

// Aviso visible cuando se pierde la conexion con el servidor y se reintenta.
export function ConnectionBanner({ isOffline, className = "" }: { isOffline: boolean; className?: string }) {
  if (!isOffline) {
    return null;
  }

  return (
    <div
      role="status"
      className={`flex items-center gap-2 rounded-2xl border border-[#5a4a24] bg-[#2a2210] px-4 py-3 text-sm text-[#ffd27a] ${className}`}
    >
      <WifiOff className="size-4 shrink-0" />
      Sin conexión. Reintentando… Los datos en pantalla pueden no estar actualizados.
    </div>
  );
}
