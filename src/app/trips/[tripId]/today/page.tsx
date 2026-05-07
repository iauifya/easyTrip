import { TodayMode } from "@/components/today-mode";

type TodayPageProps = {
  params: Promise<{
    tripId: string;
  }>;
};

export default async function TodayPage({ params }: TodayPageProps) {
  const { tripId } = await params;

  return <TodayMode tripId={tripId} />;
}
