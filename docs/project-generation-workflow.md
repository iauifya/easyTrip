# 新專案產生流程

這份文件用來記錄目前這套產生專案的工作方式。之後開新專案時，可以先複製這份流程，依照階段逐步完成：先定義產品與體驗，再建立技術骨架，接著完成 MVP、驗證品質、整理文件與部署。

## 適用情境

- 從零開始建立一個 Web App、工具型產品或作品集專案。
- 想用 AI 協作快速產出可展示、可測試、可部署的原型。
- 希望每次新專案都有一致的規劃、開發、驗證與交付節奏。

## 核心原則

- 先定義使用者、場景與核心流程，再開始寫程式。
- 第一版先做可用的 MVP，不急著把所有想法都塞進去。
- UI 要符合產品領域，不把工具型 App 做成行銷 Landing Page。
- 每個階段都要留下文件，避免專案長大後只剩程式碼能追。
- 完成功能後一定跑 lint、test、build，再做 demo flow。

## Phase 1：產品定位與範圍

目標：把「要做什麼」和「先不做什麼」講清楚。

Checklist：

- 寫下產品一句話定位。
- 定義目標使用者與主要使用情境。
- 列出 3 到 5 個核心功能。
- 決定 MVP 範圍與非 MVP 範圍。
- 畫出主要 user flow。
- 建立初版 route map。
- 建立 UI state checklist，例如 empty、loading、error、success、editing。

建議產出：

- `README.md` 的產品摘要。
- `PLAN.md` 或 `docs/product-plan.md`。
- MVP checklist。
- Demo flow 草稿。

可用提示詞：

```text
請幫我把這個產品想法整理成 MVP 規格，包含目標使用者、核心情境、功能範圍、非 MVP 範圍、主要 user flow、route map 和 UI state checklist。
```

## Phase 2：技術骨架

目標：建立可以穩定開發的專案基礎。

本專案目前使用的基準技術：

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Zustand
- React Hook Form
- Zod
- Vitest

Checklist：

- 建立 Next.js 專案。
- 設定 TypeScript、ESLint、Tailwind CSS。
- 建立基本資料夾結構。
- 定義 domain types。
- 建立 mock data。
- 建立基本 layout 與首頁入口。
- 建立本地狀態管理或資料存取方式。

建議結構：

```text
src/
  app/
  components/
  data/
  lib/
  store/
  types/
```

如果專案變大，可以再拆：

```text
src/
  app/
  components/
    layout/
    ui/
  features/
  lib/
    storage/
    validation/
  store/
  types/
  data/
```

建議產出：

- 可啟動的 App。
- 初版 domain model。
- 初版 mock data。
- 一個可瀏覽的首頁或主工作區。

## Phase 3：設計語言與 UI 基礎

目標：先定義介面氣質，讓後續功能不會各做各的。

Checklist：

- 定義產品 tone，例如 calm utility、professional dashboard、playful game。
- 決定主要色彩、輔助色、背景色與狀態色。
- 決定 spacing、radius、shadow、border 的使用規則。
- 建立常用 UI 元件，例如 Button、Input、Select、Card、Badge、Modal。
- 規劃 mobile、tablet、desktop 的 RWD 行為。
- 補齊 empty state、error state、loading state。

注意事項：

- 工具型 App 優先清楚、密集、可掃讀。
- 不要一開始做純介紹型 landing page，除非產品本身就是網站首頁。
- 常用操作用圖示按鈕、segmented control、tabs、toggle、slider 等熟悉控制元件。
- 避免把所有內容都包成浮動卡片。

建議產出：

- 初版 visual direction。
- 可重用 UI 元件。
- 主要頁面的 responsive layout。

## Phase 4：MVP 功能實作

目標：把第一條完整使用流程做出來。

Checklist：

- 實作核心資料模型。
- 實作建立資料流程。
- 實作列表、詳情、編輯、刪除。
- 實作主要導航。
- 實作 localStorage、API 或資料庫存取。
- 補齊表單驗證。
- 補齊錯誤與空狀態。

建議順序：

1. 先完成資料模型與 mock data。
2. 建立列表頁。
3. 建立新增流程。
4. 建立詳情頁。
5. 加入編輯與刪除。
6. 接上 localStorage 或後端資料。
7. 補 UI state 與 RWD。

建議產出：

- 可以跑完整 demo 的 MVP。
- 主要 user flow 不需要人工改資料就能操作。
- 重要狀態都有畫面回饋。

## Phase 5：進階功能與整合

目標：加入讓產品更接近真實使用的能力。

Checklist：

- 接第三方 API 或外部服務。
- 設計 API route 或 service layer。
- 加入資料轉換、錯誤處理與 fallback。
- 加入進階 UI，例如 preview、dashboard、today mode、bulk action。
- 加入快取策略或成本控制。
- 補齊測試資料與邊界情境。

建議產出：

- 外部服務整合文件。
- `.env.local` 範例說明。
- API 行為與 fallback 說明。

## Phase 6：測試與品質驗證

目標：確認功能可靠，並讓之後修改不容易壞。

Checklist：

- 為 domain logic 補 Vitest 單元測試。
- 測表單驗證與資料轉換。
- 測 storage adapter 或 API helper。
- 跑 responsive smoke check。
- 跑 lint。
- 跑 test。
- 跑 production build。
- 手動走一次 demo flow。

本專案常用指令：

```bash
npm run lint
npm run test -- --run
npm run build
```

建議產出：

- 測試通過紀錄。
- 已知限制與後續風險。
- 可重現的 demo flow。

## Phase 7：文件、展示與部署

目標：讓專案可以被理解、展示與交付。

Checklist：

- 更新 `README.md`。
- 補 Getting Started。
- 補環境變數說明。
- 補 routes、features、tech stack。
- 補 quality checks。
- 補 deployment steps。
- 補 demo flow。
- 補 roadmap。
- 部署到 Vercel 或指定平台。

README 建議包含：

- Project summary
- Current status
- Core features
- Tech stack
- Routes
- Getting started
- Environment variables
- Quality checks
- Deployment
- Demo flow
- Roadmap

Vercel 部署基本流程：

1. Push repository to GitHub。
2. 在 Vercel import repository。
3. 確認 framework preset。
4. 設定 environment variables。
5. Deploy。
6. 跑線上 demo flow。

## AI 協作建議流程

每個新專案可以照下面節奏跟 AI 協作：

1. 先請 AI 整理產品規格與 MVP 範圍。
2. 請 AI 產生技術架構與資料模型。
3. 請 AI 建立專案骨架與第一個可跑畫面。
4. 每次只交付一條清楚 user flow。
5. 每完成一段功能就要求跑 lint、test、build。
6. UI 完成後要求檢查 mobile 與 desktop。
7. 最後請 AI 整理 README、demo flow 與部署筆記。

建議提示詞：

```text
請依照 docs/project-generation-workflow.md 的流程，協助我建立一個新專案。先從 Phase 1 開始，幫我釐清產品定位、MVP 範圍、user flow、route map 和 UI state checklist。
```

```text
請依照目前專案狀態，檢查 Phase 1 到 Phase 7 哪些已完成、哪些還缺，並列出下一步最適合做的 5 件事。
```

```text
請依照這份流程，把目前專案整理成可交付版本：更新 README、跑品質檢查、補 demo flow，最後列出已知限制與 roadmap。
```

## 新專案啟動檢查表

開新專案時可以直接複製這段：

```text
專案名稱：
一句話定位：
目標使用者：
主要使用情境：
MVP 核心功能：
非 MVP 範圍：
主要 user flow：
Route map：
資料模型：
技術棧：
UI tone：
需要的外部服務：
驗證方式：
部署方式：
Demo flow：
Roadmap：
```

## 完成定義

一個新專案至少達到以下條件，才算完成第一版：

- 可以本機啟動。
- 有一條完整 user flow 可操作。
- 主要畫面支援 mobile 與 desktop。
- `README.md` 能讓別人知道如何啟動與展示。
- `npm run lint` 通過。
- `npm run test -- --run` 通過，或清楚記錄尚未建立測試的原因。
- `npm run build` 通過。
- 已整理 demo flow 和後續 roadmap。
