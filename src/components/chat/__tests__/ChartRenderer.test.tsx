import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ChartRenderer } from '../ChartRenderer';
import type { ChartData } from '@/types/chat';

// Mock ResizeObserver for Recharts ResponsiveContainer
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.ResizeObserver = ResizeObserverMock;

// Mock getBoundingClientRect for SVG elements
Element.prototype.getBoundingClientRect = vi.fn(() => ({
  width: 400,
  height: 300,
  top: 0,
  left: 0,
  bottom: 300,
  right: 400,
  x: 0,
  y: 0,
  toJSON: () => {},
}));

describe('ChartRenderer Export Functionality', () => {
  const mockContext = {
    sample_size: 100,
    data_year: '2024-25',
    citywide_medians: { impact: 0.5, performance: 0.49, eni: 0.866 },
    limitations: ['Test limitation'],
  };

  const mockBarChartData: ChartData = {
    type: 'bar',
    title: 'Test Chart: Schools by Borough',
    xAxis: { dataKey: 'borough', label: 'Borough' },
    yAxis: { dataKey: 'count', label: 'Number of Schools' },
    data: [
      { borough: 'Manhattan', count: 100 },
      { borough: 'Brooklyn', count: 150 },
      { borough: 'Queens', count: 120 },
    ],
    context: mockContext,
  };

  const mockScatterChartData: ChartData = {
    type: 'scatter',
    title: 'Impact vs Performance',
    xAxis: { dataKey: 'impact_score', label: 'Impact Score' },
    yAxis: { dataKey: 'performance_score', label: 'Performance Score' },
    data: [
      { name: 'School A', impact_score: 0.6, performance_score: 0.5 },
      { name: 'School B', impact_score: 0.7, performance_score: 0.6 },
    ],
    context: mockContext,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders PNG export button', () => {
    render(<ChartRenderer chart={mockBarChartData} />);

    const pngButton = screen.getByTitle('Download as PNG');
    expect(pngButton).toBeInTheDocument();
    expect(pngButton).toHaveTextContent('PNG');
  });

  it('renders CSV export button', () => {
    render(<ChartRenderer chart={mockBarChartData} />);

    const csvButton = screen.getByTitle('Download as CSV');
    expect(csvButton).toBeInTheDocument();
    expect(csvButton).toHaveTextContent('CSV');
  });

  it('displays chart title', () => {
    render(<ChartRenderer chart={mockBarChartData} />);

    expect(screen.getByText('Test Chart: Schools by Borough')).toBeInTheDocument();
  });

  it('shows data count in footer', () => {
    render(<ChartRenderer chart={mockBarChartData} />);

    expect(screen.getByText(/3 schools shown/)).toBeInTheDocument();
  });

  describe('CSV Export', () => {
    let mockLinkClick: ReturnType<typeof vi.fn>;
    let createdLinks: HTMLAnchorElement[];
    let createdBlobs: Array<{ content: BlobPart[]; type: string }>;
    const originalCreateElement = document.createElement.bind(document);

    beforeEach(() => {
      mockLinkClick = vi.fn();
      createdLinks = [];
      createdBlobs = [];

      // Track blob creation by spying on Blob constructor
      const OriginalMockBlob = global.Blob;
      global.Blob = class extends (OriginalMockBlob as unknown as { new (content: BlobPart[], options?: BlobPropertyBag): Blob }) {
        constructor(content: BlobPart[], options?: BlobPropertyBag) {
          super(content, options);
          createdBlobs.push({ content, type: options?.type || '' });
        }
      } as typeof Blob;

      // Override createElement to track anchor elements
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const element = originalCreateElement(tagName);
        if (tagName === 'a') {
          createdLinks.push(element as HTMLAnchorElement);
          element.click = mockLinkClick;
        }
        return element;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('creates CSV file when export button is clicked', () => {
      render(<ChartRenderer chart={mockBarChartData} />);

      const csvButton = screen.getByTitle('Download as CSV');
      fireEvent.click(csvButton);

      // Verify a Blob was created with CSV type
      expect(createdBlobs.length).toBe(1);
      expect(createdBlobs[0].type).toBe('text/csv');
    });

    it('includes header row in CSV', () => {
      render(<ChartRenderer chart={mockBarChartData} />);

      const csvButton = screen.getByTitle('Download as CSV');
      fireEvent.click(csvButton);

      const csvContent = createdBlobs[0].content[0] as string;
      expect(csvContent).toContain('borough,count');
    });

    it('includes data rows in CSV', () => {
      render(<ChartRenderer chart={mockBarChartData} />);

      const csvButton = screen.getByTitle('Download as CSV');
      fireEvent.click(csvButton);

      const csvContent = createdBlobs[0].content[0] as string;
      expect(csvContent).toContain('"Manhattan",100');
      expect(csvContent).toContain('"Brooklyn",150');
      expect(csvContent).toContain('"Queens",120');
    });

    it('properly escapes strings with commas in CSV', () => {
      const chartWithCommas: ChartData = {
        type: 'bar',
        title: 'Test Chart',
        xAxis: { dataKey: 'name', label: 'Name' },
        yAxis: { dataKey: 'value', label: 'Value' },
        data: [
          { name: 'Manhattan, NY', value: 100 },
        ],
        context: mockContext,
      };

      render(<ChartRenderer chart={chartWithCommas} />);

      const csvButton = screen.getByTitle('Download as CSV');
      fireEvent.click(csvButton);

      const csvContent = createdBlobs[0].content[0] as string;
      // String with comma should be quoted
      expect(csvContent).toContain('"Manhattan, NY"');
    });

    it('properly escapes strings with quotes in CSV', () => {
      const chartWithQuotes: ChartData = {
        type: 'bar',
        title: 'Test Chart',
        xAxis: { dataKey: 'name', label: 'Name' },
        yAxis: { dataKey: 'value', label: 'Value' },
        data: [
          { name: 'The "Big Apple"', value: 100 },
        ],
        context: mockContext,
      };

      render(<ChartRenderer chart={chartWithQuotes} />);

      const csvButton = screen.getByTitle('Download as CSV');
      fireEvent.click(csvButton);

      const csvContent = createdBlobs[0].content[0] as string;
      // Quotes should be doubled (standard CSV escaping)
      expect(csvContent).toContain('"The ""Big Apple"""');
    });

    it('uses sanitized chart title for filename', () => {
      const chartWithSpecialChars: ChartData = {
        type: 'bar',
        title: 'Test Chart: 100% of Schools (2024)',
        xAxis: { dataKey: 'name', label: 'Name' },
        yAxis: { dataKey: 'value', label: 'Value' },
        data: [{ name: 'Test', value: 100 }],
        context: mockContext,
      };

      render(<ChartRenderer chart={chartWithSpecialChars} />);

      const csvButton = screen.getByTitle('Download as CSV');
      fireEvent.click(csvButton);

      // Check the download attribute of the created link
      expect(createdLinks.length).toBeGreaterThan(0);
      const link = createdLinks.find(l => l.download.endsWith('.csv'));
      expect(link?.download).toBe('test-chart-100-of-schools-2024.csv');
    });

    it('triggers download when CSV button clicked', () => {
      render(<ChartRenderer chart={mockBarChartData} />);

      const csvButton = screen.getByTitle('Download as CSV');
      fireEvent.click(csvButton);

      expect(mockLinkClick).toHaveBeenCalled();
    });
  });

  describe('PNG Export', () => {
    it('attempts to export when PNG button is clicked', async () => {
      render(<ChartRenderer chart={mockBarChartData} />);

      const pngButton = screen.getByTitle('Download as PNG');

      // This will attempt to find SVG and export - in test environment
      // it may not find the SVG due to Recharts not rendering fully
      await act(async () => {
        fireEvent.click(pngButton);
      });

      // The button should be clickable without error
      expect(pngButton).toBeInTheDocument();
    });
  });

  describe('Empty Data Handling', () => {
    it('shows empty state message when no data', () => {
      const emptyChart: ChartData = {
        type: 'bar',
        title: 'Empty Chart',
        xAxis: { dataKey: 'x', label: 'X' },
        yAxis: { dataKey: 'y', label: 'Y' },
        data: [],
        context: mockContext,
      };

      render(<ChartRenderer chart={emptyChart} />);

      expect(screen.getByText(/No data matched the specified criteria/)).toBeInTheDocument();
    });

    it('does not show export buttons when data is empty', () => {
      const emptyChart: ChartData = {
        type: 'bar',
        title: 'Empty Chart',
        xAxis: { dataKey: 'x', label: 'X' },
        yAxis: { dataKey: 'y', label: 'Y' },
        data: [],
        context: mockContext,
      };

      render(<ChartRenderer chart={emptyChart} />);

      expect(screen.queryByTitle('Download as PNG')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Download as CSV')).not.toBeInTheDocument();
    });
  });

  describe('Scatter Chart', () => {
    it('renders scatter chart with export buttons', () => {
      render(<ChartRenderer chart={mockScatterChartData} />);

      expect(screen.getByTitle('Download as PNG')).toBeInTheDocument();
      expect(screen.getByTitle('Download as CSV')).toBeInTheDocument();
      expect(screen.getByText('Impact vs Performance')).toBeInTheDocument();
    });
  });
});
