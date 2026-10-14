import { Outlet, createFileRoute } from '@tanstack/react-router'

/** Layout route: children are the list (index) and the detail page ($loanId) */
export const Route = createFileRoute('/loans')({
  component: Outlet,
})
