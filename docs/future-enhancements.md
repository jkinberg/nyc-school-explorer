# Future Enhancements

Ideas and potential improvements for NYC School Explorer, organized by category and priority.

## Prioritization Framework

| Priority | Criteria |
|----------|----------|
| **P0 - Critical** | Blocks core functionality or causes user confusion |
| **P1 - High** | Frequently requested, high impact on user experience |
| **P2 - Medium** | Nice to have, improves specific workflows |
| **P3 - Low** | Future consideration, speculative value |

---

## AI Quality & Accuracy

### P1: Improve handling of ambiguous queries
**Problem**: Users ask vague questions like "good schools near me" that require clarification.
**Solution**: Add structured disambiguation flows that ask clarifying questions before querying.
**Signals**: Watch for low evaluation scores on queries with multiple interpretations.

### P1: Add citation/source linking in responses
**Problem**: Users may want to verify claims or explore data sources.
**Solution**: Include links to specific schools, data years, or methodology docs in responses.
**Benefit**: Increases trust and transparency.

### P2: Conversation memory improvements
**Problem**: Multi-turn conversations may lose context (e.g., "show me more like that").
**Solution**: Better tracking of previously discussed schools, filters, and user preferences.
**Signals**: Users repeating context that was already established.

### P2: Proactive limitation acknowledgment
**Problem**: AI sometimes buries caveats at the end of responses.
**Solution**: Surface key limitations upfront when they're critical to interpretation.
**Example**: "Note: Only 2 years of Impact Score data available" before showing trends.

### P3: Multi-language support
**Problem**: NYC has large non-English speaking populations.
**Solution**: Translate responses and accept queries in Spanish, Chinese, etc.
**Complexity**: High - requires careful translation of educational terminology.

---

## Data & Features

### ~~P1: Add school comparison tool~~ ✅ IMPLEMENTED
**Problem**: Users frequently want to compare 2-3 specific schools side-by-side.
**Solution**: `compare_schools` tool that shows metrics in a comparison table/chart.
**Status**: Implemented in `src/lib/mcp/tools/compare-schools.ts`. Supports comparing 2-10 schools by DBN or name, comparison to citywide averages, comparison to similar peers, and filtered comparisons (e.g., "top 5 high-growth Bronx schools"). Includes optional metrics (budget, PTA, suspensions, surveys) and YoY trends.

### P1: Geographic/map-based queries
**Problem**: Users ask about "schools near [address]" or "in my neighborhood".
**Solution**: Add geocoding and distance-based filtering.
**Data needed**: Already have coordinates in school_locations table.
**Example**: "Show high-growth schools within 1 mile of 123 Main St"

### P2: Historical trend analysis
**Problem**: Only 2 years of Impact/Performance data limits trend analysis.
**Solution**: Better visualization and analysis of the metrics we DO have across years.
**Example**: "How has this school's attendance changed over 3 years?"

### P2: Program/specialty search
**Problem**: Users want schools with specific programs (dual language, STEM, arts).
**Solution**: Add program data if available from DOE, or note its absence clearly.
**Current state**: Limited program data; may need additional data source.

### P2: Saved searches / bookmarks
**Problem**: Beta testers may want to save interesting schools or queries.
**Solution**: Local storage or account-based saving of schools and search criteria.
**Complexity**: Medium - requires some state management.

### P3: Peer school recommendations
**Problem**: "What schools are similar to this one?" is common but `find_similar_schools` is basic.
**Solution**: More sophisticated similarity matching (programs, demographics, outcomes).

### P3: Add more DOE data sources
**Potential additions**:
- School survey detailed responses (not just summary scores)
- Admissions/lottery data for screened schools
- Graduation rates and college enrollment (for HS)
- Staff qualifications and turnover

---

## User Experience

### P1: Mobile-responsive chat interface
**Problem**: Current UI may not work well on phones/tablets.
**Solution**: Responsive design improvements for chat, charts, and tables.
**Signals**: Check analytics for mobile traffic percentage.

### ~~P1: Exportable results~~ ✅ PARTIALLY IMPLEMENTED
**Problem**: Users may want to save or share findings.
**Solution**: Export to CSV, PDF, or shareable link.
**Status**: Charts can be exported as PNG (high-resolution, 2x for retina) and CSV (with proper escaping). Response text can be copied to clipboard. PDF export and shareable links not yet implemented.

### ~~P2: Suggested follow-up queries~~ ✅ IMPLEMENTED
**Problem**: Users may not know what questions to ask next.
**Solution**: Show 2-3 contextual follow-up suggestions after each response.
**Status**: Implemented in `src/lib/ai/suggestions.ts`. Uses Gemini Flash with entity extraction from tool results to generate contextual suggestions that reference specific schools, boroughs, and metrics from the conversation. Includes entity-aware fallback when LLM fails.

### P2: Query history
**Problem**: Users can't easily revisit previous questions.
**Solution**: Sidebar or dropdown showing recent queries in session.

### P2: Keyboard shortcuts
**Problem**: Power users want faster navigation.
**Solution**: Cmd+K for new query, arrow keys for history, etc.

### P3: Dark mode improvements
**Problem**: Dark mode may have contrast issues in charts or tables.
**Solution**: Audit and fix dark mode styling throughout.

### P3: Onboarding tour
**Problem**: New users may not understand the tool's capabilities.
**Solution**: Optional guided tour highlighting key features and responsible use.

---

## Responsible AI & Trust

### ~~P1: Explain evaluation scores to users~~ ✅ IMPLEMENTED
**Problem**: Users see confidence badges but may not understand what they mean.
**Solution**: Expandable explanation of what each dimension measures.
**Status**: ConfidenceBadge component shows weighted score with click-to-expand panel displaying individual dimension scores (factual accuracy, context inclusion, limitation acknowledgment, responsible framing, query relevance), summary text, and any flags. Users can copy evaluation details.

### P1: Feedback loop improvements
**Problem**: Flag button exists but feedback could be more structured.
**Solution**: Add categories (inaccurate, biased, confusing, other) to flag modal.
**Benefit**: More actionable feedback for improvements.

### P2: Audit log for researchers
**Problem**: Researchers may want to study how the tool is used and what it recommends.
**Solution**: Optional anonymized logging of query patterns and response types.
**Privacy**: Requires careful design to avoid PII capture.

### P2: Transparency page
**Problem**: Users may want to understand how recommendations are generated.
**Solution**: Public page explaining the AI system, data sources, and limitations.
**Current state**: About page has methodology; could expand on AI specifics.

### P3: Bias detection/monitoring
**Problem**: AI may inadvertently show patterns that correlate with protected characteristics.
**Solution**: Regular audits of recommendations by demographic patterns.
**Complexity**: High - requires careful statistical analysis.

---

## Technical / Operations

### P1: Performance monitoring dashboard
**Problem**: No visibility into response times, error rates, or usage patterns.
**Solution**: Set up Cloud Monitoring dashboards for key metrics.
**Metrics**: P50/P95 latency, error rate, requests/minute, evaluation score distribution.

### P1: Caching for common queries
**Problem**: Repeated similar queries hit the LLM every time.
**Solution**: Cache frequent tool results (e.g., curated lists, citywide stats).
**Benefit**: Faster responses, lower API costs.

### P2: Rate limiting per user (not just IP)
**Problem**: Current rate limiting is IP-based; could be gamed or block shared IPs.
**Solution**: Add session-based or fingerprint-based rate limiting.

### P2: A/B testing framework
**Problem**: Hard to measure impact of prompt changes.
**Solution**: Framework to test different prompts/configurations and compare eval scores.

### P3: Streaming improvements
**Problem**: Long tool calls (charts, large searches) may feel slow.
**Solution**: Show incremental progress indicators during tool execution.

### P3: Offline/degraded mode
**Problem**: If Anthropic API is down, tool is unusable.
**Solution**: Graceful degradation with cached responses or direct DB queries.

---

## Beta Testing Specific

### Immediate focus based on evaluation logs:
1. **Monitor factual_accuracy scores** - Target improvement from 2.17 to 4.0+
2. **Track common query patterns** - What are users actually asking?
3. **Identify confusion points** - Where do users ask follow-ups for clarification?
4. **Note feature requests** - What do users try to do but can't?

### Questions to ask beta testers:
- What were you trying to find out?
- Did the response answer your question?
- Was anything confusing or unexpected?
- What would you want to do next?
- Would you trust this information for [journalism/research/decisions]?

---

## Next Steps

1. **Review evaluation logs weekly** - Look for patterns in low-scoring responses
2. **Prioritize based on frequency** - Most common issues get P1
3. **Quick wins first** - Small prompt changes can have big impact
4. **Document learnings** - Update this doc as patterns emerge

---

## Changelog

| Date | Update |
|------|--------|
| 2026-02-04 | Initial document created based on beta testing launch |
