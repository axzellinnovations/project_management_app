"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type BurndownPoint = {
  date: string;
  remainingPoints: number;
  idealPoints: number;
};

export default function BurndownChart({ sprintId }: { sprintId: number }) {
  const [data, setData] = useState<BurndownPoint[]>([]);

  useEffect(() => {
    api
      .get(`/api/burndown/sprint/${sprintId}`)
      .then((res) => {
        const points: BurndownPoint[] = (res.data.dataPoints ?? []).map(
          (p: { date: string; remainingPoints: number; idealPoints: number }) => ({
            date: p.date,
            remainingPoints: p.remainingPoints,
            idealPoints: p.idealPoints,
          })
        );
        setData(points);
      })
      .catch(() => {
        // silently ignore — empty state shown below
      });
  }, [sprintId]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        No burndown data available for this sprint.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: 400 }}>
      <h2 className="text-base font-semibold mb-2">Burndown Chart</h2>

      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />

          <Line
            type="monotone"
            dataKey="remainingPoints"
            name="Actual"
            stroke="#8884d8"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="idealPoints"
            name="Ideal"
            stroke="#98A2B3"
            strokeDasharray="5 5"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
