import { ItineraryDayPlanner } from "@/components/itinerary-day-planner";

type TripDayPageProps = {
  params: Promise<{
    tripId: string;
    dayId: string;
  }>;
};

export default async function TripDayPage({ params }: TripDayPageProps) {
  const { tripId, dayId } = await params;

  return <ItineraryDayPlanner dayId={dayId} tripId={tripId} />;
}
