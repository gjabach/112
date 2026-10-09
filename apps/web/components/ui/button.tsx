'use client';
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'studio-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-4 py-2',
        sm: 'h-9 px-3 text-xs',
        lg: 'h-12 px-6',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, children, ...props }, ref) => {
    const merged = cn(buttonVariants({ variant, size, className }));
    if (
      asChild &&
      React.isValidElement<
        React.HTMLAttributes<HTMLElement> & {
          className?: string;
          ref?: React.Ref<HTMLElement>;
        }
      >(children)
    ) {
      const child = children;
      const nonNative =
        typeof child.type === 'string' &&
        !['a', 'button', 'input'].includes(child.type);
      return React.cloneElement(child, {
        ...props,
        ...child.props,
        className: cn(merged, child.props.className),
        'aria-disabled': props.disabled || child.props['aria-disabled'],
        role: child.props.role || (nonNative ? 'button' : undefined),
        tabIndex: props.disabled
          ? -1
          : (child.props.tabIndex ?? (nonNative ? 0 : undefined)),
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
          child.props.onKeyDown?.(event);
          if (!event.defaultPrevented)
            props.onKeyDown?.(event as React.KeyboardEvent<HTMLButtonElement>);
          if (
            !event.defaultPrevented &&
            !props.disabled &&
            nonNative &&
            ['Enter', ' '].includes(event.key)
          ) {
            event.preventDefault();
            event.currentTarget.click();
          }
        },
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          if (props.disabled) {
            event.preventDefault();
            return;
          }
          child.props.onClick?.(event);
          if (!event.defaultPrevented)
            props.onClick?.(event as React.MouseEvent<HTMLButtonElement>);
        },
        ref: (node: HTMLElement | null) => {
          if (typeof ref === 'function') ref(node as HTMLButtonElement | null);
          else if (ref) ref.current = node as HTMLButtonElement | null;
          const childRef = child.props.ref;
          if (typeof childRef === 'function') childRef(node);
          else if (childRef)
            (childRef as React.MutableRefObject<HTMLElement | null>).current =
              node;
        },
      });
    }
    return (
      <button
        type="button"
        aria-label={
          props['aria-label'] || (size === 'icon' ? props.title : undefined)
        }
        className={merged}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
