import { Outlet, createFileRoute } from '@tanstack/react-router'

/** Layout route: children are the list (index) and the customer detail page */
export const Route = createFileRoute('/customers')({
  component: Outlet,
})
