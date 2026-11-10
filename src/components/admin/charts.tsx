"use client";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNaira } from "@/lib/money";

const RED = "#d30e15";
const ORANGE = "#fbae14";
const INK = "#1c1410";
const GRID = "#ece4dc";

const nairaShort = (kobo: number) => {
  const n = kobo / 100;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `₦${Math.round(n / 1_000)}k`;
  return `₦${n}`;
};

export function SalesTrendChart({ data, unit }: { data: { bucket: string; gross: number; net: number; refunds: number; orders: number }[]; unit: string }) {
  const fmt = (b: string) => (unit === "day" ? new Date(b + "T12:00:00Z").toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : b);
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="bucket" tickFormatter={fmt} tick={{ fontSize: 12, fill: "#7c7068" }} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tickFormatter={nairaShort} tick={{ fontSize: 12, fill: "#7c7068" }} tickLine={false} axisLine={false} width={60} />
        <Tooltip formatter={(v, n) => [formatNaira(Number(v)), n]} labelFormatter={(l) => fmt(String(l))} contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}` }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
        <Line isAnimationActive={false} type="monotone" dataKey="gross" name="Gross paid sales" stroke={RED} strokeWidth={2.5} dot={false} />
        <Line isAnimationActive={false} type="monotone" dataKey="net" name="Net revenue" stroke={INK} strokeWidth={2} dot={false} />
        <Line isAnimationActive={false} type="monotone" dataKey="refunds" name="Refunds" stroke={ORANGE} strokeWidth={2} dot={false} strokeDasharray="4 3" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BranchBars({ data }: { data: { name: string; grossKobo: number; netKobo: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }} barGap={6}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 13, fill: "#4a3f38" }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={nairaShort} tick={{ fontSize: 12, fill: "#7c7068" }} tickLine={false} axisLine={false} width={60} />
        <Tooltip formatter={(v, n) => [formatNaira(Number(v)), n]} contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}` }} cursor={{ fill: "#fff8e8" }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
        <Bar isAnimationActive={false} dataKey="grossKobo" name="Gross paid sales" fill={RED} radius={[6, 6, 0, 0]} maxBarSize={56} />
        <Bar isAnimationActive={false} dataKey="netKobo" name="Net revenue" fill={INK} radius={[6, 6, 0, 0]} maxBarSize={56} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HourlyBars({ data }: { data: { hour: string; orders: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#7c7068" }} tickLine={false} axisLine={false} interval={2} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#7c7068" }} tickLine={false} axisLine={false} />
        <Tooltip formatter={(v) => [String(v), "Paid orders"]} contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}` }} cursor={{ fill: "#fff8e8" }} />
        <Bar isAnimationActive={false} dataKey="orders" fill={ORANGE} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
