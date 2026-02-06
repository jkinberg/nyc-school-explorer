import type { SuggestedQuery } from '@/types/chat';
import { GoogleGenAI, Type } from '@google/genai';
import { checkPrefilter } from './prefilter';

/**
 * Gemini Flash-powered contextual suggestion generator.
 * Generates follow-up queries based on conversation context.
 */

const SUGGESTIONS_PROMPT = `You are generating follow-up query suggestions for an NYC school data explorer. Based on the conversation, suggest 3 highly contextual follow-ups.

## The Interaction

**User Query**: {user_query}

**Assistant Response**: {assistant_response}

**Key Entities from Tool Results**:
{entities}

## CRITICAL Requirements

Generate exactly 3 follow-up suggestions that:

1. **Reference SPECIFIC entities** from the conversation:
   - If schools were mentioned, reference them BY NAME (e.g., "Compare P.S. 188 to other Manhattan elementary schools")
   - If a borough was discussed, reference THAT borough (e.g., "Show high-growth schools in Brooklyn")
   - If metrics were shown, suggest exploring THOSE metrics (e.g., "How does teacher attendance correlate with Impact Score?")

2. **Build on the analysis** - don't just repeat the query:
   - If comparing schools → suggest drilling into one school, or expanding comparison
   - If showing a list → suggest filtering, sorting differently, or visualizing
   - If showing correlation → suggest checking causation caveats or other correlations
   - If showing a chart → suggest comparing different filters or metrics

3. **Distribute across categories**:
   - explore: discover new patterns or drill deeper
   - compare: contrast schools, boroughs, or time periods
   - explain: understand methodology or metrics
   - visualize: request charts or visual analysis

4. Keep each suggestion under 80 characters

## Forbidden Suggestions - NEVER generate:
- Rankings: "best schools", "worst schools", "top 10", "schools to avoid"
- Demographic filtering: anything about race/ethnicity percentages
- Deficit framing: "failing schools", "bad schools", "low-performing"
- Generic suggestions that don't reference specific entities from the conversation

## Good Examples (contextual):
- After comparing PS 188 and Stuyvesant: "How does PS 188 compare to similar high-poverty schools?"
- After showing Bronx high-growth schools: "Visualize Impact Score distribution for these Bronx schools"
- After correlation analysis: "What other factors correlate with student attendance?"

## Bad Examples (generic):
- "Show me more schools" (no specific context)
- "Tell me about another borough" (which borough?)
- "Explain the methodology" (not connected to what was discussed)

Return a JSON array of exactly 3 suggestions with text and category.`;

interface GeminiSuggestion {
  text: string;
  category: 'explore' | 'compare' | 'explain' | 'visualize';
}

interface GeminiSuggestionsResponse {
  suggestions: GeminiSuggestion[];
}

/**
 * Extract key entities from tool results for context.
 * Returns a structured summary of schools, boroughs, metrics, etc.
 */
export function extractEntitiesFromToolResults(toolResults: string[]): string {
  const schools: Array<{ name: string; dbn: string; borough?: string }> = [];
  const boroughs = new Set<string>();
  const metrics = new Set<string>();
  const categories = new Set<string>();
  const toolTypes = new Set<string>();
  let comparisonType: string | null = null;

  for (const resultStr of toolResults) {
    try {
      const result = JSON.parse(resultStr);

      // Track what type of analysis was done
      if (result.correlation) {
        toolTypes.add('correlation');
        if (result.correlation.metric1) metrics.add(result.correlation.metric1);
        if (result.correlation.metric2) metrics.add(result.correlation.metric2);
      }
      if (result.chart) {
        toolTypes.add('chart');
        if (result.chart.type) toolTypes.add(`${result.chart.type}_chart`);
      }
      if (result.comparison) {
        toolTypes.add('comparison');
        comparisonType = result.comparison.comparison_type;
      }
      if (result.profile) {
        toolTypes.add('profile');
      }

      // Extract schools from various result structures
      const extractSchools = (items: unknown[]) => {
        for (const item of items) {
          if (item && typeof item === 'object') {
            const school = item as Record<string, unknown>;
            if (school.name && school.dbn) {
              schools.push({
                name: school.name as string,
                dbn: school.dbn as string,
                borough: school.borough as string | undefined,
              });
              if (school.borough) boroughs.add(school.borough as string);
              if (school.category) categories.add(school.category as string);
            }
          }
        }
      };

      // Check common result structures
      if (result.schools && Array.isArray(result.schools)) {
        extractSchools(result.schools);
      }
      if (result.comparison?.schools && Array.isArray(result.comparison.schools)) {
        extractSchools(result.comparison.schools);
      }
      if (result.similar_schools && Array.isArray(result.similar_schools)) {
        extractSchools(result.similar_schools);
      }
      if (result.profile?.school) {
        extractSchools([result.profile.school]);
      }

      // Extract metrics from context
      if (result._context) {
        if (result._context.metrics_available) {
          for (const m of Object.keys(result._context.metrics_available)) {
            metrics.add(m);
          }
        }
      }

      // Extract from chart data
      if (result.chart?.data && Array.isArray(result.chart.data)) {
        extractSchools(result.chart.data);
      }
    } catch {
      // Skip unparseable results
    }
  }

  // Build a structured summary
  const lines: string[] = [];

  if (schools.length > 0) {
    const schoolList = schools
      .slice(0, 5)
      .map(s => `${s.name} (${s.dbn}${s.borough ? `, ${s.borough}` : ''})`)
      .join(', ');
    lines.push(`Schools mentioned: ${schoolList}${schools.length > 5 ? ` and ${schools.length - 5} more` : ''}`);
  }

  if (boroughs.size > 0) {
    lines.push(`Boroughs: ${Array.from(boroughs).join(', ')}`);
  }

  if (categories.size > 0) {
    lines.push(`Categories: ${Array.from(categories).join(', ')}`);
  }

  if (metrics.size > 0) {
    lines.push(`Metrics discussed: ${Array.from(metrics).join(', ')}`);
  }

  if (toolTypes.size > 0) {
    lines.push(`Analysis type: ${Array.from(toolTypes).join(', ')}`);
  }

  if (comparisonType) {
    lines.push(`Comparison type: ${comparisonType}`);
  }

  return lines.length > 0 ? lines.join('\n') : 'No specific entities extracted';
}

/**
 * Validate suggestions against the same block patterns used in prefilter.
 * Filters out any suggestions that would be blocked if sent as user queries.
 */
function validateSuggestions(suggestions: SuggestedQuery[]): SuggestedQuery[] {
  return suggestions.filter(s => {
    const result = checkPrefilter(s.text);
    if (result.blocked) {
      console.warn('Filtered harmful suggestion:', s.text);
      return false;
    }
    return true;
  });
}

/**
 * Generate contextual follow-up suggestions using Gemini Flash.
 *
 * @param userQuery - The user's original query
 * @param assistantResponse - The assistant's response text
 * @param toolResults - Full JSON strings of tool results (for entity extraction)
 * @returns Array of suggested queries, or null on any failure
 */
export async function generateSuggestedQueriesWithLLM(
  userQuery: string,
  assistantResponse: string,
  toolResults: string[]
): Promise<SuggestedQuery[] | null> {
  // Skip if no API key
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Extract entities from tool results for better context
    const entities = extractEntitiesFromToolResults(toolResults);

    // Truncate response but keep more context (4000 chars instead of 2000)
    const truncatedResponse = assistantResponse.slice(0, 4000);

    const prompt = SUGGESTIONS_PROMPT
      .replace('{user_query}', userQuery)
      .replace('{assistant_response}', truncatedResponse)
      .replace('{entities}', entities);

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  category: {
                    type: Type.STRING,
                    enum: ['explore', 'compare', 'explain', 'visualize']
                  },
                },
                required: ['text', 'category'],
              },
            },
          },
          required: ['suggestions'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      return null;
    }

    const result = JSON.parse(text) as GeminiSuggestionsResponse;

    // Validate the result structure
    if (!result.suggestions || !Array.isArray(result.suggestions)) {
      return null;
    }

    // Map to SuggestedQuery type and validate each suggestion
    const suggestions: SuggestedQuery[] = result.suggestions
      .filter(s => s.text && s.category)
      .map(s => ({
        text: s.text.slice(0, 80), // Enforce 80 char limit
        category: s.category,
      }));

    // Layer B: Post-generation validation against prefilter patterns
    const validatedSuggestions = validateSuggestions(suggestions);

    // Return null if all suggestions were filtered out (caller will use fallback)
    if (validatedSuggestions.length === 0) {
      console.warn('All Gemini suggestions filtered out by validation');
      return null;
    }

    return validatedSuggestions.slice(0, 3);
  } catch (error) {
    console.error('Suggestion generation error:', error);
    return null;
  }
}

/**
 * Generate contextual fallback suggestions based on extracted entities.
 * Used when LLM generation fails or times out.
 *
 * @param toolResults - Full JSON strings of tool results
 * @param assistantResponse - The assistant's response text
 * @returns Array of contextual suggestions
 */
export function generateFallbackSuggestions(
  toolResults: string[],
  assistantResponse: string
): SuggestedQuery[] {
  const suggestions: SuggestedQuery[] = [];
  const lowerResponse = assistantResponse.toLowerCase();

  // Extract entities for context
  const schools: Array<{ name: string; dbn: string; borough?: string }> = [];
  const boroughs = new Set<string>();
  let hasComparison = false;
  let hasCorrelation = false;
  let hasChart = false;
  let hasProfile = false;

  for (const resultStr of toolResults) {
    try {
      const result = JSON.parse(resultStr);

      // Track analysis types
      if (result.comparison) hasComparison = true;
      if (result.correlation) hasCorrelation = true;
      if (result.chart) hasChart = true;
      if (result.profile) hasProfile = true;

      // Extract schools
      const extractSchools = (items: unknown[]) => {
        for (const item of items) {
          if (item && typeof item === 'object') {
            const school = item as Record<string, unknown>;
            if (school.name && school.dbn) {
              schools.push({
                name: school.name as string,
                dbn: school.dbn as string,
                borough: school.borough as string | undefined,
              });
              if (school.borough) boroughs.add(school.borough as string);
            }
          }
        }
      };

      if (result.schools) extractSchools(result.schools);
      if (result.comparison?.schools) extractSchools(result.comparison.schools);
      if (result.similar_schools) extractSchools(result.similar_schools);
      if (result.profile?.school) extractSchools([result.profile.school]);
      if (result.chart?.data) extractSchools(result.chart.data);
    } catch {
      // Skip
    }
  }

  const firstSchool = schools[0];
  const firstBorough = boroughs.size > 0 ? Array.from(boroughs)[0] : null;

  // Generate contextual suggestions based on what was analyzed
  if (hasProfile && firstSchool) {
    suggestions.push({
      text: `Compare ${firstSchool.name.slice(0, 30)} to similar schools`,
      category: 'compare'
    });
    suggestions.push({
      text: `Show year-over-year trends for this school`,
      category: 'visualize'
    });
  } else if (hasComparison && schools.length > 0) {
    suggestions.push({
      text: `Visualize these schools' Impact Scores in a chart`,
      category: 'visualize'
    });
    if (firstSchool) {
      suggestions.push({
        text: `Get detailed profile for ${firstSchool.name.slice(0, 35)}`,
        category: 'explore'
      });
    }
  } else if (hasCorrelation) {
    suggestions.push({
      text: `What other factors correlate with student growth?`,
      category: 'explore'
    });
    suggestions.push({
      text: `Visualize this correlation as a scatter plot`,
      category: 'visualize'
    });
  } else if (hasChart && firstBorough) {
    suggestions.push({
      text: `Compare ${firstBorough} to other boroughs`,
      category: 'compare'
    });
    suggestions.push({
      text: `Show only high-growth schools in ${firstBorough}`,
      category: 'explore'
    });
  } else if (schools.length > 0 && firstBorough) {
    suggestions.push({
      text: `Show high-growth schools in ${firstBorough}`,
      category: 'explore'
    });
    if (firstSchool) {
      suggestions.push({
        text: `Find schools similar to ${firstSchool.name.slice(0, 35)}`,
        category: 'compare'
      });
    }
  }

  // Add category-based suggestions if mentioned
  if (lowerResponse.includes('high growth') || lowerResponse.includes('high-growth')) {
    suggestions.push({
      text: 'How many schools maintain high-growth status year-over-year?',
      category: 'explore'
    });
  }

  // Add explanation suggestion if Impact Score was central
  if (lowerResponse.includes('impact score') && suggestions.length < 3) {
    suggestions.push({
      text: 'What does Impact Score measure and how is it calculated?',
      category: 'explain'
    });
  }

  // Fill with semi-contextual defaults if needed
  if (suggestions.length === 0) {
    if (firstBorough) {
      suggestions.push({
        text: `Explore high-growth schools in ${firstBorough}`,
        category: 'explore'
      });
    } else {
      suggestions.push({
        text: 'Show high-growth schools in high-poverty areas',
        category: 'explore'
      });
    }
    suggestions.push({
      text: 'What are the limitations of this data?',
      category: 'explain'
    });
  }

  return suggestions.slice(0, 3);
}
