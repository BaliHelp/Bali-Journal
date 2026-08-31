'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AsyncButtonProps extends Omit<React.ComponentProps<typeof Button>, 'onClick'> {
  onClick: () => unknown | Promise<unknown>
}

/**
 * Drop-in replacement for Button on actions that hit the network - shows a
 * spinner in place of its children and disables itself for the duration of
 * onClick, so every async admin action gives the same instant "it's
 * working" feedback without each call site tracking its own loading state.
 */
export function AsyncButton({ onClick, disabled, children, ...props }: AsyncButtonProps) {
  const [pending, setPending] = React.useState(false)

  return (
    <Button
      {...props}
      disabled={disabled || pending}
      onClick={async () => {
        setPending(true)
        try {
          await onClick()
        } finally {
          setPending(false)
        }
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </Button>
  )
}
