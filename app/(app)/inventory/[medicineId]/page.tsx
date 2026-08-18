import { MedicineDetailView } from "@/components/inventory/medicine-detail-view";

/** Params are async in Next 16; the id is handed to the client view as a prop. */
export default async function MedicineDetailPage({
  params,
}: {
  params: Promise<{ medicineId: string }>;
}) {
  const { medicineId } = await params;
  return <MedicineDetailView medicineId={medicineId} />;
}
