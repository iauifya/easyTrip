import type { ItineraryItemType, TripPace } from "./trip";

export type TripMemberRole = "owner" | "editor";
export type ProposalReactionValue = "must" | "okay" | "no";
export type ProposalStatus = "candidate" | "adopted" | "withdrawn";
export type ConsensusLabel = "popular" | "conflict" | "pending" | "skip";

export type CloudTripSummary = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  pace: TripPace;
  mustQuotaEnabled: boolean;
  mustQuotaLimit: number;
  version: number;
  role: TripMemberRole;
};
export type PlaceProposal = {
  id: string;
  tripId: string;
  createdBy: string;
  creatorName: string;
  title: string;
  address?: string;
  googlePlaceId?: string;
  googleMapsUrl?: string;
  lat?: number;
  lng?: number;
  suggestedType: ItineraryItemType;
  status: ProposalStatus;
  adoptedItemId?: string;
  version: number;
  createdAt: string;
  reactions: ProposalReaction[];
};

export type ProposalReaction = {
  userId: string;
  displayName: string;
  value: ProposalReactionValue;
};

export type ConsensusSummary = {
  label: ConsensusLabel;
  must: number;
  okay: number;
  no: number;
  responses: number;
};
