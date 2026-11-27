//helper base para fetch

import { validateClientEnv } from "@workspace/shared/env/client";

const { NEXT_PUBLIC_API_URL } = validateClientEnv();

// Error de API con el codigo HTTP; status 0 significa sin conexion.
export class ApiError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        this.name = "ApiError";
    }
}

export const NETWORK_ERROR_MESSAGE = "Sin conexion con el servidor";

export function isNetworkError(error: unknown) {
    return error instanceof ApiError && error.status === 0;
}

// Reintenta errores de red o del servidor, pero no los 4xx.
export function shouldRetryRequest(failureCount: number, error: unknown) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return false;
    }
    return failureCount < 2;
}

async function request(url: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
        res = await fetch(url, init);
    } catch {
        throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
    }

    if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new ApiError(errorBody?.message ?? "Request failed", res.status);
    }

    return res;
}

export async function apiFetch<T>(path: string, init?:RequestInit): Promise<T> {
    const res = await request(`${NEXT_PUBLIC_API_URL}${path}`, {
        ...init,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {})
        },
    });

    return res.json() as Promise<T>;
}

export async function apiFetchBlob(path: string, init?: RequestInit): Promise<Blob> {
    const res = await request(`${NEXT_PUBLIC_API_URL}${path}`, {
        ...init,
        credentials: "include",
    });

    return res.blob()
}

export async function apiFetchFile<T>(path: string, file: File): Promise<T> {
    const res = await request(`${NEXT_PUBLIC_API_URL}${path}`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": file.type || "application/octet-stream",
            "X-File-Name": encodeURIComponent(file.name),
        },
        body: file,
    });

    return res.json() as Promise<T>;
}

export async function apiFetchVoid(path: string, init?: RequestInit): Promise<void> {
    await request(`${NEXT_PUBLIC_API_URL}${path}`, {
        ...init,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });
}
