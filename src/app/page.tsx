'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  TrendingUp,
  Users,
  BookOpen,
  GraduationCap,
  ChevronRight,
  ArrowRight,
  Shield,
  AlertCircle,
  BarChart3
} from 'lucide-react';

const exampleQueries = [
  "Which Bronx elementary schools show the strongest student growth?",
  "Tell me about P.S. 004 Crotona Park West",
  "What high-poverty schools are outperforming expectations?",
];

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleExampleClick = (query: string) => {
    router.push(`/explore?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="bg-white dark:bg-gray-900">
      {/* Hero Section - Lead with the Problem */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-amber-50 dark:from-blue-950 dark:via-gray-900 dark:to-amber-950"></div>
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-100 dark:bg-blue-900 rounded-full blur-3xl opacity-30"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-100 dark:bg-amber-900 rounded-full blur-3xl opacity-30"></div>

        <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-20">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight mb-6">
              What if test scores don&apos;t tell the real story?
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
              NYC school &quot;performance&quot; mostly reflects neighborhood wealth—not teaching quality.
              We built a tool that finds schools actually helping students grow, regardless of where they start.
            </p>

            {/* Search Box */}
            <form onSubmit={handleSearch} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-2 mb-6">
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-3 px-4">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ask anything about NYC schools..."
                    className="flex-1 py-3 text-gray-900 dark:text-white bg-transparent placeholder-gray-400 focus:outline-none text-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors"
                >
                  Explore
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Example Queries */}
            <div className="space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {exampleQueries.map((query, i) => (
                  <button
                    key={i}
                    onClick={() => handleExampleClick(query)}
                    className="text-sm bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-full transition-colors"
                  >
                    &quot;{query.length > 45 ? query.slice(0, 45) + '...' : query}&quot;
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Discovery Highlight - Show Don't Tell */}
      <section className="py-16 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium mb-4">
            <TrendingUp className="w-4 h-4" />
            <span>Featured Discovery</span>
          </div>

          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 md:p-10 text-white">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold mb-4">
                  P.S./M.S. 004 Crotona Park West
                </h2>
                <p className="text-blue-100 mb-6 leading-relaxed">
                  This Bronx school serves a <span className="text-white font-semibold">95% high-poverty population</span> but
                  achieved an Impact Score of <span className="text-white font-semibold">1.18</span>—meaning students grew
                  more than 99% of similar peers citywide. It&apos;s maintained this for two consecutive years.
                </p>
                <Link
                  href="/explore?q=tell+me+about+PS+004+Crotona+Park+West"
                  className="inline-flex items-center gap-2 bg-white text-blue-600 px-5 py-2.5 rounded-lg font-medium hover:bg-blue-50 transition-colors"
                >
                  Explore schools like this
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 backdrop-blur rounded-xl p-5">
                  <div className="text-3xl font-bold mb-1">1.18</div>
                  <div className="text-blue-200 text-sm">Impact Score</div>
                  <div className="text-blue-300 text-xs mt-1">Top 1% citywide</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-5">
                  <div className="text-3xl font-bold mb-1">95%</div>
                  <div className="text-blue-200 text-sm">Economic Need</div>
                  <div className="text-blue-300 text-xs mt-1">High-poverty</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-5">
                  <div className="text-3xl font-bold mb-1">2 yrs</div>
                  <div className="text-blue-200 text-sm">Consecutive</div>
                  <div className="text-blue-300 text-xs mt-1">High growth</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-5">
                  <div className="text-3xl font-bold mb-1">Bronx</div>
                  <div className="text-blue-200 text-sm">District 9</div>
                  <div className="text-blue-300 text-xs mt-1">K-8 School</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* User Paths - Who Is This For */}
      <section className="py-16 bg-gray-50 dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Who is this for?</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Different people need different things from school data. Find your path.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Parents */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors">
                <Users className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">For Parents & Families</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm leading-relaxed">
                Find schools where students thrive—not just schools in wealthy neighborhoods.
                See what&apos;s working for kids like yours.
              </p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-2 mb-6">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
                  Compare schools by student growth
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
                  Find hidden gems in your borough
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
                  Understand what metrics mean
                </li>
              </ul>
              <Link href="/explore" className="text-amber-600 dark:text-amber-400 font-medium text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                Explore for Families
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Journalists */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">For Journalists & Researchers</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm leading-relaxed">
                Investigate patterns, find stories, and understand methodology.
                Full transparency on data sources and limitations.
              </p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-2 mb-6">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                  Analyze correlations with caveats
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                  Year-over-year trend analysis
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                  Full methodology documentation
                </li>
              </ul>
              <Link href="/explore" className="text-blue-600 dark:text-blue-400 font-medium text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                Research Mode
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Educators */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                <GraduationCap className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">For Educators</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm leading-relaxed">
                See how your school compares to similar schools serving similar populations.
                Context that matters, not unfair comparisons.
              </p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-2 mb-6">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                  Compare to similar schools
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                  Track year-over-year progress
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                  Budget and resource context
                </li>
              </ul>
              <Link href="/search" className="text-green-600 dark:text-green-400 font-medium text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                Find Your School
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* The Key Insight - Why This Matters */}
      <section className="py-16 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                The problem with test scores
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                When you look at NYC school &quot;performance,&quot; you&apos;re mostly seeing neighborhood demographics,
                not teaching quality. Schools in wealthier areas score higher—regardless of what happens
                in classrooms.
              </p>
              <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                <strong className="text-gray-900 dark:text-white">Impact Score</strong> measures something different: how much students actually grow
                compared to similar students elsewhere. It&apos;s not perfect, but it better captures what
                schools contribute to learning.
              </p>
              <Link href="/about" className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1 hover:gap-2 transition-all">
                Learn about our methodology
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="space-y-4">
              {/* Performance Score Card */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Performance Score</h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Absolute test results</span>
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <div className="text-3xl font-bold text-red-500">-0.69</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">correlation with poverty</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg">
                  Strongly reflects neighborhood wealth, not teaching
                </div>
              </div>

              {/* Impact Score Card */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Impact Score</h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Student growth</span>
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">-0.29</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">correlation with poverty</div>
                </div>
                <div className="bg-blue-100 dark:bg-blue-800/30 text-blue-700 dark:text-blue-300 text-sm px-3 py-2 rounded-lg">
                  Better captures school contribution to learning
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Transparency */}
      <section className="py-16 bg-gray-50 dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-medium mb-4">
              <Shield className="w-4 h-4" />
              <span>Built Responsibly</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              What makes this different
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              We&apos;re not a school ranking site. We&apos;re a research tool with guardrails.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <AlertCircle className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">No Rankings</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">We don&apos;t rank schools &quot;best to worst&quot; or tell you where to send your kids.</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <BookOpen className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Limitations Included</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Every response includes what the data can and can&apos;t tell you.</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <Shield className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Guardrails Built In</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">The AI won&apos;t help create &quot;schools to avoid&quot; lists or harmful comparisons.</p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <BarChart3 className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Open Methodology</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Full transparency on data sources, calculations, and limitations.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to explore?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-xl mx-auto">
            Discover which NYC schools are making a real difference for students—not just reflecting neighborhood wealth.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/explore"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors"
            >
              <Sparkles className="w-5 h-5" />
              Start with AI
            </Link>
            <Link
              href="/high-growth"
              className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-8 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors"
            >
              Browse High-Growth Schools
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
