import { Outlet, createFileRoute } from '@tanstack/react-router'

/** Layout route: children are the list (index), create (new) and detail pages */
export const Route = createFileRoute('/batches')({
  component: Outlet,
})
