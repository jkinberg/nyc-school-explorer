'use client';

import { useState, useEffect } from 'react';
import { SchoolCard } from '@/components/schools/SchoolCard';
import { LimitationsBanner } from '@/components/common/LimitationsBanner';

interface School {
  dbn: string;
  name: string;
  borough: string;
  school_type: string;
  impact_score: number | null;
  performance_score: number | null;
  economic_need_index: number | null;
  enrollment: number | null;
  category: string | null;
}

interface SearchResponse {
  schools: School[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

const BOROUGHS = ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'];
const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'high_growth_high_achievement', label: 'Strong Growth + Strong Outcomes' },
  { value: 'high_growth', label: 'Strong Growth, Building Outcomes' },
  { value: 'high_achievement', label: 'Strong Outcomes, Moderate Growth' },
  { value: 'developing', label: 'Developing' },
];
const REPORT_TYPES = [
  { value: '', label: 'All School Types' },
  { value: 'EMS', label: 'Elementary/Middle' },
  { value: 'HS', label: 'High School' },
  { value: 'HST', label: 'Transfer School' },
  { value: 'EC', label: 'Early Childhood' },
  { value: 'D75', label: 'D75' },
];

export default function SearchPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Filters
  const [query, setQuery] = useState('');
  const [borough, setBorough] = useState('');
  const [category, setCategory] = useState('');
  const [reportType, setReportType] = useState('');
  const [minImpact, setMinImpact] = useState('');
  const [offset, setOffset] = useState(0);
  const [searchInput, setSearchInput] = useState('');

  // Fetch schools
  const fetchSchools = async (reset = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (borough) params.set('borough', borough);
      if (category) params.set('category', category);
      if (reportType) params.set('report_type', reportType);
      if (minImpact) params.set('min_impact', minImpact);
      params.set('limit', '24');
      params.set('offset', reset ? '0' : String(offset));

      const response = await fetch(`/api/schools?${params}`);
      const data: SearchResponse = await response.json();

      if (reset) {
        setSchools(data.schools);
        setOffset(24);
      } else {
        setSchools(prev => [...prev, ...data.schools]);
        setOffset(prev => prev + 24);
      }

      setTotalCount(data.pagination.total);
      setHasMore(data.pagination.hasMore);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial load and filter changes
  useEffect(() => {
    fetchSchools(true);
  }, [query, borough, category, reportType, minImpact]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(searchInput);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Search Schools
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Filter NYC schools by location, type, and performance metrics.
        </p>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by school name or DBN..."
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setSearchInput(''); }}
              className="px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Borough
            </label>
            <select
              value={borough}
              onChange={(e) => setBorough(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white"
            >
              <option value="">All Boroughs</option>
              {BOROUGHS.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white"
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              School Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white"
            >
              {REPORT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Min Impact Score
            </label>
            <select
              value={minImpact}
              onChange={(e) => setMinImpact(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white"
            >
              <option value="">Any</option>
              <option value="0.7">0.70+ (Top tier)</option>
              <option value="0.6">0.60+ (High)</option>
              <option value="0.5">0.50+ (Above median)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Limitations Banner */}
      <div className="mb-6">
        <LimitationsBanner compact />
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {loading && schools.length === 0 ? (
          'Loading...'
        ) : (
          <>
            Showing {schools.length} of {totalCount} schools
            {query && <span className="ml-2 text-blue-600 dark:text-blue-400">for &quot;{query}&quot;</span>}
          </>
        )}
      </div>

      {/* Results grid */}
      {schools.length > 0 ? (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schools.map((school) => (
              <SchoolCard key={school.dbn} school={school} />
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={() => fetchSchools(false)}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      ) : !loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No schools found matching your criteria.
        </div>
      ) : null}

      {/* Loading indicator */}
      {loading && schools.length === 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
