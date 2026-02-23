/// <reference lib="deno.ns" />

declare namespace Deno {
    export const env: {
        get(key: string): string | undefined;
    };

    export function serve(
        handler: (req: Request) => Response | Promise<Response>,
        options?: { port?: number; hostname?: string }
    ): void;
}