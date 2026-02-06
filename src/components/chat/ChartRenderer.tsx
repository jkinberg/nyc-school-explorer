'use client';

import { useRef } from 'react';
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
  ReferenceLine,
  Cell,
} from 'recharts';
import type { ChartData } from '@/types/chat';

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9\s-]/gi, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 50);
}

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

const CHARTER_COLORS: Record<string, string> = {
  '1': '#8B5CF6',    // purple for charter
  'true': '#8B5CF6',
  '0': '#3B82F6',    // blue for traditional public
  'false': '#3B82F6',
};

const CHARTER_LABELS: Record<string, string> = {
  '1': 'Charter',
  'true': 'Charter',
  '0': 'Traditional Public',
  'false': 'Traditional Public',
};

// Colors for diverging bar chart (above/below threshold)
const DIVERGING_COLORS = {
  positive: '#10B981',  // green-500 - above threshold
  negative: '#EF4444',  // red-500 - below threshold
};

export function ChartRenderer({ chart }: ChartRendererProps) {
  const { type, title, xAxis, yAxis, data, colorBy, midpoint } = chart;
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const exportAsPng = async () => {
    const svgElement = chartContainerRef.current?.querySelector('svg');
    if (!svgElement) return;

    // Clone the SVG
    const clone = svgElement.cloneNode(true) as SVGElement;
    const bbox = svgElement.getBoundingClientRect();

    // Set explicit dimensions
    clone.setAttribute('width', String(bbox.width));
    clone.setAttribute('height', String(bbox.height));
    clone.setAttribute('viewBox', `0 0 ${bbox.width} ${bbox.height}`);

    // Inline computed styles for all elements (CSS classes don't transfer)
    const inlineStyles = (original: Element, cloned: Element) => {
      const computedStyle = window.getComputedStyle(original);

      // Key SVG styling properties to inline
      const styleProps = [
        'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity',
        'font-family', 'font-size', 'font-weight', 'text-anchor',
        'dominant-baseline', 'fill-opacity', 'stroke-opacity'
      ];

      const styles: string[] = [];
      for (const prop of styleProps) {
        const value = computedStyle.getPropertyValue(prop);
        if (value && value !== 'none' && value !== '') {
          styles.push(`${prop}:${value}`);
        }
      }

      if (styles.length > 0) {
        const existingStyle = cloned.getAttribute('style') || '';
        cloned.setAttribute('style', existingStyle + styles.join(';'));
      }

      // Recursively process children
      const originalChildren = original.children;
      const clonedChildren = cloned.children;
      for (let i = 0; i < originalChildren.length; i++) {
        if (clonedChildren[i]) {
          inlineStyles(originalChildren[i], clonedChildren[i]);
        }
      }
    };

    inlineStyles(svgElement, clone);

    // Add white background rectangle
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', 'white');
    clone.insertBefore(bgRect, clone.firstChild);

    // Convert to canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(clone);
    const img = new Image();

    img.onload = () => {
      canvas.width = bbox.width * 2; // 2x for retina
      canvas.height = bbox.height * 2;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);

      const link = document.createElement('a');
      link.download = `${sanitizeFilename(title)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.onerror = () => {
      console.error('Failed to load SVG for PNG export');
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const exportAsCsv = () => {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    data.forEach(row => {
      const values = headers.map(h => {
        const val = row[h];
        if (typeof val === 'string') {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val ?? '';
      });
      csvRows.push(values.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const link = document.createElement('a');
    link.download = `${sanitizeFilename(title)}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 my-4 border border-yellow-200 dark:border-yellow-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-yellow-800 dark:text-yellow-200">
          No data matched the specified criteria. Try broadening your filters.
        </p>
      </div>
    );
  }

  // Get color for a data point
  const getColor = (item: Record<string, unknown>): string => {
    if (!colorBy) return '#3B82F6';

    const value = String(item[colorBy]);
    if (colorBy === 'category') return CATEGORY_COLORS[value] || '#6B7280';
    if (colorBy === 'borough') return BOROUGH_COLORS[value] || '#6B7280';
    if (colorBy === 'is_charter') return CHARTER_COLORS[value] || '#6B7280';

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

  // Check if this is histogram data (has 'bin' and 'count' fields)
  const isHistogram = data.length > 0 && 'bin' in data[0] && 'count' in data[0];

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: Record<string, unknown> }[] }) => {
    if (!active || !payload?.length) return null;

    const item = payload[0].payload;

    // Handle histogram data differently
    if (isHistogram) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-medium text-gray-900 dark:text-white">
            {xAxis.label}: {String(item.bin)}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {item.count as number} school{(item.count as number) !== 1 ? 's' : ''}
          </p>
        </div>
      );
    }

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

  // Custom tooltip for diverging bar charts
  const DivergingTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: Record<string, unknown> }[] }) => {
    if (!active || !payload?.length) return null;

    const item = payload[0].payload;
    const deviation = item.deviation as number;
    const direction = item.isPositive ? 'above' : 'below';
    const thresholdValue = midpoint ?? 0;

    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="font-medium text-gray-900 dark:text-white">
          {String(item.name)}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Value: {formatValue(item.value)}
        </p>
        <p className={`text-sm ${item.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {Math.abs(deviation).toFixed(2)} {direction} threshold ({thresholdValue.toFixed(2)})
        </p>
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        <div className="flex gap-1">
          <button
            onClick={exportAsPng}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Download as PNG"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            PNG
          </button>
          <button
            onClick={exportAsCsv}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Download as CSV"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            CSV
          </button>
        </div>
      </div>

      <div className={type === 'diverging_bar' ? 'h-auto min-h-80' : 'h-80'} ref={chartContainerRef}>
        <ResponsiveContainer width="100%" height={type === 'diverging_bar' ? Math.max(320, data.length * 28 + 80) : '100%'}>
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
                    if (colorBy === 'is_charter') {
                      return CHARTER_LABELS[value] || value;
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
          ) : type === 'diverging_bar' ? (
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 20, right: 30, bottom: 40, left: 150 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                type="number"
                label={{ value: yAxis.label, position: 'bottom', offset: 20 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                tick={{ fontSize: 11 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <Tooltip content={<DivergingTooltip />} />
              <ReferenceLine x={0} stroke="#6B7280" strokeWidth={2} />
              <Bar dataKey="deviation" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isPositive ? DIVERGING_COLORS.positive : DIVERGING_COLORS.negative}
                  />
                ))}
              </Bar>
            </BarChart>
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
