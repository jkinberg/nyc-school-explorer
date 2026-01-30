'use client';

import {
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { ChartData } from '@/types/chat';

interface ChartRendererProps {
  chart: ChartData;
}

const CATEGORY_COLORS: Record<string, string> = {
  high_growth_high_achievement: '#10B981', // green
  high_growth: '#F59E0B', // amber
  high_achievement: '#8B5CF6', // purple
  developing: '#6B7280', // gray
  below_threshold: '#3B82F6', // blue
};

const CATEGORY_LABELS: Record<string, string> = {
  high_growth_high_achievement: 'Strong Growth + Outcomes',
  high_growth: 'Strong Growth',
  high_achievement: 'Strong Outcomes',
  developing: 'Developing',
  below_threshold: 'Below Threshold',
};

const BOROUGH_COLORS: Record<string, string> = {
  Manhattan: '#EF4444',
  Bronx: '#F59E0B',
  Brooklyn: '#10B981',
  Queens: '#3B82F6',
  'Staten Island': '#8B5CF6',
};

export function ChartRenderer({ chart }: ChartRendererProps) {
  const { type, title, xAxis, yAxis, data, colorBy } = chart;

  // Get color for a data point
  const getColor = (item: Record<string, unknown>): string => {
    if (!colorBy) return '#3B82F6';

    const value = item[colorBy] as string;
    if (colorBy === 'category') return CATEGORY_COLORS[value] || '#6B7280';
    if (colorBy === 'borough') return BOROUGH_COLORS[value] || '#6B7280';
    if (colorBy === 'is_charter') return value ? '#F59E0B' : '#3B82F6';

    return '#3B82F6';
  };

  // Group data by color category for legend
  const groupedData: Record<string, Record<string, unknown>[]> = colorBy
    ? data.reduce<Record<string, Record<string, unknown>[]>>((acc, item) => {
        const key = String(item[colorBy]);
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {})
    : { all: data };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: Record<string, unknown> }[] }) => {
    if (!active || !payload?.length) return null;

    const item = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="font-medium text-gray-900 dark:text-white">
          {String(item.name || item.dbn)}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {xAxis.label}: {formatValue(item[xAxis.dataKey])}
        </p>
        {type === 'scatter' && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {yAxis.label}: {formatValue(item[yAxis.dataKey])}
          </p>
        )}
        {item.economic_need_index !== undefined && (
          <p className="text-sm text-gray-500 dark:text-gray-500">
            ENI: {formatValue(item.economic_need_index)}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 my-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {title}
      </h3>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'scatter' ? (
            <ScatterChart margin={{ top: 40, right: 20, bottom: 50, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey={xAxis.dataKey}
                name={xAxis.label}
                type="number"
                domain={['auto', 'auto']}
                label={{ value: xAxis.label, position: 'bottom', offset: 20 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <YAxis
                dataKey={yAxis.dataKey}
                name={yAxis.label}
                type="number"
                domain={['auto', 'auto']}
                label={{ value: yAxis.label, angle: -90, position: 'left', offset: 40 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <Tooltip content={<CustomTooltip />} />
              {colorBy && (
                <Legend
                  verticalAlign="top"
                  align="center"
                  wrapperStyle={{ paddingBottom: 10 }}
                  formatter={(value: string) => {
                    if (colorBy === 'category') {
                      return CATEGORY_LABELS[value] || value;
                    }
                    return value;
                  }}
                />
              )}
              {Object.entries(groupedData).map(([key, groupData]) => (
                <Scatter
                  key={key}
                  name={key}
                  data={groupData}
                  fill={getColor({ [colorBy || '']: key })}
                  opacity={0.7}
                />
              ))}
            </ScatterChart>
          ) : (
            <BarChart data={data} margin={{ top: 20, right: 20, bottom: 40, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey={xAxis.dataKey}
                label={{ value: xAxis.label, position: 'bottom', offset: 20 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <YAxis
                label={{ value: yAxis.label, angle: -90, position: 'left', offset: 40 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={yAxis.dataKey} fill="#3B82F6" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        {data.length} schools shown. Chart shows patterns but cannot prove causation.
      </p>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (typeof value === 'number') {
    if (value >= 0 && value <= 1) {
      return (value * 100).toFixed(0) + '%';
    }
    return value.toLocaleString();
  }
  return String(value);
}
