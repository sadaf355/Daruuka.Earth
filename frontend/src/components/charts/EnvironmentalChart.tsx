import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  type ChartDataset,
} from "chart.js";
import type { ForecastResponse, MetricName, SiteMetricPoint } from "../../types/metrics";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const valueFor = (point: SiteMetricPoint, metric: MetricName) => {
  if (metric === "carbon") return point.carbon_tco2e;
  if (metric === "biodiversity") return point.biodiversity_index;
  return point.ndvi;
};

const labelFor = (metric: MetricName) => metric === "carbon" ? "Carbon sequestration" : metric === "biodiversity" ? "Biodiversity index" : "NDVI";

export function EnvironmentalChart({
  points,
  forecast,
  metric,
  height = 320,
}: {
  points: SiteMetricPoint[];
  forecast?: ForecastResponse | null;
  metric: MetricName;
  height?: number;
}) {
  const historical = points.slice(-90);
  const future = forecast?.forecast ?? [];
  const labels = [
    ...historical.map((p) => new Date(p.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })),
    ...future.map((p) => new Date(p.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })),
  ];
  const actual = historical.map((p) => valueFor(p, metric));
  const nulls = (count: number) => Array<number | null>(count).fill(null);
  const predicted = [...nulls(Math.max(0, historical.length - 1)), actual.at(-1) ?? null, ...future.map((p) => p.value)];
  const lower = [...nulls(Math.max(0, historical.length - 1)), actual.at(-1) ?? null, ...future.map((p) => p.lower)];
  const upper = [...nulls(Math.max(0, historical.length - 1)), actual.at(-1) ?? null, ...future.map((p) => p.upper)];

  const datasets: ChartDataset<"line">[] = [
    {
      label: labelFor(metric),
      data: [...actual, ...nulls(future.length)],
      borderWidth: 2.5,
      tension: 0.32,
      pointRadius: 1.5,
      fill: true,
    },
  ];
  if (forecast) {
    datasets.push(
      { label: "ML forecast", data: predicted, borderWidth: 2, borderDash: [7, 6], tension: 0.32, pointRadius: 2, fill: false },
      { label: "95% upper", data: upper, borderWidth: 0, pointRadius: 0, fill: "+1", backgroundColor: "rgba(34,197,94,.12)", borderColor: "transparent" },
      { label: "95% lower", data: lower, borderWidth: 0, pointRadius: 0, fill: false, borderColor: "transparent" },
    );
  }

  return (
    <div style={{ height }}>
      <Line
        data={{ labels, datasets }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: true, position: "top", align: "end" },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${typeof ctx.parsed.y === "number" ? ctx.parsed.y.toFixed(metric === "ndvi" ? 3 : 1) : "—"}`,
              },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
            y: { grid: { color: "rgba(100,120,110,.10)" } },
          },
        }}
      />
    </div>
  );
}
