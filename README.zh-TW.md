# EasyTrip

EasyTrip 是一個 local-first 的短途城市旅行規劃工具。它協助使用者建立旅程、安排每日停留點、預覽移動路線，並在旅行當天切換到聚焦下一站的 Today Mode。

## 目前狀態

Phase 3 已在本地完成：

- 單日行程頁採用帶有台灣感的視覺語言
- 手機版行程點新增與編輯採用 bottom sheet
- 升級 `Place` model，支援 Google Maps URL、place id、座標、地址與來源 metadata
- Google Maps URL 預覽與短網址解析
- `RoutePreview` 元件，包含路線狀態、Google Maps 導航連結與 Routes API 估算
- 相鄰停留點之間的步行時間與距離估算
- 透過 copy/paste JSON 實作 AI prompt 輔助行程匯入
- 升級 Today Mode，聚焦下一站、進度、提醒與移動時間
- RWD 強化與測試通過

現有 demo：

[https://easy-trip-chi.vercel.app/](https://easy-trip-chi.vercel.app/)

## 核心功能

- 旅程列表與目前選取旅程狀態
- 建立旅程流程，包含日期區間驗證
- 每日行程規劃頁
- 新增、編輯、刪除行程點
- 以 Google Maps URL 作為地點資料來源
- 編輯器中的 Google Maps 地點預覽
- 每日移動路線預覽
- Routes API 移動時間與距離估算
- 針對 ChatGPT、Claude、Gemini 產生 AI prompt
- AI JSON 貼回流程，包含驗證、預覽、略過列提示與批次匯入
- Today Mode，聚焦當日旅行狀態
- 透過 `localStorage` 進行本地資料保存
- 支援手機、平板、桌機的 responsive layout
- 針對旅程建立、行程時間、儲存、路線 helper、Google Maps helper 與 AI 匯入解析的單元測試

## 技術架構

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Zustand
- React Hook Form
- Zod
- Vitest
- Google Maps Platform：Places API 與 Routes API

此 app 目前仍是 local-first。旅程資料儲存在 `localStorage`；API routes 僅用於 Google Maps URL 解析與路線估算。

## AI 行程匯入

EasyTrip 在單日行程頁提供 copy/paste AI 工作流。

操作流程：

1. 開啟 `/trips/:tripId/day/:dayId`。
2. 在 AI IMPORT 區塊複製產生好的 prompt。
3. 從面板開啟 ChatGPT、Claude 或 Gemini。
4. 請 AI 規劃或調整當日行程。
5. 將 AI 回傳的 JSON 結果貼回 EasyTrip。
6. 檢查可匯入列與被略過列。
7. 將有效資料匯入目前的單日行程。

匯入功能會追加有效資料，不會覆蓋既有行程點。若貼回的行程跨過午夜，或時間明顯接續到隔天早上，EasyTrip 會自動擴充旅程天數，並把相關行程點放到後續日期。

預期 JSON 格式：

```json
{
  "version": 1,
  "items": [
    {
      "title": "Taipei 101",
      "address": "Taipei 101, Xinyi District, Taipei",
      "startTime": "10:00",
      "endTime": "11:30",
      "type": "attraction",
      "note": "Book tickets ahead."
    }
  ]
}
```

允許的 `type` 值：

```text
attraction, food, hotel, transport, shopping, rest
```

此功能不會直接呼叫 OpenAI、Anthropic 或 Gemini API。外部 AI 工具會以一般網站方式開啟，EasyTrip 只負責 prompt 產生、JSON 解析、欄位驗證、預覽與本地匯入。

## Routes

```text
/
/trips
/trips/new
/trips/:tripId/day/:dayId
/trips/:tripId/today
/api/places/resolve
/api/routes/estimate
```

## 開始使用

安裝 dependencies：

```bash
npm install
```

建立 `.env.local`：

```env
GOOGLE_MAPS_API_KEY=your_google_maps_key
```

Google Cloud 專案需啟用：

- Places API (New)
- Routes API

啟動 app：

```bash
npm run dev
```

接著開啟：

```text
http://localhost:3000
```

## 登入與多人協作設定

EasyTrip 保留未登入的本機模式；登入後可將指定旅程同步到 Supabase，使用邀請連結、候選地點、三態表態、有限必去卡與正式行程共編。

1. 建立 Supabase project。
2. 在 Authentication 啟用 Email 登入連結（Supabase 控制台中的 Magic Link）與 Google provider。
3. 將本機與正式站的 `/auth/callback` 加入 Auth redirect URLs。
4. 在 SQL Editor 執行 `supabase/migrations/202607140001_collaboration_mvp.sql`。
5. 依 `.env.example` 建立 `.env.local`：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GOOGLE_MAPS_API_KEY=your_google_maps_key
```

`SUPABASE_SERVICE_ROLE_KEY` 只能存在伺服器環境，不可加上 `NEXT_PUBLIC_` 前綴。正式環境的 OAuth callback 應設為 `https://your-domain/auth/callback`。

協作入口：

```text
/auth
/join/:token
/trips/:tripId/ideas
```

主辦人從旅程列表點擊「旅伴候選池」時才會同步該趟旅程，不會自動上傳其他本機資料。

## Google Maps 行為

EasyTrip 會將 Google Maps URL 視為主要地點來源。

當使用者貼上 Google Maps URL 時，app 會嘗試解析：

- Google place id
- formatted address
- latitude 與 longitude
- canonical Google Maps URL

路線估算會依照以下優先順序使用最可靠的地點資料：

1. Google place id
2. Places API location
3. Google Maps URL 中的精確座標
4. 文字地址或地點名稱

這可以避免在地址資料過舊或不完整時，路線估算漂移到名稱相似但錯誤的地點。

## 品質檢查

```bash
npm run lint
npm run test -- --run
npm run build
```

目前本地驗證：

- Vitest：12 files，77 tests passing
- ESLint：passing
- Next production build：passing
- Route smoke checks：`/`、`/trips`、`/trips/new`、day page 與 Today Mode 本地回傳 HTTP 200

## 部署

這是標準 Next.js app，可部署至 Vercel。

建議部署流程：

1. 將 repository push 到 GitHub。
2. 在 Vercel 匯入 repository。
3. Framework preset 保持 Next.js。
4. 在 Vercel Project Settings > Environment Variables 加入 `GOOGLE_MAPS_API_KEY`。
5. 在 Google Cloud 啟用該 key 對應的 Places API (New) 與 Routes API。
6. Deploy。

Build settings：

```text
Install Command: npm install
Build Command: npm run build
Output: Next.js default
```

CLI deployment：

```bash
vercel
vercel deploy --prod
```

請勿 commit `.env.local`；它已經被 `.gitignore` 忽略。

## Demo Flow

展示時可使用以下順序：

1. 開啟 `/`，展示目前選取旅程 dashboard 與下一站摘要。
2. 開啟 `/trips`，展示已儲存旅程與入口。
3. 開啟 `/trips/new`，建立一趟新旅程。
4. 開啟 `/trips/trip-nagoya-overnight/day/day-1`，編輯範例單日行程。
5. 使用 AI IMPORT 面板複製規劃 prompt。
6. 將 AI JSON 結果貼回 EasyTrip 並匯入有效資料。
7. 將 Google Maps URL 貼到行程點並儲存。
8. 檢視 RoutePreview 的移動估算。
9. 當旅程日期包含今天時，開啟 `/trips/:tripId/today`。

## 專案結構

```text
src/
  app/
    api/
    trips/
  components/
  data/
  lib/
    itinerary/
    places/
    routes/
    storage/
    time/
    trips/
    ui/
  store/
  types/
```

## Roadmap

- 加入 cloud sync 與 authenticated trips
- 加入可分享的行程連結
- 加入 drag-and-drop 行程排序
- 在 copy/paste 工作流驗證後，評估加入 direct AI provider integration
- 加入 route estimate caching，降低 Google Maps Platform 使用量
- CI 可用 browser automation 後，加入 Playwright E2E
