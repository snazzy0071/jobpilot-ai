import { RouteNotFound } from "@/components/layout/route-states";

export default function NotFound() {
  return <RouteNotFound homeHref="/admin" homeLabel="Back to the admin dashboard" />;
}
