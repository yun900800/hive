import { PageSkeleton } from "@/components/patterns/page-skeleton";

export default function MemberLoading() {
  return <PageSkeleton stats={3} rows={6} />;
}
