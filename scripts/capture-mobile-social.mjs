import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const workspace = "C:/Users/sophia_ke/Documents/New project";
const nodePath =
  "C:/Users/sophia_ke/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe";
const edgePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const nextBin = ".\\node_modules\\next\\dist\\bin\\next";
const appPort = 3006;
const cdpPort = 9226;
const width = 390;
const outputDir = join(workspace, "docs/social-assets-mobile");

const todayTrip = {
  id: "trip-taipei-weekend",
  title: "台北週末小旅行",
  destination: "台北",
  startDate: "2026-05-29",
  endDate: "2026-05-29",
  pace: "relaxed",
  days: [
    {
      id: "day-1",
      date: "2026-05-29",
      items: [
        {
          id: "item-station",
          placeId: "place-taipei-main-station",
          type: "transport",
          title: "台北車站寄放行李",
          startTime: "10:00",
          endTime: "10:30",
          stayMinutes: 30,
          note: "先寄放行李，輕裝開始中山到寧夏的步行路線。",
          place: {
            id: "place-taipei-main-station",
            name: "台北車站",
            category: "transport",
            address: "台北市中正區北平西路3號",
            lat: 25.04776,
            lng: 121.51706,
            googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=台北車站",
            source: "google_maps_url",
            averageStayMinutes: 30,
          },
        },
        {
          id: "item-cafe",
          placeId: "place-fika-fika",
          type: "food",
          title: "Fika Fika Cafe",
          startTime: "11:25",
          endTime: "12:30",
          stayMinutes: 65,
          note: "保留一點排隊時間，坐下來喝咖啡再出發。",
          place: {
            id: "place-fika-fika",
            name: "Fika Fika Cafe",
            category: "food",
            address: "台北市中山區伊通街33號",
            lat: 25.05096,
            lng: 121.53423,
            googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Fika%20Fika%20Cafe",
            source: "google_maps_url",
            averageStayMinutes: 65,
          },
        },
        {
          id: "item-museum",
          placeId: "place-moca-taipei",
          type: "attraction",
          title: "台北當代藝術館",
          startTime: "13:10",
          endTime: "15:00",
          stayMinutes: 110,
          note: "展覽與館舍本身都適合慢慢看。",
          place: {
            id: "place-moca-taipei",
            name: "台北當代藝術館",
            category: "attraction",
            address: "台北市大同區長安西路39號",
            lat: 25.05049,
            lng: 121.51897,
            googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=台北當代藝術館",
            source: "google_maps_url",
            averageStayMinutes: 110,
          },
        },
        {
          id: "item-night-market",
          placeId: "place-ningxia-night-market",
          type: "food",
          title: "寧夏夜市",
          startTime: "18:00",
          endTime: "19:30",
          stayMinutes: 90,
          note: "晚餐不用訂餐廳，保留彈性慢慢逛。",
          place: {
            id: "place-ningxia-night-market",
            name: "寧夏夜市",
            category: "food",
            address: "台北市大同區寧夏路",
            lat: 25.05673,
            lng: 121.51539,
            googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=寧夏夜市",
            source: "google_maps_url",
            averageStayMinutes: 90,
          },
        },
      ],
    },
  ],
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep waiting for the server to come up.
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function connectToPage() {
  const response = await fetch(`http://127.0.0.1:${cdpPort}/json/new`, {
    method: "PUT",
  });
  const target = await response.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result);
      }
    }
  });

  return {
    send(method, params = {}) {
      id += 1;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
    },
    close() {
      socket.close();
    },
  };
}

async function navigate(page, url) {
  await page.send("Page.navigate", { url });
  await delay(1800);
}

async function setMobileViewport(page, height) {
  await page.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: true,
  });
}

async function getPageHeight(page) {
  const result = await page.send("Runtime.evaluate", {
    expression:
      "Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, document.documentElement.offsetHeight, document.body.offsetHeight))",
    returnByValue: true,
  });
  return Math.max(844, Math.min(12000, result.result.value ?? 844));
}

async function screenshot(page, filename, { fullPage = true, clipY = 0, clipHeight } = {}) {
  const height = fullPage ? await getPageHeight(page) : clipHeight ?? 844;
  await setMobileViewport(page, fullPage ? height : clipHeight ?? 844);
  await delay(500);

  const result = await page.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    fromSurface: true,
    clip: {
      x: 0,
      y: clipY,
      width,
      height,
      scale: 1,
    },
  });
  await writeFile(join(outputDir, filename), Buffer.from(result.data, "base64"));
}

async function injectTodayTrip(page, baseUrl) {
  await navigate(page, `${baseUrl}/`);
  await page.send("Runtime.evaluate", {
    expression: `
      localStorage.setItem("easytrip.trips.v1", ${JSON.stringify(JSON.stringify([todayTrip]))});
      localStorage.setItem("easytrip.selectedTripId", "trip-taipei-weekend");
      localStorage.setItem("easytrip.selectedDayId", "day-1");
      true;
    `,
    returnByValue: true,
  });
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  await rm(join(workspace, ".tmp-edge-mobile-social"), { recursive: true, force: true });

  const server = spawn(nodePath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    cwd: workspace,
    stdio: "ignore",
    windowsHide: true,
  });

  const edge = spawn(
    edgePath,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${join(workspace, ".tmp-edge-mobile-social")}`,
      `--window-size=${width},844`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );

  try {
    const baseUrl = `http://127.0.0.1:${appPort}`;
    await waitForHttp(`${baseUrl}/`);
    await waitForHttp(`http://127.0.0.1:${cdpPort}/json/version`);

    const page = await connectToPage();
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await setMobileViewport(page, 844);

    await injectTodayTrip(page, baseUrl);

    const shots = [
      ["01-home-mobile-full.png", `${baseUrl}/`],
      ["02-trips-mobile-full.png", `${baseUrl}/trips`],
      ["03-create-trip-mobile-full.png", `${baseUrl}/trips/new`],
      ["04-day-plan-mobile-full.png", `${baseUrl}/trips/trip-taipei-weekend/day/day-1`],
      ["05-today-mode-mobile-full.png", `${baseUrl}/trips/trip-taipei-weekend/today`],
    ];

    for (const [filename, url] of shots) {
      await setMobileViewport(page, 844);
      await navigate(page, url);
      await screenshot(page, filename, { fullPage: true });
    }

    await setMobileViewport(page, 844);
    await navigate(page, `${baseUrl}/trips/trip-taipei-weekend/day/day-1`);
    await screenshot(page, "06-route-preview-mobile-full.png", {
      fullPage: false,
      clipY: 650,
      clipHeight: 1200,
    });

    page.close();
  } finally {
    edge.kill();
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
