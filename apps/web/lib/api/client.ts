//helper base para fetch

import { validateClientEnv } from "@workspace/shared/env/client";

const { NEXT_PUBLIC_API_URL } = validateClientEnv();

export async function apiFetch<T>(path: string, init?:RequestInit): Promise<T> {
    const res = await fetch(`${NEXT_PUBLIC_API_URL}${path}`, {
        ...init,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {})
        },
    });

    if (!res.ok){
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.message ?? "Request failed");
    }

    return res.json() as Promise<T>;//convierte a json
}

export async function apiFetchBlob(path: string, init?: RequestInit): Promise<Blob> {
    const res = await fetch(`${NEXT_PUBLIC_API_URL}${path}`, {
        ...init,
        credentials: "include",
    })

    if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.message ?? "Request failed");
    }

    return res.blob()
}

export async function apiFetchFile<T>(path: string, file: File): Promise<T> {
    const res = await fetch(`${NEXT_PUBLIC_API_URL}${path}`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": file.type || "application/octet-stream",
            "X-File-Name": encodeURIComponent(file.name),
        },
        body: file,
    })

    if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.message ?? "Request failed");
    }

    return res.json() as Promise<T>;
}

export async function apiFetchVoid(path: string, init?: RequestInit): Promise<void> {
    const res = await fetch(`${NEXT_PUBLIC_API_URL}${path}`, {
        ...init,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });

    if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.message ?? "Request failed");
    }
}
