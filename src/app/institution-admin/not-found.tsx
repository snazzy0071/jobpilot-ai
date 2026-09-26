import { RouteNotFound } from "@/components/layout/route-states";

export default function NotFound() {
  return <RouteNotFound homeHref="/institution-admin" homeLabel="Back to the overview" />;
}
