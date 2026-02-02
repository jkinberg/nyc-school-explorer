'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

// DBN pattern: 2 digits + borough letter (X/M/K/Q/R) + 3 digits
// X=Bronx, M=Manhattan, K=Brooklyn, Q=Queens, R=Staten Island
const DBN_PATTERN = /\b(\d{2}[XMKQR]\d{3})\b/gi;

// School name to DBN mapping for linking
export type SchoolMapping = Map<string, string>;

interface MarkdownRendererProps {
  content: string;
  schoolMappings?: SchoolMapping;
}

// Component to process text and add DBN links and school name links
function TextWithLinks({ children, schoolMappings }: { children: string; schoolMappings?: SchoolMapping }) {
  if (typeof children !== 'string') {
    return <>{children}</>;
  }

  // Build a combined pattern for DBNs and school names
  const patterns: { pattern: RegExp; getLink: (match: string) => string }[] = [];

  // Always include DBN pattern
  patterns.push({
    pattern: DBN_PATTERN,
    getLink: (match: string) => `/school/${match.toUpperCase()}`
  });

  // Add school name patterns if we have mappings
  // Sort by length (longest first) to avoid partial matches
  if (schoolMappings && schoolMappings.size > 0) {
    const sortedNames = Array.from(schoolMappings.keys()).sort((a, b) => b.length - a.length);
    for (const name of sortedNames) {
      const dbn = schoolMappings.get(name);
      if (dbn && name.length > 3) { // Only match names longer than 3 chars
        // Escape special regex characters in school name
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        patterns.push({
          pattern: new RegExp(`\\b${escapedName}\\b`, 'gi'),
          getLink: () => `/school/${dbn}`
        });
      }
    }
  }

  // Find all matches with their positions
  interface Match {
    index: number;
    length: number;
    text: string;
    link: string;
  }

  const matches: Match[] = [];

  for (const { pattern, getLink } of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(children)) !== null) {
      // Check if this position overlaps with an existing match
      const overlaps = matches.some(m =>
        (match!.index >= m.index && match!.index < m.index + m.length) ||
        (m.index >= match!.index && m.index < match!.index + match![0].length)
      );
      if (!overlaps) {
        matches.push({
          index: match.index,
          length: match[0].length,
          text: match[0],
          link: getLink(match[1] || match[0])
        });
      }
    }
  }

  // If no matches, return original text
  if (matches.length === 0) {
    return <>{children}</>;
  }

  // Sort matches by position
  matches.sort((a, b) => a.index - b.index);

  // Build result with links
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of matches) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(children.slice(lastIndex, match.index));
    }

    // Add link - open school profile links in new tab to preserve chat context
    parts.push(
      <a
        key={`${match.link}-${match.index}`}
        href={match.link}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
      >
        {match.text}
      </a>
    );

    lastIndex = match.index + match.length;
  }

  // Add remaining text
  if (lastIndex < children.length) {
    parts.push(children.slice(lastIndex));
  }

  return <>{parts}</>;
}

// Recursively process children to add links
function processChildren(children: React.ReactNode, schoolMappings?: SchoolMapping): React.ReactNode {
  if (typeof children === 'string') {
    return <TextWithLinks schoolMappings={schoolMappings}>{children}</TextWithLinks>;
  }

  if (Array.isArray(children)) {
    return children.map((child, index) => (
      <span key={index}>{processChildren(child, schoolMappings)}</span>
    ));
  }

  return children;
}

// Create custom components factory with schoolMappings
function createComponents(schoolMappings?: SchoolMapping): Components {
  return {
    // Tables with proper styling
    table: ({ children }) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-gray-100 dark:bg-gray-700">
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600">
        {processChildren(children, schoolMappings)}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
        {processChildren(children, schoolMappings)}
      </td>
    ),

    // Lists with proper indentation
    ul: ({ children }) => (
      <ul className="list-disc pl-5 my-2 space-y-1">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-5 my-2 space-y-1">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="text-gray-700 dark:text-gray-300">
        {processChildren(children, schoolMappings)}
      </li>
    ),

    // Code blocks and inline code
    pre: ({ children }) => (
      <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto my-2 text-sm">
        {children}
      </pre>
    ),
    code: ({ children, className }) => {
      // Check if this is an inline code (no language class from code block)
      const isInline = !className;
      if (isInline) {
        return (
          <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">
            {children}
          </code>
        );
      }
      return <code className="font-mono">{children}</code>;
    },

    // Headers - map ## to h3, ### to h4
    h1: ({ children }) => (
      <h2 className="text-xl font-bold mt-6 mb-3 text-gray-900 dark:text-white">
        {processChildren(children, schoolMappings)}
      </h2>
    ),
    h2: ({ children }) => (
      <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-900 dark:text-white">
        {processChildren(children, schoolMappings)}
      </h3>
    ),
    h3: ({ children }) => (
      <h4 className="text-base font-semibold mt-3 mb-1 text-gray-900 dark:text-white">
        {processChildren(children, schoolMappings)}
      </h4>
    ),
    h4: ({ children }) => (
      <h5 className="text-sm font-semibold mt-2 mb-1 text-gray-900 dark:text-white">
        {processChildren(children, schoolMappings)}
      </h5>
    ),

    // Paragraphs with linking
    p: ({ children }) => (
      <p className="my-2 text-gray-700 dark:text-gray-300">
        {processChildren(children, schoolMappings)}
      </p>
    ),

    // Links - open all links in new tab to preserve chat context
    a: ({ href, children }) => {
      // Anchor links stay in same page
      if (href?.startsWith('#')) {
        return (
          <a
            href={href}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
          >
            {children}
          </a>
        );
      }

      // All other links (internal school pages and external) open in new tab
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
        >
          {children}
        </a>
      );
    },

    // Bold and italic
    strong: ({ children }) => (
      <strong className="font-semibold">
        {processChildren(children, schoolMappings)}
      </strong>
    ),
    em: ({ children }) => (
      <em className="italic">
        {processChildren(children, schoolMappings)}
      </em>
    ),

    // Blockquotes
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-2 italic text-gray-600 dark:text-gray-400">
        {children}
      </blockquote>
    ),

    // Horizontal rules
    hr: () => (
      <hr className="my-4 border-gray-200 dark:border-gray-700" />
    ),
  };
}

export function MarkdownRenderer({ content, schoolMappings }: MarkdownRendererProps) {
  const components = createComponents(schoolMappings);

  return (
    <div className="prose dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
