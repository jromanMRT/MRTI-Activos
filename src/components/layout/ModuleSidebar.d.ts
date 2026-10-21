// GENERADO desde MRTI-Platform@abd558b (src/layout/ModuleSidebar.d.ts).
// No editar aquí: cambiar en MRTI-Platform y ejecutar bin/sync.mjs.
import { ReactNode } from 'react';

export function ModuleSidebar(props: {
  moduleLabel: string;
  collapsed: boolean;
  mobileOpen?: boolean;
  onToggleCollapse: () => void;
  onThemeToggle: () => void;
  theme: string;
  children: ReactNode;
}): JSX.Element;

export function SidebarGroup(props: {
  label?: string;
  children: ReactNode;
}): JSX.Element | null;

export function SidebarNavIcon(props: {
  children: ReactNode;
}): JSX.Element;
