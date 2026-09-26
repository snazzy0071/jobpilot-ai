import { RouteNotFound } from "@/components/layout/route-states";

export default function NotFound() {
  return <RouteNotFound homeHref="/dashboard" homeLabel="Back to your dashboard" />;
}
