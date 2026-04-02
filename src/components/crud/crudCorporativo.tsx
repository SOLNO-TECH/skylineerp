import { Icon } from '@iconify/react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

/** Encabezado de página tipo «Control de Unidades». */
export const CRUD_HEADER_ROW = 'mb-6 flex flex-wrap items-start justify-between gap-4';
export const CRUD_PAGE_TITLE = 'text-2xl font-semibold text-gray-900';
export const CRUD_PAGE_SUBTITLE = 'mt-1 text-sm font-medium text-gray-500';
export const CRUD_ERROR_BANNER = 'mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600';

/** Barra de búsqueda / filtros compacta. */
export const CRUD_TOOLBAR = 'mb-4 rounded-lg border border-skyline-border bg-white p-3 shadow-sm';
export const CRUD_TOOLBAR_ROW = 'flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-3';
export const CRUD_SEARCH_LABEL = 'text-xs font-medium text-gray-600';
export const CRUD_SEARCH_INNER =
  'mt-0.5 flex items-center gap-1.5 rounded-md border border-skyline-border bg-gray-50/80 px-2 transition-colors focus-within:border-skyline-blue focus-within:ring-1 focus-within:ring-skyline-blue';
export const CRUD_SEARCH_INPUT =
  'min-h-[2rem] w-full border-0 bg-transparent py-1 text-sm text-gray-900 outline-none placeholder:text-gray-400';

export const CRUD_FILTER_GRID = 'mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6';
export const CRUD_SELECT =
  'mt-0.5 w-full rounded-md border border-skyline-border bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-skyline-blue focus:ring-1 focus:ring-skyline-blue';

export const CRUD_FILTER_PILL_ACTIVE =
  'rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors border-skyline-blue bg-skyline-blue text-white shadow-sm';
export const CRUD_FILTER_PILL =
  'rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors border-skyline-border bg-white text-gray-600 hover:border-skyline-blue hover:text-skyline-blue';

export const CRUD_TABLE_OUTER =
  'overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.04)] [scrollbar-color:rgb(203_213_225)_rgb(248_250_252)]';
export const CRUD_TABLE = 'w-full border-collapse text-sm text-slate-700';
export const CRUD_THEAD_TR = 'border-b border-slate-200 bg-[#f4f6f8]';
export const CRUD_TBODY = 'divide-y divide-slate-100/90';

export function crudTableRowClass(rowIdx: number, opts?: { clickable?: boolean }): string {
  const zebra = rowIdx % 2 === 1 ? 'bg-[#fafbfc]' : 'bg-white';
  const hover = 'transition-[background-color] duration-150 hover:bg-slate-50/90';
  const cur = opts?.clickable ? 'cursor-pointer' : '';
  return [cur, hover, zebra].filter(Boolean).join(' ');
}

export const CRUD_TD = 'px-3 py-2.5 align-middle';
export const CRUD_TD_CENTER = 'px-3 py-2.5 text-center align-middle';

/** Celdas de datos (centradas, misma familia sans). */
export const CRUD_CELDA_BASE =
  'font-sans text-[13px] leading-normal text-slate-700 text-center antialiased';
export const CRUD_CELDA_PRIMARIO = `${CRUD_CELDA_BASE} tabular-nums font-bold`;
export const CRUD_CELDA_SEC = `${CRUD_CELDA_BASE} font-normal`;
export const CRUD_CELDA_TAB = `${CRUD_CELDA_BASE} tabular-nums font-normal`;

/** Variante alineada a la izquierda (listados tipo cliente / renta). */
export const CRUD_CELDA_BASE_LEFT =
  'font-sans text-[13px] leading-normal text-slate-700 antialiased';
export const CRUD_CELDA_SEC_LEFT = `${CRUD_CELDA_BASE_LEFT} font-normal`;
export const CRUD_CELDA_MUTED_LEFT = `${CRUD_CELDA_BASE_LEFT} font-normal text-slate-600`;
export const CRUD_CELDA_PRIMARIO_LEFT = `${CRUD_CELDA_BASE_LEFT} tabular-nums font-bold text-slate-900`;

export const CRUD_SPINNER_WRAP = 'flex justify-center py-12';
export const CRUD_SPINNER =
  'h-8 w-8 animate-spin rounded-full border-2 border-skyline-border border-t-skyline-blue';

export function CrudTableTh({
  icon,
  children,
  className,
  align = 'center',
  title,
}: {
  icon: string;
  children: ReactNode;
  className: string;
  align?: 'center' | 'start' | 'end';
  title?: string;
}) {
  /** Icono centrado sobre la etiqueta; el bloque completo se alinea en la celda con flex (evita huecos raros en tablas anchas). */
  const rowJustify =
    align === 'end' ? 'justify-end' : align === 'start' ? 'justify-start' : 'justify-center';
  return (
    <th className={className} title={title}>
      <div className={`flex min-h-[2.75rem] items-center ${rowJustify}`}>
        <span className="inline-flex max-w-full flex-col items-center gap-1.5 py-0.5">
          <Icon icon={icon} className="size-[15px] shrink-0 text-slate-400" aria-hidden />
          <span className="px-1 text-center text-[10px] font-semibold uppercase leading-tight tracking-[0.07em] text-slate-500">
            {children}
          </span>
        </span>
      </div>
    </th>
  );
}

/** Grupo de acciones por icono (mismo lenguaje que Control de Unidades). */
export const CRUD_ACTION_GROUP =
  'inline-flex items-center justify-center gap-px rounded-lg border border-slate-200/90 bg-slate-50/80 p-0.5 shadow-sm shadow-slate-900/[0.02]';

export const CRUD_ACTION_ICON_BTN =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white hover:text-[#2D58A7] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D58A7]/25 disabled:pointer-events-none disabled:opacity-40';

export const CRUD_ACTION_ICON_BTN_DANGER =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white hover:text-red-600 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:pointer-events-none disabled:opacity-40';

export function CrudActionGroup({
  'aria-label': ariaLabel,
  children,
  className,
}: {
  'aria-label': string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${CRUD_ACTION_GROUP}${className ? ` ${className}` : ''}`} role="group" aria-label={ariaLabel}>
      {children}
    </div>
  );
}

type CrudActionIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: string;
  title: string;
  danger?: boolean;
};

export function CrudActionIconButton({ icon, title, danger, className, type = 'button', ...rest }: CrudActionIconButtonProps) {
  const base = danger ? CRUD_ACTION_ICON_BTN_DANGER : CRUD_ACTION_ICON_BTN;
  return (
    <button
      type={type}
      title={title}
      aria-label={title}
      className={`${base}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      <Icon icon={icon} className="size-[18px] shrink-0" aria-hidden />
    </button>
  );
}

type CrudActionIconLinkProps = Omit<LinkProps, 'children'> & {
  icon: string;
  title: string;
};

export function CrudActionIconLink({ to, icon, title, className, ...rest }: CrudActionIconLinkProps) {
  return (
    <Link
      to={to}
      title={title}
      aria-label={title}
      className={`${CRUD_ACTION_ICON_BTN} no-underline${className ? ` ${className}` : ''}`}
      {...rest}
    >
      <Icon icon={icon} className="size-[18px] shrink-0" aria-hidden />
    </Link>
  );
}

type CrudActionIconAnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & {
  icon: string;
  title: string;
  href: string;
};

export function CrudActionIconAnchor({
  href,
  icon,
  title,
  className,
  target = '_blank',
  rel = 'noreferrer',
  ...rest
}: CrudActionIconAnchorProps) {
  return (
    <a
      href={href}
      title={title}
      aria-label={title}
      target={target}
      rel={rel}
      className={`${CRUD_ACTION_ICON_BTN} no-underline${className ? ` ${className}` : ''}`}
      {...rest}
    >
      <Icon icon={icon} className="size-[18px] shrink-0" aria-hidden />
    </a>
  );
}
