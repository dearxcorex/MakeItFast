import FieldOpsFetcher from "@/components/field-ops/FieldOpsFetcher";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  return <FieldOpsFetcher />;
}
