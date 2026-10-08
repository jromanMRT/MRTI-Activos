// GENERADO desde MRTI-Platform@7f88163 (src/permission-ui.d.ts).
// No editar aquí: cambiar en MRTI-Platform y ejecutar bin/sync.mjs.
import type { ReactNode } from 'react';
export function useModulePermissions(code: string): { profile: any; loading: boolean; error: string; can: (path: string, method?: string) => boolean; level: (path: string) => string; refresh: () => Promise<void> };
export function PermissionBoundary(props: { code: string; children: ReactNode }): ReactNode;
