import { createRoutePreviewModel } from "@/lib/routes/route-preview";
import { formatDistanceMeters, type RouteTravelEstimate } from "@/lib/routes/travel-estimates";
import type { ItineraryItem } from "@/types/trip";

const tilePattern = {
  backgroundImage:
    "radial-gradient(circle at 12px 12px, rgba(196, 62, 48, 0.16) 1.5px, transparent 1.5px), radial-gradient(circle at 4px 20px, rgba(12, 65, 96, 0.12) 1px, transparent 1px)",
  backgroundSize: "28px 28px",
};

const markerPositions = [
  { left: "14%", top: "20%" },
  { left: "54%", top: "24%" },
  { left: "36%", top: "58%" },
  { left: "70%", top: "78%" },
  { left: "22%", top: "82%" },
  { left: "82%", top: "44%" },
];

function getLegStatusLabel(leg: ReturnType<typeof createRoutePreviewModel>["legs"][number]) {
  if (leg.estimatedMinutes) {
    return `${leg.estimatedMinutes} 分`;
  }

  if (leg.status === "pending") {
    return "待估算";
  }

  return "待補連結";
}

export function RoutePreview({
  estimateMessage,
  estimates = [],
  isEstimating = false,
  items,
}: {
  estimateMessage?: string;
  estimates?: RouteTravelEstimate[];
  isEstimating?: boolean;
  items: ItineraryItem[];
}) {
  const model = createRoutePreviewModel(items, estimates);
  const previewStops = model.stops.slice(0, markerPositions.length);

  if (model.stops.length === 0) {
    return (
      <section className="relative overflow-hidden border-2 border-[#183833] bg-[#e9efe7] p-5 shadow-[6px_6px_0_#d9b75f]">
        <div className="absolute inset-0 opacity-70" style={tilePattern} />
        <div className="relative">
          <p className="text-sm font-black text-[#1a5b4f]">ROUTE PREVIEW</p>
          <h2 className="mt-1 text-2xl font-black">等待第一個地點</h2>
          <p className="mt-4 text-sm leading-7 text-[#53635f]">
            新增行程點後，這裡會整理停留點、Google Maps 連結狀態與相鄰站點緩衝時間。
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-[560px] overflow-hidden border-2 border-[#183833] bg-[#e9efe7] p-5 shadow-[6px_6px_0_#d9b75f] sm:p-6">
      <div className="absolute inset-0 opacity-70" style={tilePattern} />
      <div className="relative flex h-full flex-col">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-black text-[#1a5b4f]">ROUTE PREVIEW</p>
            <h2 className="mt-1 text-2xl font-black">今日移動草圖</h2>
          </div>

          <div className="grid grid-cols-3 border-2 border-[#183833] bg-[#fffdf7] text-center text-xs font-black">
            <div className="border-r-2 border-[#183833] px-2 py-3">
              <span className="block text-lg">{model.stops.length}</span>
              停留點
            </div>
            <div className="border-r-2 border-[#183833] px-2 py-3">
              <span className="block text-lg">{model.legs.length}</span>
              路段
            </div>
            <div className="px-2 py-3">
              <span className="block text-lg">
                {model.linkedStopCount}/{model.stops.length}
              </span>
              Maps
            </div>
          </div>

          {estimateMessage || isEstimating ? (
            <p className="border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-2 text-xs font-black text-[#53635f]">
              {isEstimating ? "正在估算移動時間..." : estimateMessage}
            </p>
          ) : null}
        </div>

        <div className="relative mt-5 min-h-[300px] flex-1 overflow-hidden border-2 border-[#d8cbb6] bg-[#fbf8f0]">
          <div className="absolute inset-0 opacity-45" style={tilePattern} />
          <div className="absolute left-[8%] right-[8%] top-[22%] border-t-2 border-dashed border-[#cfc2aa]" />
          <div className="absolute left-[8%] right-[8%] top-[54%] border-t-2 border-dashed border-[#cfc2aa]" />
          <div className="absolute bottom-[10%] top-[10%] left-[30%] border-l-2 border-dashed border-[#cfc2aa]" />
          <div className="absolute bottom-[10%] top-[10%] left-[70%] border-l-2 border-dashed border-[#cfc2aa]" />
          <span className="absolute right-4 top-4 grid size-10 place-items-center border-2 border-[#183833] bg-white text-sm font-black">
            N
          </span>

          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 300" role="img" aria-label="行程路線預覽">
            <defs>
              <marker id="route-preview-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                <path d="M0,0 L8,4 L0,8 Z" fill="#1a5b4f" />
              </marker>
            </defs>
            <path
              d="M76 72 C112 62, 148 66, 184 92 S232 140, 206 170 S168 212, 236 244"
              fill="none"
              markerEnd="url(#route-preview-arrow)"
              stroke="#1a5b4f"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="8"
            />
            <path
              d="M184 92 C202 86, 222 90, 240 104"
              fill="none"
              stroke="#d9b75f"
              strokeDasharray="8 8"
              strokeLinecap="round"
              strokeWidth="6"
            />
          </svg>

          {previewStops.map((stop, index) => {
            const position = markerPositions[index];

            return (
              <div
                key={stop.id}
                className="absolute"
                style={{
                  left: position.left,
                  top: position.top,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <span
                  className={`grid size-11 place-items-center border-2 border-[#183833] text-base font-black text-white shadow-[2px_2px_0_#183833] ${
                    stop.hasGoogleMapsUrl ? "bg-[#b43c2f]" : "bg-[#53635f]"
                  }`}
                >
                  {index + 1}
                </span>
                <span
                  className={`absolute top-0 hidden min-w-36 max-w-44 border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-2 shadow-[2px_2px_0_#d8cbb6] sm:block ${
                    index % 2 === 1 ? "right-10" : "left-10"
                  }`}
                >
                  <span className="block truncate text-sm font-black">{stop.title}</span>
                  <span className="mt-1 block whitespace-nowrap text-xs font-black text-[#7c4b32]">
                    {stop.timeLabel}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-3 grid gap-2 sm:hidden">
          {previewStops.map((stop, index) => (
            <div
              key={stop.id}
              className="grid grid-cols-[2rem_1fr] gap-2 border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-2 text-sm"
            >
              <span className="grid size-7 place-items-center border-2 border-[#183833] bg-[#b43c2f] text-xs font-black text-white">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-black">{stop.title}</span>
                <span className="block text-xs font-black text-[#7c4b32]">{stop.timeLabel}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-2">
          {model.legs.length > 0 ? (
            model.legs.map((leg) => (
              <div
                key={leg.id}
                className="grid gap-1 border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-2 text-sm shadow-[2px_2px_0_#d8cbb6]"
              >
                <div className="flex items-center justify-between gap-3 font-black">
                  <span className="min-w-0 truncate">
                    {leg.fromTitle} → {leg.toTitle}
                  </span>
                  <span className={leg.status === "estimated" ? "text-[#1a5b4f]" : "text-[#b43c2f]"}>
                    {getLegStatusLabel(leg)}
                  </span>
                </div>
                {leg.estimatedMinutes ? (
                  <p className="text-xs font-black text-[#7c4b32]">
                    {formatDistanceMeters(leg.distanceMeters)}
                  </p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-3 text-sm font-black text-[#53635f]">
              再新增一個地點，就能形成第一段路線。
            </p>
          )}
        </div>

        {model.googleMapsDirectionsUrl ? (
          <a
            href={model.googleMapsDirectionsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex w-fit border-2 border-[#183833] bg-[#d9b75f] px-4 py-3 text-sm font-black text-[#183833] shadow-[3px_3px_0_#183833] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_#183833]"
          >
            用 Google Maps 開路線
          </a>
        ) : null}
      </div>
    </section>
  );
}
