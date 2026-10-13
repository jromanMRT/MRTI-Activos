import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold whitespace-nowrap transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300',
        success: 'bg-mrt-good/12 text-mrt-good dark:bg-mrt-good/20 dark:text-mrt-good-light',
        warning: 'bg-mrt-warn/12 text-mrt-warn dark:bg-mrt-warn/20 dark:text-mrt-warn-light',
        danger: 'bg-mrt-bad/12 text-mrt-bad dark:bg-mrt-bad/20 dark:text-mrt-bad-light',
        info: 'bg-mrt-info/12 text-mrt-info dark:bg-mrt-info/20 dark:text-mrt-info-light',
        outline: 'border border-stone-200 text-stone-600 dark:border-stone-600 dark:text-stone-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
