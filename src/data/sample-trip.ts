import type { Trip } from "@/types/trip";

export const sampleTrip: Trip = {
  id: "trip-taipei-weekend",
  title: "台北週末小旅行",
  destination: "台北",
  startDate: "2026-06-13",
  endDate: "2026-06-14",
  pace: "relaxed",
  days: [
    {
      id: "day-1",
      date: "2026-06-13",
      items: [
        {
          id: "item-hotel",
          placeId: "place-hotel",
          type: "hotel",
          title: "飯店寄放行李",
          startTime: "10:00",
          endTime: "10:30",
          stayMinutes: 30,
          note: "櫃台旁邊可以寄放行李。",
        },
        {
          id: "item-cafe",
          placeId: "place-cafe",
          type: "food",
          title: "巷口咖啡",
          startTime: "11:25",
          endTime: "12:30",
          stayMinutes: 65,
          note: "保留 15 分鐘找路和排隊。",
        },
        {
          id: "item-museum",
          placeId: "place-museum",
          type: "attraction",
          title: "當代藝術館",
          startTime: "13:10",
          endTime: "15:00",
          stayMinutes: 110,
        },
        {
          id: "item-night-market",
          placeId: "place-night-market",
          type: "food",
          title: "寧夏夜市",
          startTime: "18:00",
          endTime: "19:30",
          stayMinutes: 90,
          note: "如果下午延誤，這站可以晚一點到。",
        },
      ],
    },
  ],
};

export const sampleTrips: Trip[] = [
  sampleTrip,
  {
    id: "trip-taichung-slow-day",
    title: "台中慢步調一日遊",
    destination: "台中",
    startDate: "2026-07-04",
    endDate: "2026-07-04",
    pace: "normal",
    days: [
      {
        id: "day-taichung-1",
        date: "2026-07-04",
        items: [
          {
            id: "item-train",
            placeId: "place-taichung-station",
            type: "transport",
            title: "台中車站集合",
            startTime: "09:30",
            endTime: "09:50",
            stayMinutes: 20,
            note: "先買水和確認回程票。",
          },
          {
            id: "item-park",
            placeId: "place-calligraphy-greenway",
            type: "attraction",
            title: "草悟道散步",
            startTime: "10:30",
            endTime: "11:40",
            stayMinutes: 70,
          },
          {
            id: "item-lunch",
            placeId: "place-lunch",
            type: "food",
            title: "勤美附近午餐",
            startTime: "12:00",
            endTime: "13:10",
            stayMinutes: 70,
            note: "保留排隊和找店時間。",
          },
        ],
      },
    ],
  },
];
