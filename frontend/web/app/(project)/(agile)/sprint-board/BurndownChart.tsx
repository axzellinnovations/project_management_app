"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
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
  day: number;
  remaining: number;
};

export default function BurndownChart({ sprintId }: { sprintId: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
    axios
      .get(`${API_BASE_URL}/api/sprints/${sprintId}/burndown`)
      .then((res) => {
        const formatted = res.data.map((p: BurndownPoint) => ({
          day: `Day ${p.day}`,
          remainingPoints: p.remaining,
        }));
        setData(formatted);
      })
      .catch((err) => console.error("Error:", err));
  }, [sprintId]);

  return (
    <div style={{ width: "100%", height: 400 }}>
      <h2>Burndown Chart</h2>

      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />

          <Line
            type="monotone"
            dataKey="remainingPoints"
            stroke="#8884d8"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}