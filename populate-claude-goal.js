const fs = require('fs');
const dbPath = process.env.APPDATA + '/mega-agenda/mega-agenda.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const goal = db.roadmapGoals.find(g => g.id === 'mlwmvbd2ugq1kg');

if (!goal) { console.log('Goal not found'); process.exit(1); }

goal.title = 'Improve my Claude workflow and help me figure out how to use it for more things';
goal.description = 'Maximize what I can do with Claude Code - better skills, smarter automation, deeper integrations, and workflows I haven\'t thought of yet.';

goal.research_questions = [
  'What are the most powerful Claude Code features that most people don\'t use?',
  'Best MCP servers for developer productivity beyond Figma',
  'How do power users structure their Claude Code skills for maximum reuse?',
  'What are the best agentic coding patterns with Claude (parallel agents, task decomposition)?',
  'How to set up Chrome DevTools MCP for browser automation and testing',
  'What can Claude Code hooks automate (pre-commit, post-edit, file-watch)?',
  'Best practices for Claude API tool use and function calling in custom apps',
  'How to use Claude for automated code review in CI/CD pipelines',
  'What are the best prompt engineering techniques for complex multi-step tasks?',
  'How to reduce Claude API costs while maintaining quality (model routing, caching)?',
  'What non-coding tasks can Claude Code handle (research, writing, data analysis, planning)?',
  'How to build autonomous AI agent pipelines that execute specs without manual intervention',
  'Best tools and integrations for Claude Code in 2026 (VS Code, terminal, browser)',
  'How to use Claude for database design, migration planning, and query optimization',
  'What security best practices should I follow when using AI coding assistants?',
];

goal.guidance_needed = [
  'How to build a personal AI-powered development pipeline end to end',
  'How to create a skill that auto-discovers and suggests relevant skills per task',
  'How to integrate Claude into my daily non-coding workflow (email, planning, research)',
  'How to set up automated testing that Claude runs after every code change',
  'How to use Claude to learn new technologies and frameworks faster',
  'How to build a knowledge base that Claude can reference across all projects',
  'How to orchestrate multi-agent workflows for large features',
  'How to use Claude for personal project management and goal tracking',
];

goal.topicReports = [];
goal.updatedAt = new Date().toISOString();

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log('Done: ' + goal.research_questions.length + ' questions, ' + goal.guidance_needed.length + ' guidance saved');
