import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ore-400/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-br from-ore-600 to-ore-500 text-white shadow-[0_2px_8px_rgb(110_77_22/.25)] hover:opacity-90 hover:-translate-y-px hover:shadow-[0_4px_14px_rgb(110_77_22/.3)] active:translate-y-0',
        secondary:
          'border border-stone-200 bg-white text-stone-800 shadow-sm hover:bg-stone-50 hover:shadow-md dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700',
        ghost:
          'text-stone-500 hover:text-stone-800 hover:bg-stone-100 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-700',
        destructive:
          'bg-mrt-bad text-white hover:bg-mrt-bad/90 dark:bg-mrt-bad-light dark:text-stone-900',
        link: 'text-ore-600 underline-offset-4 hover:underline dark:text-ore-300 p-0 h-auto',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
