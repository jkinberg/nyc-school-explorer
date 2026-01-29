import type { SuggestedQuery } from '@/types/chat';
import { GoogleGenAI, Type } from '@google/genai';
import { checkPrefilter } from './prefilter';

/**
 * Gemini Flash-powered contextual suggestion generator.
 * Generates follow-up queries based on conversation context.
 */

const SUGGESTIONS_PROMPT = `You are generating follow-up query suggestions for an NYC school data explorer. Based on the conversation, suggest 3 contextual follow-ups that encourage deeper investigation.

## The Interaction

**User Query**: {user_query}

**Assistant Response**: {assistant_response}

**Tools Used**: {tools_used}

## Requirements

Generate exactly 3 follow-up suggestions that:
1. Build on the SPECIFIC content discussed (reference actual schools, boroughs, metrics, or patterns from the response)
2. Encourage deeper investigation, not just repetition
3. Distribute across categories: explore (discover patterns), compare (contrast schools/areas), explain (understand methodology), visualize (request charts)
4. Keep each suggestion under 80 characters

## Forbidden Suggestions - NEVER generate these:
- Rankings: "best schools", "worst schools", "top 10", "schools to avoid"
- Demographic filtering: anything about race/ethnicity percentages
- Deficit framing: "failing schools", "bad schools", "low-performing"
- Neighborhood bias: "good neighborhood schools", "safe area schools"
- Causal claims without data: "which schools have the best teachers"

## Always Frame Responsibly:
- Use "high student growth" instead of "best"
- Reference Impact Score, not just Performance Score
- Suggest exploring patterns, not rankings
- Encourage comparative context (vs. citywide, vs. similar schools)

## Output

Return a JSON array of exactly 3 suggestions with text and category.`;

interface GeminiSuggestion {
  text: string;
  category: 'explore' | 'compare' | 'explain' | 'visualize';
}

interface GeminiSuggestionsResponse {
  suggestions: GeminiSuggestion[];
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
 * @param assistantResponse - The assistant's response text (truncated to 2000 chars)
 * @param toolsUsed - Names of tools that were called
 * @returns Array of suggested queries, or null on any failure
 */
export async function generateSuggestedQueriesWithLLM(
  userQuery: string,
  assistantResponse: string,
  toolsUsed: string[]
): Promise<SuggestedQuery[] | null> {
  // Skip if no API key
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Truncate response to keep prompt reasonable (suggestions need less context than evaluation)
    const truncatedResponse = assistantResponse.slice(0, 2000);
    const toolsStr = toolsUsed.length > 0 ? toolsUsed.join(', ') : 'None';

    const prompt = SUGGESTIONS_PROMPT
      .replace('{user_query}', userQuery)
      .replace('{assistant_response}', truncatedResponse)
      .replace('{tools_used}', toolsStr);

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
