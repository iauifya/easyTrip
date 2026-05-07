# EasyTrip 後續執行計畫

## 目標

把 EasyTrip 從 project 定義推進成可展示的前端作品集專案。第一版重點不是功能越多越好，而是做出一個清楚、美觀、真的能幫助時間感較弱與方向感不佳使用者的 MVP。

## 設計方向

依據 frontend-design skill，EasyTrip 的介面不做通用型後台，也不做複雜地圖工具。建議採用：

```text
Tone: soft utility / calm travel companion
```

設計感受：

- 溫暖但不幼稚
- 清楚但不生硬
- 手機優先
- 每個畫面只突出一個主要任務
- 用時間軸和下一站卡片建立安全感
- 避免塞滿資訊，降低旅途中操作壓力

使用者記憶點：

```text
打開 EasyTrip，就知道現在該去哪裡、什麼時候出發、下一步要做什麼。
```

## Phase 1：產品與 UX 規劃

目標：確認 MVP 範圍與主要使用流程。

要完成：

- 定義主要使用情境
- 定義 MVP 功能清單
- 畫出核心 user flow
- 決定第一版頁面路由
- 定義空狀態、錯誤狀態、行程過滿提醒

核心 user flow：

```text
建立旅程
選擇日期與旅遊節奏
新增行程點
查看單日時間軸
進入今日模式
查看下一站與出發提醒
```

產出：

- MVP scope
- user flow
- route map
- UI state checklist

## Phase 2：專案初始化

目標：建立可開發的 Next.js 專案骨架。

建議技術：

```text
Next.js
React
TypeScript
Tailwind CSS
Zustand
React Hook Form
Zod
Vitest
```

要完成：

- 建立 Next.js 專案
- 設定 TypeScript
- 設定 Tailwind CSS
- 建立基礎資料夾結構
- 建立共用型別
- 建立 mock data
- 建立基本 layout

建議資料夾結構：

```text
src/
  app/
  components/
    itinerary/
    places/
    layout/
    ui/
  features/
    trips/
    itinerary/
    today/
  lib/
    time/
    storage/
    validation/
  store/
  types/
  data/
```

產出：

- 可啟動的前端專案
- 首頁與基本 layout
- TypeScript 資料模型

## Phase 3：視覺系統與元件基礎

目標：先做出一致、美觀、可擴充的 UI 基礎。

要完成：

- 定義色彩 token
- 定義字體層級
- 定義 spacing、radius、shadow
- 建立 Button、Input、Select、Card、Badge
- 建立 Empty State、Alert、Modal
- 建立旅遊類型 icon 規則

建議視覺方向：

- 背景：清爽淺色系，不做厚重深色介面
- 主色：清新的藍綠或湖水綠，用於方向與導航感
- 輔色：日光黃或珊瑚橘，用於提醒與出發狀態
- 卡片：乾淨、低陰影、小圓角
- 字體：可讀性優先，標題可以稍微有個性

重要元件：

- 下一站卡片
- 今日進度條
- 單日時間軸
- 行程點卡片
- 行程過滿提醒
- 出發時間提示

產出：

- 基礎 design system
- 可重用 UI components
- 初版視覺語言

## Phase 4：MVP 功能實作

目標：完成第一版可用功能。

要完成：

- 建立旅程
- 編輯旅程基本資料
- 新增行程日
- 新增行程點
- 編輯行程點
- 刪除行程點
- 顯示單日時間軸
- 顯示下一站
- 偵測行程是否太趕
- 使用 localStorage 保存資料

優先順序：

```text
1. 資料模型與 localStorage
2. 建立旅程表單
3. 單日行程時間軸
4. 新增/編輯行程點
5. 下一站卡片
6. 行程太趕提醒
```

產出：

- 可建立並保存旅程
- 可操作單日行程
- 可展示核心產品價值

## Phase 5：今日模式

目標：做出 EasyTrip 的差異化亮點。

要完成：

- 顯示今天的行程
- 根據目前時間判斷目前階段
- 顯示下一站
- 顯示建議出發時間
- 顯示延誤提醒
- 提供簡單的重新安排提示

今日模式畫面重點：

```text
現在狀態
下一站
幾點出發
怎麼去
後面還有哪些行程
```

產出：

- 今日模式頁面
- 下一步導向體驗
- 作品集亮點功能

## Phase 6：測試與品質整理

目標：讓 project 看起來像成熟前端工程師做的作品，而不是只有 demo。

要完成：

- Vitest 測試時間計算
- 測試行程排序
- 測試行程過滿判斷
- 測試 localStorage adapter
- 手機版 RWD 檢查
- 無資料狀態檢查
- 表單錯誤狀態檢查

可延後：

- Playwright E2E
- MSW API mock
- 真實地圖 API

產出：

- 基礎單元測試
- 穩定的 MVP
- 可說明的工程品質

## Phase 7：部署與作品集包裝

目標：讓專案可以被面試官快速理解。

要完成：

- 部署到 Vercel
- 補 README 使用說明
- 補功能截圖
- 補技術亮點
- 補設計決策
- 補未來 Roadmap

作品集說明重點：

- 為特定 TA 設計，不是泛用旅遊工具
- 重視時間感與方向感輔助
- 使用 TypeScript 建立資料模型
- 有表單驗證與狀態管理
- 有可測試的時間計算邏輯
- 手機優先設計

產出：

- 線上 demo
- 完整 README
- 可放進履歷或作品集的專案描述

## 建議執行順序

```text
Step 1: 建立 Next.js 專案
Step 2: 建立資料模型與 mock data
Step 3: 做首頁與旅程列表
Step 4: 做建立旅程表單
Step 5: 做單日時間軸
Step 6: 做新增/編輯行程點
Step 7: 做下一站卡片
Step 8: 做行程過滿提醒
Step 9: 做今日模式
Step 10: 補測試、RWD、部署
```

## 第一個開發任務

下一步建議直接進入：

```text
建立 Next.js + TypeScript + Tailwind CSS 專案骨架
```

第一個任務完成後，project 應該要能：

- 啟動本機 dev server
- 顯示 EasyTrip 首頁
- 有基礎 layout
- 有初步視覺風格
- 有 Trip、TripDay、ItineraryItem、Place 型別
- 有 mock data

