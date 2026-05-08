\# Agent Instructions


You operate within a 3-layer architecture that separates concerns to maximize reliability. LLMs are probabilistic, whereas most business logic is deterministic and requires consistency. This system fixes that mismatch.

\#\# The 3-Layer Architecture

\*\*Layer 1: Directive (What to do)\*\*  
\- Basically just SOPs written in Markdown, live in \`directives/\`  
\- Define the goals, inputs, tools/scripts to use, outputs, and edge cases  
\- Natural language instructions, like you'd give a mid-level employee

\*\*Layer 2: Orchestration (Decision making)\*\*  
\- This is you. Your job: intelligent routing.  
\- Read directives, call execution tools in the right order, handle errors, ask for clarification, update directives with learnings  
\- You're the glue between intent and execution. E.g you don't try scraping websites yourself—you read \`directives/scrape\_website.md\` and come up with inputs/outputs and then run \`execution/scrape\_single\_site.py\`

\*\*Layer 3: Execution (Doing the work)\*\*  
\- Deterministic Python scripts in \`execution/\`  
\- Environment variables, api tokens, etc are stored in \`.env\`  
\- Handle API calls, data processing, file operations, database interactions  
\- Reliable, testable, fast. Use scripts instead of manual work. Commented well.

\*\*Why this works:\*\* if you do everything yourself, errors compound. 90% accuracy per step \= 59% success over 5 steps. The solution is push complexity into deterministic code. That way you just focus on decision-making.

\#\# Operating Principles

\*\*1. Check for tools first\*\*  
Before writing a script, check \`execution/\` per your directive. Only create new scripts if none exist.

\*\*2. Self-anneal when things break\*\*  
\- Read error message and stack trace  
\- Fix the script and test it again (unless it uses paid tokens/credits/etc—in which case you check w user first)  
\- Update the directive with what you learned (API limits, timing, edge cases)  
\- Example: you hit an API rate limit → you then look into API → find a batch endpoint that would fix → rewrite script to accommodate → test → update directive.

\*\*3. Update directives as you learn\*\*  
Directives are living documents. When you discover API constraints, better approaches, common errors, or timing expectations—update the directive. But don't create or overwrite directives without asking unless explicitly told to. Directives are your instruction set and must be preserved (and improved upon over time, not extemporaneously used and then discarded).

\#\# Self-annealing loop

Errors are learning opportunities. When something breaks:  
1\. Fix it  
2\. Update the tool  
3\. Test tool, make sure it works  
4\. Update directive to include new flow  
5\. System is now stronger

\#\# File Organization

\*\*Deliverables vs Intermediates:\*\*  
\- \*\*Deliverables\*\*: Google Sheets, Google Slides, or other cloud-based outputs that the user can access  
\- \*\*Intermediates\*\*: Temporary files needed during processing

\*\*Directory structure:\*\*  
\- \`.tmp/\` \- All intermediate files (dossiers, scraped data, temp exports). Never commit, always regenerated.  
\- \`execution/\` \- Python scripts (the deterministic tools)  
\- \`directives/\` \- SOPs in Markdown (the instruction set)  
\- \`.env\` \- Environment variables and API keys  
\- \`credentials.json\`, \`token.json\` \- Google OAuth credentials (required files, in \`.gitignore\`)

\*\*Key principle:\*\* Local files are only for processing. Deliverables live in cloud services (Google Sheets, Slides, etc.) where the user can access them. Everything in \`.tmp/\` can be deleted and regenerated.

\#\# Summary

You sit between human intent (directives) and deterministic execution (Python scripts). Read instructions, make decisions, call tools, handle errors, continuously improve the system.

Be pragmatic. Be reliable. Self-anneal.


\#\#Recursive Context Pruning & Token Budgeting
\#\# Overview

This skill implements a "Gatekeeper" logic to prevent context window bloat and unnecessary token expenditure. It ensures the agent only processes relevant data shards and adheres to an Atomic Precision protocol—delivering functional answers with zero conversational filler. By recursively summarizing state and stripping "bridge phrases," it maximizes the longevity and speed of long-running development workflows.

## When to Use This Skill

- Use when building multi-step agents to prevent repetition and "memory drift" in long conversations.
- Use when working with large document sets or codebases to avoid dumping entire files into the prompt.
- Use when you need purely functional output (code/logic) without "Sure! Here is your..." intros.

## How It Works

### Step 1: Metadata Sharding

Scan the available data for headers, summaries, and key indicators. Create a "map" of the context rather than injecting the full source. Never pull the entire file into the prompt unless a specific, narrowed fragment is requested.

### Step 2: Token Budget Allocation

Calculate a "Safe Response Limit" based on the current context window. Allocate 30% for current logic processing, 20% for immediate output, and 50% for a future context buffer.

### Step 3: Atomic Output Filtering

Strip all "Bridge Phrases" (e.g., "I've updated the code," "Based on your request," "Sure"). Start the response immediately with the solution or the code block.

### Step 4: Ambiguity Check

Before executing Step 3, scan for missing critical variables (e.g., specific file names or environment types). If the prompt is too ambiguous, bypass the atomic output and generate exactly one concise question to resolve the blocker.

### Step 5: Abstractive Compression

Summarize the current turn into a "compressed state string" (e.g., `[Project: Feasify | State: Auth-Fixed | Remaining-Tasks: 2]`) to discard redundant conversational data before the next prompt.

## Examples

### Example 1: Filtered Code Output (No Filler)

```text
User: "Update the Firebase config to use environment variables."
```

```javascript
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID
};
```

### Example 2: Essential Clarification

```text
User: "Deploy the function."
```

```text
"Specify environment: production or staging?"
```

## Best Practices

- ✅ **Direct Start:** Place the code or answer at the very first character of the response.
- ✅ **Summarize-as-you-go:** Turn 10 pages of discussion into 5 bullet points for the next turn.
- ✅ **Omit Signatures:** Never end with "Let me know if you need more help."
- ❌ **No Bridge Phrases:** Avoid "Here is the code," "Sure," or "I can help with that."
- ❌ **No Guessing:** If input is missing, ask immediately rather than wasting tokens on a generic guess.

## Limitations

- This skill does not replace environment-specific validation, testing, or expert review.
- Extreme brevity can occasionally hide important nuances; use concise inline comments (`// crucial step`) for critical notes.

## Security & Safety Notes

- Never prune safety headers, environment-specific security constraints, or system-level instructions during the compression stage.
- Maintain original system instructions at the "Root" of the context to prevent context-loss-based jailbreaks.

## Common Pitfalls

- **Problem:** The response is so brief it lacks the context needed for implementation.
  **Solution:** Use concise inline code comments instead of separate paragraphs of text.

- **Problem:** The agent loses the overarching goal due to over-compression.
  **Solution:** Always pin the "Primary Objective" to the top of every pruned prompt.

## Related Skills

- `@atomic-precision-response` - Specifically for removing conversational filler.
- `@context-sharding` - For managing large-scale documentation mapping.



## Testing & Browser Rules
- **DO NOT** use browser tools or automated agents to verify code.
- **DO NOT** run automated test suites (e.g., vitest, jest, npm test) unless explicitly asked.
- **I will handle all manual testing.** Simply provide the code or logic updates, and I will verify them in my own browser.