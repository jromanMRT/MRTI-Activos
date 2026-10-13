import * as React from 'react';
import { cn } from '../../lib/utils';

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      'flex min-h-[80px] w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-stone-400 focus:border-ore-500 focus:ring-2 focus:ring-ore-400/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-ore-400 dark:focus:ring-ore-400/20',
      className
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Textarea };
