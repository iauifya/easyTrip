"use client";

import { useState } from "react";

import { createRoutePreviewModel } from "@/lib/routes/route-preview";
import {
  formatDistanceMeters,
  getRouteTravelMethodIcon,
  getRouteTravelMethodLabel,
  type RouteTravelEstimate,
  type UnavailableRouteLeg,
} from "@/lib/routes/travel-estimates";
import type { ItineraryItem } from "@/types/trip";

const tilePattern = {
  backgroundImage:
    "radial-gradient(circle at 12px 12px, rgba(196, 62, 48, 0.16) 1.5px, transparent 1.5px), radial-gradient(circle at 4px 20px, rgba(12, 65, 96, 0.12) 1px, transparent 1px)",
  backgroundSize: "28px 28px",
};

function getTooltipPlacement(x: number, y: number) {
  const prefersLeft = x > 58;
  const prefersAbove = y > 62;

  return {
    horizontal: prefersLeft ? "left" : "right",
    vertical: prefersAbove ? "above" : "middle",
    textAlign: prefersLeft ? "right" : "left",
  } as const;
}

function getLegStatusLabel(leg: ReturnType<typeof createRoutePreviewModel>["legs"][number]) {
  if (leg.bestEstimate) {
    return `${leg.bestEstimate.estimatedMinutes} 分`;
  }

  if (leg.status === "pending") {
    return "待估算";
  }

  if (leg.status === "invalid_place") {
    return "地址有誤";
  }

  return "待補連結";
}

function getTrafficBurdenLabel(minutes: number) {
  if (minutes >= 90) {
    return "偏重";
  }

  if (minutes >= 45) {
    return "中等";
  }

  return "輕鬆";
}

function InvalidPlaceHelp() {
  return (
    <details className="group relative">
      <summary
        aria-label="查看地址有誤的原因與修正方式"
        className="grid size-6 cursor-pointer list-none place-items-center border-2 border-[#b43c2f] bg-white text-[11px] font-black text-[#b43c2f] marker:hidden [&::-webkit-details-marker]:hidden"
      >
        !
      </summary>
      <div className="absolute right-0 top-8 z-20 w-64 border-2 border-[#183833] bg-[#fffdf7] p-3 text-xs leading-5 text-[#183833] shadow-[4px_4px_0_#d8cbb6]">
        <p className="font-black text-[#b43c2f]">地址有誤，無法估算</p>
        <p className="mt-2 font-bold text-[#53635f]">
          這段路線缺少精準座標或 Google 地點資料，可能只有街名、行政區，或連結解析不到正確地點。
        </p>
        <p className="mt-2 font-bold text-[#53635f]">
          請重新貼上正確的 Google Maps 地點連結，或在名稱欄搜尋並確認預覽地圖指到正確位置。
        </p>
      </div>
    </details>
  );
}

export function RoutePreview({
  estimateMessage,
  estimates = [],
  unavailableLegs = [],
  isEstimating = false,
  items,
}: {
  estimateMessage?: string;
  estimates?: RouteTravelEstimate[];
  unavailableLegs?: UnavailableRouteLeg[];
  isEstimating?: boolean;
  items: ItineraryItem[];
}) {
  const [activeStopId, setActiveStopId] = useState<string | undefined>();
  const model = createRoutePreviewModel(items, estimates, unavailableLegs);
  const previewStops = model.stops;
  const routePoints = previewStops
    .map((stop) => `${(stop.mapPosition.x * 3.6).toFixed(1)},${(stop.mapPosition.y * 3).toFixed(1)}`)
    .join(" ");

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

          <div className="grid grid-cols-3 border-2 border-[#183833] bg-[#fffdf7] text-center text-xs font-black">
            <div className="border-r-2 border-[#183833] px-2 py-3">
              <span className="block text-lg">{model.totalTravelMinutes || "--"}</span>
              交通分鐘
            </div>
            <div className="border-r-2 border-[#183833] px-2 py-3">
              <span className="block text-lg">{getTrafficBurdenLabel(model.totalTravelMinutes)}</span>
              交通負擔
            </div>
            <div className="px-2 py-3">
              <span className="block text-lg">{model.tightLegCount}</span>
              太趕路段
            </div>
          </div>

          {estimateMessage || isEstimating ? (
            <p className="border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-2 text-xs font-black text-[#53635f]">
              {isEstimating ? "正在估算移動時間..." : estimateMessage}
            </p>
          ) : null}

          {model.projectedStopCount >= 2 ? (
            <p className="border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-2 text-xs font-black text-[#1a5b4f]">
              依 {model.projectedStopCount} 個座標繪製，北方在上、東方在右。
            </p>
          ) : (
            <details className="group w-fit">
              <summary className="inline-flex cursor-pointer list-none border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-2 text-xs font-black text-[#7c4b32] shadow-[2px_2px_0_#d8cbb6] marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">路線圖提示</span>
                <span className="hidden group-open:inline">收合提示</span>
              </summary>
              <p className="mt-2 border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-2 text-xs font-black leading-5 text-[#7c4b32] shadow-[2px_2px_0_#d8cbb6]">
                目前以行程順序示意；地址仍可開啟 Google Maps 搜尋。若想讓圖上方位更接近真實位置，請在行程點貼上 Google Maps 分享連結，或用名稱欄搜尋並確認預覽地圖。
              </p>
            </details>
          )}
        </div>

        <div className="relative mt-5 min-h-[360px] flex-1 overflow-hidden border-2 border-[#d8cbb6] bg-[#fbf8f0]">
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
            <polyline
              points={routePoints}
              fill="none"
              markerEnd="url(#route-preview-arrow)"
              stroke={model.projectedStopCount >= 2 ? "#1a5b4f" : "#53635f"}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="6"
            />
          </svg>

          {previewStops.map((stop, index) => {
            const position = stop.mapPosition;
            const placement = getTooltipPlacement(position.x, position.y);
            const isActive = activeStopId === stop.id;

            return (
              <div
                key={stop.id}
                className={`absolute ${isActive ? "z-50" : "z-20"} focus-within:z-50 hover:z-50`}
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <button
                  type="button"
                  aria-expanded={isActive}
                  aria-label={`${stop.title} ${stop.timeLabel}`}
                  onClick={() => setActiveStopId((current) => (current === stop.id ? undefined : stop.id))}
                  className={`peer grid size-11 place-items-center border-2 border-[#183833] text-base font-black text-white shadow-[2px_2px_0_#183833] ${
                    stop.hasGoogleMapsUrl ? "bg-[#b43c2f]" : "bg-[#53635f]"
                  }`}
                >
                  {index + 1}
                </button>
                <span
                  className={`pointer-events-none absolute z-[60] border-2 border-[#d8cbb6] bg-[#fffdf7] px-2.5 py-2 shadow-[2px_2px_0_#d8cbb6] transition sm:opacity-0 sm:peer-focus:opacity-100 sm:peer-hover:opacity-100 ${
                    isActive ? "block" : "hidden sm:block"
                  }`}
                  style={{
                    left: placement.horizontal === "right" ? "3.25rem" : undefined,
                    right: placement.horizontal === "left" ? "3.25rem" : undefined,
                    top: placement.vertical === "middle" ? "-0.25rem" : undefined,
                    bottom: placement.vertical === "above" ? "3.25rem" : undefined,
                    width: "10.5rem",
                    textAlign: placement.textAlign,
                  }}
                >
                  <span className="block truncate text-xs font-black leading-4">{stop.title}</span>
                  <span className="mt-0.5 block whitespace-nowrap text-[11px] font-black leading-4 text-[#7c4b32]">
                    {stop.timeLabel}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid gap-2">
          {model.legs.length > 0 ? (
            model.legs.map((leg) => (
              <div
                key={leg.id}
                className="grid gap-1 border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-2 text-sm shadow-[2px_2px_0_#d8cbb6]"
              >
                <div className="flex items-start justify-between gap-3 font-black">
                  <span className="min-w-0 truncate">
                    {leg.fromTitle} → {leg.toTitle}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={leg.status === "estimated" ? "text-[#1a5b4f]" : "text-[#b43c2f]"}>
                      {getLegStatusLabel(leg)}
                    </span>
                    {leg.status === "invalid_place" ? <InvalidPlaceHelp /> : null}
                  </span>
                </div>
                {leg.estimates.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {leg.estimates.map((estimate) => (
                      <div
                        key={`${leg.id}-${estimate.method}`}
                        className={`border px-2 py-1 text-xs font-black ${
                          leg.bestEstimate?.method === estimate.method
                            ? "border-[#1a5b4f] bg-[#e9efe7] text-[#1a5b4f]"
                            : "border-[#d8cbb6] bg-white text-[#53635f]"
                        }`}
                      >
                        <span className="mr-1 inline-grid size-5 place-items-center border border-current text-[10px]">
                          {getRouteTravelMethodIcon(estimate.method)}
                        </span>
                        {getRouteTravelMethodLabel(estimate.method)} {estimate.estimatedMinutes} 分
                        {typeof estimate.distanceMeters === "number" ? (
                          <span className="mt-1 block text-[11px] text-[#7c4b32]">
                            {formatDistanceMeters(estimate.distanceMeters)}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {leg.isTight ? (
                  <p className="border-2 border-[#d9b75f] bg-[#fff7d8] px-2 py-1 text-xs font-black text-[#6f4e00]">
                    這段移動太趕，建議至少多留 10 分鐘緩衝。
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
