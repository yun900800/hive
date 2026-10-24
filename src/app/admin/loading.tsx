import { PageSkeleton } from "@/components/patterns/page-skeleton";

export default function AdminLoading() {
  return <PageSkeleton stats={4} rows={7} />;
}
