const fs = require('fs');
const dbPath = process.env.APPDATA + '/mega-agenda/mega-agenda.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const goal = db.roadmapGoals.find(g => g.id === 'mlwmvbd2ugq1kg');
if (!goal) { console.log('Goal not found'); process.exit(1); }

const now = new Date().toISOString();
const r = (topic, type, report) => ({ topic, type, generatedAt: now, report });

goal.topicReports = [
  r("What are the most powerful Claude Code features that most people don't use?", 'question', `Agent Teams: Multiple Claude instances working in parallel with shared task lists and inter-agent messaging. Enable with CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 in settings.json.

Hooks System: 17 hook events (PreToolUse, PostToolUse, SessionStart, Stop, TaskCompleted, etc.) for automation. PreToolUse can block dangerous operations. PostToolUse can auto-format. Stop hooks verify completion.

Git Worktrees: Run multiple Claude sessions on different branches simultaneously. claude -w feature-auth creates isolated worktrees.

Plugins System: 9,000+ plugins available. Install from marketplace: /plugin install context7@claude-plugins-official

Headless/Pipe Mode: claude -p "prompt" runs headless for CI/CD automation. Pipe file contents: cat file.ts | claude -p "review this"

Context Management: /compact frees context space, /context shows usage, /rewind restores checkpoints, --resume picks up where you left off.`),

  r('Best MCP servers for developer productivity beyond Figma', 'question', `Tier 1 (Must-Have):
- Chrome DevTools MCP: Full browser automation, 26 tools. Install: claude mcp add chrome-devtools -- npx chrome-devtools-mcp@latest
- Context7: Injects version-specific library docs into prompts, eliminates hallucinated APIs. Install: claude mcp add context7 -- npx @upstash/context7-mcp@latest
- GitHub MCP: Structured repo interaction beyond gh CLI. Install: claude mcp add github -- npx @modelcontextprotocol/server-github
- Playwright MCP: Cross-browser E2E test automation.

Tier 2:
- Desktop Commander: Filesystem, terminal, app launching
- E2B: Secure cloud sandbox for code execution
- Supabase/PostgreSQL MCP: Schema inspection, query execution
- Slack MCP: Message drafting, channel summaries
- Notion MCP: Read/write pages and databases`),

  r('How do power users structure their Claude Code skills for maximum reuse?', 'question', `Progressive Disclosure: Structure skills with references/ dir (loaded on-demand, zero context tokens until read) and scripts/ dir (deterministic executables).

Frontmatter Optimization: Include trigger terms, keywords users would say, and scope boundaries in description field.

Composability: Multiple focused skills compose better than one large skill. Each skill = single responsibility.

Skill Hierarchy: enterprise > personal > project. Use personal skills (~/.claude/skills/) for cross-project, project skills (.claude/skills/) for project-specific.

Script-Heavy Skills: Move deterministic logic into scripts/ to avoid context token consumption.

Character Budget: With 21+ skills, set SLASH_COMMAND_TOOL_CHAR_BUDGET=32000 to ensure all descriptions stay in context.`),

  r('What are the best agentic coding patterns with Claude (parallel agents, task decomposition)?', 'question', `4 Patterns (lightweight to heavyweight):

1. Subagents: Fire-and-forget workers. Best for focused research, file search, single-file generation.

2. Agent Teams: Full Claude instances with shared task list and messaging. Best for complex multi-file features.
   - Parallel Code Review: Split review by domain (security, performance, tests)
   - Competing Hypotheses: Adversarial debugging
   - Cross-Layer: Frontend/Backend/Testing teammates with file ownership

3. Git Worktrees: Independent features without coordination overhead.

4. Plan Mode: /plan or Shift+Tab for read-only analysis before execution.

Task Decomposition Sweet Spot: 5-6 tasks per teammate, explicit file ownership, TeammateIdle and TaskCompleted hooks for quality gates.`),

  r('How to set up Chrome DevTools MCP for browser automation and testing', 'question', `Install: claude mcp add chrome-devtools --scope user -- npx chrome-devtools-mcp@latest

26 Tools: click, drag, fill, fill_form, hover, press_key, navigate_page, new_page, select_page, wait_for, emulate, resize_page, performance traces, network inspection, evaluate_script, take_screenshot, take_snapshot.

Connect to existing Chrome (for auth): Start Chrome with --remote-debugging-port=9222, then configure --browserUrl=http://127.0.0.1:9222

Key flags: --viewport=1280x720, --headless, --isolated, --categoryPerformance, --categoryNetwork

vs Playwright MCP: Chrome DevTools = debugging + performance profiling. Playwright = cross-browser E2E tests.`),

  r('What can Claude Code hooks automate (pre-commit, post-edit, file-watch)?', 'question', `17 hook events: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest, Notification, SubagentStart/Stop, Stop, TaskCompleted, TeammateIdle, ConfigChange, WorktreeCreate/Remove, PreCompact, SessionEnd.

Hook types: "command" (shell), "prompt" (single-turn LLM via Haiku), "agent" (multi-turn subagent).

Key uses:
- Auto-format on every Edit/Write (PostToolUse)
- Desktop notifications on Windows (Notification hook with PowerShell)
- Re-inject context after compaction (SessionStart with "compact" matcher)
- Verify tests pass before declaring done (Stop hook with agent type)
- Block dangerous commands (PreToolUse returning exit code 2)
- Audit config changes (ConfigChange hook)`),

  r('Best practices for Claude API tool use and function calling in custom apps', 'question', `Tool Runner (beta): Automatically handles tool call loop. Python: @beta_tool decorator. TypeScript: betaZodTool.

Key practices:
- Descriptions are the #1 factor: 3-4+ sentences per tool explaining what, when, parameters, caveats
- strict: true on tool definitions guarantees schema validation
- input_examples for complex inputs (schema-validated, ~20-200 tokens each)
- Parallel tool calling is native to Claude 4 models
- Cache tool definitions with cache_control to reduce token costs
- tool_choice: auto (default), any (force tool use), tool (specific tool), none (prevent)
- Return is_error: true with descriptive messages for error handling`),

  r('How to use Claude for automated code review in CI/CD pipelines', 'question', `Official GitHub Action: anthropics/claude-code-action@v1

Setup: /install-github-app in Claude Code CLI, or manually create .github/workflows/claude.yml

3 Patterns:
1. Comment-triggered (@claude mention in PR comments)
2. Auto-review on PR (triggers on pull_request: [opened, synchronize])
3. Scheduled automation (cron)

Add CLAUDE.md in repo root to guide reviews (coding standards, security rules).

Use Opus for complex reviews, Sonnet for routine ones via claude_args: "--model claude-opus-4-6"

Security: Use secrets for API key, least-privilege permissions, pin action versions by SHA, set --max-turns to cap costs.`),

  r('What are the best prompt engineering techniques for complex multi-step tasks?', 'question', `3 Core Strategies:

1. Chain of Thought: Basic ("think step-by-step"), Guided (outline specific steps), Structured (XML tags <thinking>/<answer>).

2. Prompt Chaining: Break complex tasks into sequential subtasks. Each prompt handles one stage, output feeds to next. Better error isolation, Claude's full attention per subtask.

3. Self-Correction Chains: Generate -> Review -> Refine -> Re-review. Best for high-stakes outputs.

Techniques:
- XML tags for data separation: <system_context>, <user_data>, <instructions>, <output_format>
- Prefill assistant responses to control output format
- Run independent analysis in parallel with Promise.all()
- Extended thinking with budget_tokens for hardest reasoning
- Cache control on system prompts for cost reduction`),

  r('How to reduce Claude API costs while maintaining quality (model routing, caching)?', 'question', `5 Cost Levers (stack multiplicatively):

1. Model Routing (60-80% savings): Haiku for simple tasks, Sonnet for code gen, Opus for complex reasoning only. Use Haiku to classify complexity first.

2. Prompt Caching (90% on cached tokens): Add cache_control: { type: "ephemeral" }. Cache reads cost 10% of base. Place breakpoints on tools, system prompt, and conversation.

3. Batch API (50% flat discount): For non-time-sensitive work. claude.batches.create({...})

4. Batch + 1-hour Cache Combined: Up to 95% savings on prompt-heavy workloads.

5. Token Optimization (10-30%): Shorter prompts, efficient schemas.

Monitor cache hit rates in every response via usage.cache_read_input_tokens.`),

  r("What non-coding tasks can Claude Code handle (research, writing, data analysis, planning)?", 'question', `Research: Multi-source research, competitive analysis, structured reports with citations.

Writing: Blog posts, docs, proposals, email campaigns. Maintains writing style via CLAUDE.md.

Data Analysis: Parse/clean CSV/Excel, statistical analysis, charts. Organized 500-file Drive in 10 minutes.

Planning: PRDs, Jira tickets, sprint plans, retrospectives. Best planning environment due to contextual memory.

File Management: Scan directories, rename files, flag duplicates, batch convert formats.

Claude Cowork (Jan 2026): Visual interface for non-CLI users, same capabilities. Available on Windows as of Feb 10, 2026.`),

  r('How to build autonomous AI agent pipelines that execute specs without manual intervention', 'question', `GitHub Spec Kit: Feature Request -> Specification -> Plan -> Task Breakdown -> Iterative Implementation. Multi-agent roles: Requirements Analyst, Devil's Advocate, Plan Architect, Task Architect.

Claude Code Headless Mode: claude -p "implement the spec at ./specs/feature-x.md" for CI/CD integration.

Agent Teams + Task DAGs: Tasks support directed acyclic graphs where one task blocks another. Async subagents run in background independently.

Pipeline: spec-writer locks spec -> convert to Spec Kit format -> claude -p headless execution -> subagents for implementation/testing/review -> CI/CD security gates -> human review (if authority != auto).`),

  r('Best tools and integrations for Claude Code in 2026 (VS Code, terminal, browser)', 'question', `VS Code Extension (GA): Inline diffs, @-mention files, checkpoints, git integration, multi-agent support. Install from Extensions marketplace.

CLI (Most Powerful): Headless mode, pipe I/O, --allowedTools, Agent Teams, async subagents. Exclusive features not in VS Code.

MCP Servers: GitHub, PostgreSQL, Filesystem, Docker, Brave Search, Memory. Keep under 10 MCPs with under 80 tools active.

Context Warning: Too many tools can shrink context from 200K to 70K. Use MCP Tool Search for lazy loading (95% context savings).`),

  r('How to use Claude for database design, migration planning, and query optimization', 'question', `Connect via MCP: claude mcp add postgres -- npx -y @crystaldba/postgres-mcp "postgresql://readonly_user:pass@localhost/db"

Schema Design: ERD generation in Mermaid.js, normalization analysis, index strategies.

Migration Planning: Generate reversible up/down scripts, validate FK integrity, data backfill scripts. Use Plan Mode first to review.

Query Optimization: Analyze execution plans via EXPLAIN ANALYZE, suggest indexes, rewrite queries. Access pg_stat_statements for real performance data.

Database Optimizer Subagent available at github.com/lst97/claude-code-sub-agents.`),

  r('What security best practices should I follow when using AI coding assistants?', 'question', `25-30% of AI-generated code contains CWEs. Developers using AI feel more confident while producing less secure code.

Top Threats: Slopsquatting (5-22% of package suggestions), prompt injection (hidden instructions in READMEs), secret exfiltration, insecure code generation.

Defenses:
- Add security rules to CLAUDE.md (parameterized queries, no exec/eval on user input, validate inputs)
- Scope tool permissions with --allowedTools
- CI/CD security gates (Semgrep, CodeQL, npm audit)
- Verify packages exist before adding (check download counts, maintainer reputation)
- Never ship AI code without peer review
- Configure .claudeignore for sensitive files
- Including security reminders in prompts improves secure output from 56% to 66%`),

  r('How to build a personal AI-powered development pipeline end to end', 'guidance', `Pipeline: Idea -> /spec-writer -> /planning -> /parallel-agents -> /testing -> /code-review -> /git-workflow -> /self-docs

Wire PostToolUse hooks for instant test feedback on every edit. Set up GitHub Actions with claude-code-action@v1 for PR review.

Install CCPM (Claude Code Project Manager) for GitHub Issues as source of truth + Git worktrees for parallel execution.

Close the loop: /self-docs at end of every run feeds back into memory for next session.

Connect MCP servers for external services (Jira/Linear, Slack, Git provider).`),

  r('How to create a skill that auto-discovers and suggests relevant skills per task', 'guidance', `Claude uses skill description frontmatter for discovery (2% context budget). Quality of descriptions is the #1 lever.

Build a skill-router meta-skill that reads all SKILL.md frontmatter, scores relevance 0-10 per task, and recommends a skill chain with invocation commands.

Modify ask-first (background skill) to include skill suggestions after clarifying requirements.

Set SLASH_COMMAND_TOOL_CHAR_BUDGET=32000 if skills are being excluded due to character limit.

Use project-level skills (.claude/skills/) for project-specific conventions that only load when relevant.`),

  r('How to integrate Claude into my daily non-coding workflow (email, planning, research)', 'guidance', `Claude Cowork (Windows available Feb 10, 2026): Visual interface for file management, research synthesis, document drafting, CSV processing.

Build a daily-plan skill: reads memory/projects.md, recent session summaries, open specs. Outputs Top 3 Priorities, Carry-Over Items, Research Queue.

Connect via MCP: Gmail/Outlook for email, Calendar for schedule, Chrome DevTools for browser automation.

Use mega-agenda as command center connected to Claude via web_search_20250305 API tool.

Build weekly-review skill for status reports with progress metrics and blockers.`),

  r('How to set up automated testing that Claude runs after every code change', 'guidance', `PostToolUse hooks for instant feedback: Run related tests on every Edit/Write via --findRelatedTests.

GitHub Actions for CI: claude-code-action@v1 with prompt "/gen-tests" for auto test generation on PRs.

TaskCompleted hooks: Prevent tasks from being marked done if tests fail (exit code 2).

Quality gate hooks for Agent Teams: TeammateIdle hook checks all assigned tasks complete before going idle.

Track coverage deltas per session in memory for trend analysis.`),

  r('How to use Claude to learn new technologies and frameworks faster', 'guidance', `Claude's Learning Mode uses Socratic method - asks guiding questions instead of giving answers for deeper retention.

Build a learn-tech skill: Assess current knowledge -> research latest docs -> generate learning plan with daily/weekly topics -> hands-on exercises -> knowledge checks.

Build projects with progressive complexity: Start simplest version, add features one at a time, each teaching one new concept.

Use auto-researcher for technology landscape view before diving in. Store milestones to memory for cross-session continuity.`),

  r('How to build a knowledge base that Claude can reference across all projects', 'guidance', `Expand memory taxonomy beyond current 4 files: add contacts.md, technologies.md, snippets.md, archive.md.

CLAUDE.md hierarchy: Global (~/.claude/CLAUDE.md) -> Project (.claude/CLAUDE.md) -> Package (packages/pkg/.claude/CLAUDE.md). Child dirs load on demand.

@import system: CLAUDE.md supports @path/to/import for modular knowledge modules.

Auto-accumulation: Every skill should store findings back to memory (code-review -> patterns.md, debug -> learnings.md, auto-researcher -> learnings.md).

Version control ~/.claude/memory/ with Git for cross-machine sync. Weekly /memory review + prune.`),

  r('How to orchestrate multi-agent workflows for large features', 'guidance', `Two native mechanisms: Subagents (lightweight, report-back) vs Agent Teams (full instances, shared task list, messaging).

Enable Agent Teams: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 in settings.json.

Choose by task: Subagents for quick research/single files. Agent Teams for multi-file features, adversarial debugging, cross-layer implementation.

Structure: Clear scope per teammate, no overlapping file ownership, 5-6 tasks each.

Quality gates: TaskCompleted and TeammateIdle hooks prevent premature completion.

CCPM for feature-level orchestration: Brainstorm -> PRD -> Epic -> Tasks -> Parallel worktree execution.`),

  r('How to use Claude for personal project management and goal tracking', 'guidance', `Maintain ROADMAP.md per project with checkbox tracking. Claude reads this for project state.

Build a goals skill with check/update/report/plan-sprint commands. Reads all ROADMAPs, calculates completion percentages, identifies blocked goals.

Connect mega-agenda to Claude Code via shared JSON/markdown files that both can read/write.

Weekly reviews: Compare planned vs actual (from git log + session summaries). Store variance reports to identify planning blind spots.

Use spec-driven development for any goal taking more than a few hours.`),
];

goal.updatedAt = now;
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log('Saved ' + goal.topicReports.length + ' reports for Claude workflow goal');
