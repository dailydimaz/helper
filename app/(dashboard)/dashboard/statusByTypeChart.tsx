import { useMemo } from "react";
import { DateRange } from "react-day-picker";
import { Cell, Label, Pie, PieChart, ResponsiveContainer } from "recharts";
import { timeRangeToQuery } from "@/app/(dashboard)/dashboard/timeRangeSelector";
import LoadingSpinner from "@/components/loadingSpinner";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useDashboardStatusByType } from "@/hooks/use-dashboard";
import { type TimeRange } from "./dashboardContent";

const COLORS = {
  OPEN: "var(--chart-open)",
  CLOSED_MANUAL: "var(--chart-closed-manual)",
  CLOSED_AI: "var(--chart-closed-ai)",
};

const chartConfig = {
  open: {
    label: "Open",
    color: COLORS.OPEN,
  },
  ai: {
    label: "Closed by AI",
    color: COLORS.CLOSED_AI,
  },
  human: {
    label: "Closed manually",
    color: COLORS.CLOSED_MANUAL,
  },
};

interface StatusByTypeChartProps {
  timeRange: TimeRange;
  customDate?: DateRange;
}

export function StatusByTypeChart({ timeRange, customDate }: StatusByTypeChartProps) {
  const { startDate, endDate } = useMemo(() => timeRangeToQuery(timeRange, customDate), [timeRange, customDate]);

  const { statusData: data, isLoading } = useDashboardStatusByType(
    timeRange === "custom" ? "24h" : timeRange,
    startDate,
    endDate
  );

  if (isLoading || !data) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!data.length) {
    return <div className="w-full h-full flex items-center justify-center">No data available.</div>;
  }

  const chartData = data.map(({ type, count }) => ({
    name: type,
    value: count,
    fill: chartConfig[type as keyof typeof chartConfig].color,
  }));

  const totalTickets = chartData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="flex flex-col w-full h-full">
      <div className="relative flex-1 min-h-0">
        <ChartContainer className="w-full h-full" config={chartConfig}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    valueFormatter={(value) => `${value.toLocaleString()} tickets`}
                    labelFormatter={(label) => chartConfig[label as keyof typeof chartConfig]?.label || label}
                    labelClassName="flex items-center gap-2"
                  />
                }
              />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="30%"
                outerRadius="70%"
                startAngle={90}
                endAngle={450}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.fill}
                    className="transition-opacity duration-100 hover:opacity-90 cursor-pointer"
                  />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                            {totalTickets.toLocaleString()}
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-muted-foreground text-sm">
                            Total
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
              <ChartLegend
                content={<ChartLegendContent />}
                verticalAlign="bottom"
                className="text-xs mt-2"
                wrapperStyle={{ paddingTop: "8px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </div>
  );
}
