import Link from "next/link";
import { sampleTrip } from "@/data/sample-trip";
import { getDayWarnings, getNextStopInsight } from "@/lib/itinerary/day-insights";
import { categoryLabels, paceLabels } from "@/lib/trips/labels";
import { getSortedItems } from "@/lib/time/itinerary";

const day = sampleTrip.days[0];
const items = getSortedItems(day.items);
const nextStop = getNextStopInsight(items, "12:05");
const warnings = getDayWarnings(items, sampleTrip.pace);

const placeNotes = [
  "捷運中山站 2 號出口",
  "巷口騎樓下，午後人潮較多",
  "紅磚立面，適合慢慢逛",
  "入口從民生西路側進去",
];

const windowPattern = {
  backgroundImage:
    "linear-gradient(45deg, rgba(26, 91, 79, 0.08) 25%, transparent 25%), linear-gradient(-45deg, rgba(26, 91, 79, 0.08) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(26, 91, 79, 0.08) 75%), linear-gradient(-45deg, transparent 75%, rgba(26, 91, 79, 0.08) 75%)",
  backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0",
  backgroundSize: "24px 24px",
};

const tilePattern = {
  backgroundImage:
    "radial-gradient(circle at 12px 12px, rgba(196, 62, 48, 0.16) 1.5px, transparent 1.5px), radial-gradient(circle at 4px 20px, rgba(12, 65, 96, 0.12) 1px, transparent 1px)",
  backgroundSize: "28px 28px",
};

export default function PrototypePage() {
  return (
    <main className="min-h-screen bg-[#f6f3ea] text-[#183833]">
      <section className="relative overflow-hidden border-b border-[#d8cbb6] bg-[#fbf8f0]">
        <div className="absolute inset-0 opacity-80" style={windowPattern} />
        <div className="relative mx-auto grid min-h-[88vh] w-full max-w-[88rem] gap-8 px-5 py-6 sm:px-8 lg:grid-cols-[1.18fr_0.82fr] lg:items-start lg:px-10">
          <div className="flex flex-col gap-8">
            <header className="flex flex-col gap-4 border-b-2 border-[#1a5b4f] pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black tracking-[0.24em] text-[#b43c2f]">EASYTRIP 台味原型</p>
                <h1 className="mt-2 text-4xl font-black leading-tight sm:text-6xl">
                  台北週末小旅行
                </h1>
              </div>
              <Link
                href="/"
                className="inline-flex min-h-11 items-center justify-center border-2 border-[#183833] bg-[#183833] px-4 py-2 text-sm font-black text-white shadow-[4px_4px_0_#d9b75f] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_#d9b75f]"
              >
                回正式版
              </Link>
            </header>

            <section className="grid gap-5 lg:grid-cols-[1fr_260px]">
              <div className="border-2 border-[#183833] bg-[#fffdf7] p-5 shadow-[8px_8px_0_#1a5b4f] sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#1a5b4f]">下一站</p>
                    <h2 className="mt-2 text-3xl font-black leading-tight sm:text-5xl">
                      {nextStop.item?.title ?? "今天的行程完成了"}
                    </h2>
                    <p className="mt-4 max-w-2xl text-base leading-8 text-[#53635f]">
                      以老台北街區的票券、窗花與路線章戳做視覺語彙，讓工具不只是乾淨，也有一點在地溫度。
                    </p>
                  </div>
                  <span className="w-fit rotate-[-4deg] border-2 border-[#b43c2f] px-4 py-2 text-sm font-black text-[#b43c2f]">
                    {nextStop.actionLabel}
                  </span>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  {[
                    ["現在", "12:05"],
                    ["節奏", paceLabels[sampleTrip.pace]],
                    ["提醒", `${warnings.length} 則`],
                  ].map(([label, value]) => (
                    <div key={label} className="border-l-4 border-[#d9b75f] bg-[#f1eadb] px-4 py-3">
                      <p className="text-xs font-black tracking-[0.16em] text-[#7c4b32]">{label}</p>
                      <p className="mt-1 text-2xl font-black">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="border-2 border-[#183833] bg-[#0c4160] p-5 text-white shadow-[8px_8px_0_#b43c2f]">
                <p className="text-sm font-black tracking-[0.18em] text-[#f2d179]">今天的旅行票</p>
                <div className="mt-5 border-y-2 border-dashed border-white/45 py-5">
                  <p className="text-5xl font-black">06.13</p>
                  <p className="mt-2 font-bold text-white/75">{sampleTrip.destination} / {items.length} 站</p>
                </div>
                <p className="mt-5 text-sm leading-7 text-white/70">
                  票券樣式可以用在今日模式、分享卡片或行程摘要，形成更鮮明的品牌記憶點。
                </p>
              </aside>
            </section>
          </div>

          <section className="relative min-h-[620px] border-2 border-[#183833] bg-[#e9efe7] p-5 shadow-[6px_6px_0_#d9b75f] sm:p-6">
            <div className="absolute inset-0 opacity-70" style={tilePattern} />
            <div className="relative flex h-full flex-col">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm font-black text-[#1a5b4f]">圖像化路線概念</p>
                  <h2 className="mt-1 text-2xl font-black">中山到寧夏</h2>
                </div>
                <div className="grid gap-2 text-xs font-black text-[#53635f]">
                  <span className="flex items-center gap-2">
                    <i className="h-2 w-7 rounded-full bg-[#1a5b4f]" />
                    綠線：實際路線簡化
                  </span>
                  <span className="flex items-center gap-2">
                    <i className="h-2 w-7 rounded-full bg-[#d9b75f]" />
                    黃標：距離 / 步行時間
                  </span>
                  <span className="flex items-center gap-2">
                    <i className="grid size-5 place-items-center border border-[#183833] bg-[#b43c2f] text-[10px] text-white">1</i>
                    紅章：停留點位置
                  </span>
                </div>
              </div>

              <div className="relative mt-6 min-h-[430px] flex-1 overflow-hidden border-2 border-[#d8cbb6] bg-[#fbf8f0]">
                <div className="absolute inset-0 opacity-45" style={tilePattern} />
                <div className="absolute left-[8%] right-[8%] top-[22%] border-t-2 border-dashed border-[#cfc2aa]" />
                <div className="absolute left-[8%] right-[8%] top-[54%] border-t-2 border-dashed border-[#cfc2aa]" />
                <div className="absolute bottom-[10%] top-[10%] left-[28%] border-l-2 border-dashed border-[#cfc2aa]" />
                <div className="absolute bottom-[10%] top-[10%] left-[68%] border-l-2 border-dashed border-[#cfc2aa]" />
                <span className="absolute left-[10%] top-[17%] bg-[#fbf8f0] px-2 text-xs font-black text-[#7c4b32]">
                  南京西路
                </span>
                <span className="absolute left-[10%] top-[49%] bg-[#fbf8f0] px-2 text-xs font-black text-[#7c4b32]">
                  民生西路
                </span>
                <span className="absolute left-[64%] top-[9%] bg-[#fbf8f0] px-2 text-xs font-black text-[#7c4b32]">
                  承德路
                </span>
                <span className="absolute right-4 top-4 grid size-10 place-items-center border-2 border-[#183833] bg-white text-sm font-black">
                  N
                </span>

                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 360 300"
                  role="img"
                  aria-label="台北中山到寧夏夜市的簡化路線圖"
                >
                  <defs>
                    <marker
                      id="route-arrow"
                      markerHeight="8"
                      markerWidth="8"
                      orient="auto"
                      refX="7"
                      refY="4"
                    >
                      <path d="M0,0 L8,4 L0,8 Z" fill="#1a5b4f" />
                    </marker>
                  </defs>
                  <path
                    d="M76 72 C112 62, 148 66, 184 92 S232 140, 206 170 S168 212, 236 244"
                    fill="none"
                    markerEnd="url(#route-arrow)"
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

                {[
                  { item: items[0], left: "13%", top: "18%", label: "起點" },
                  { item: items[1], left: "52%", top: "24%", label: "750m / 12 分" },
                  { item: items[2], left: "36%", top: "57%", label: "550m / 8 分" },
                  { item: items[3], left: "66%", top: "80%", label: "1.4km / 20 分" },
                ].map(({ item, left, top, label }, index) => (
                  <div
                    key={item.id}
                    className="absolute"
                    style={{
                      left,
                      top,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <span className="grid size-11 place-items-center border-2 border-[#183833] bg-[#b43c2f] text-base font-black text-white shadow-[2px_2px_0_#183833]">
                      {index + 1}
                    </span>
                    <span
                      className={`absolute top-0 min-w-36 border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-2 shadow-[2px_2px_0_#d8cbb6] ${
                        index === 3 ? "right-10" : "left-10"
                      }`}
                    >
                      <span className="block whitespace-nowrap text-sm font-black">{item.title}</span>
                      <span className="mt-1 block whitespace-nowrap text-xs font-black text-[#7c4b32]">{label}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="bg-[#183833] px-5 py-10 text-white sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_380px]">
          <section>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-black tracking-[0.2em] text-[#f2d179]">DAY 1</p>
                <h2 className="mt-1 text-3xl font-black">行程時間軸</h2>
              </div>
              <button className="min-h-11 border-2 border-[#f2d179] px-4 py-2 text-sm font-black text-[#f2d179]">
                + 新增一站
              </button>
            </div>

            <div className="grid gap-4">
              {items.map((item, index) => (
                <article
                  key={item.id}
                  className="grid gap-4 border-2 border-white/20 bg-[#fbf8f0] p-4 text-[#183833] shadow-[6px_6px_0_rgba(255,255,255,0.14)] sm:grid-cols-[92px_1fr_auto]"
                >
                  <div className="border-r-0 border-[#d8cbb6] sm:border-r">
                    <p className="text-sm font-black text-[#b43c2f]">{item.startTime}</p>
                    <p className="text-xs font-bold text-[#53635f]">{item.endTime}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black tracking-[0.14em] text-[#1a5b4f]">
                      {categoryLabels[item.type]} / {placeNotes[index]}
                    </p>
                    <h3 className="mt-1 text-2xl font-black">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#53635f]">
                      {item.note ?? "保留一點空白時間，讓旅程比較像散步，不像趕場。"}
                    </p>
                  </div>
                  <button className="min-h-10 border-2 border-[#183833] px-4 py-2 text-sm font-black">
                    編輯
                  </button>
                </article>
              ))}
            </div>
          </section>

          <aside className="hidden border-2 border-[#f2d179] bg-[#fbf8f0] p-5 text-[#183833] shadow-[8px_8px_0_#b43c2f] lg:block">
            <p className="text-sm font-black text-[#1a5b4f]">桌面版右側編輯</p>
            <h2 className="mt-2 text-3xl font-black">巷口咖啡</h2>
            <div className="mt-5 grid gap-4">
              {["地點名稱", "開始時間", "結束時間", "備註"].map((field) => (
                <label key={field} className="grid gap-2">
                  <span className="text-sm font-black">{field}</span>
                  <span className="min-h-12 border-2 border-[#d8cbb6] bg-white px-3 py-3 text-sm text-[#53635f]">
                    {field === "地點名稱" ? "巷口咖啡" : "點一下即可編輯"}
                  </span>
                </label>
              ))}
            </div>
            <button className="mt-5 min-h-12 w-full border-2 border-[#183833] bg-[#d9b75f] px-4 py-3 text-sm font-black">
              儲存變更
            </button>
          </aside>
        </div>
      </section>

      <section className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-[#183833] bg-[#fbf8f0] p-4 shadow-[0_-10px_30px_rgba(24,56,51,0.2)] lg:hidden">
        <div className="mx-auto max-w-xl">
          <div className="mx-auto mb-3 h-1.5 w-12 bg-[#183833]" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-[#b43c2f]">手機版 BOTTOM SHEET</p>
              <h2 className="mt-1 text-2xl font-black text-[#183833]">編輯巷口咖啡</h2>
            </div>
            <span className="border-2 border-[#d8cbb6] px-3 py-1 text-xs font-black text-[#53635f]">
              12:30
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button className="min-h-11 border-2 border-[#183833] bg-[#d9b75f] px-4 py-2 text-sm font-black text-[#183833]">
              儲存
            </button>
            <button className="min-h-11 border-2 border-[#183833] px-4 py-2 text-sm font-black text-[#183833]">
              取消
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
