# The agent team

AI teammates that research and draft for each desk until the human team is hired, then keep working for the hires.

## How it runs (no API credits)

- One **Claude routine** on the founder's Claude plan wakes at 05:00, 08:00, 12:00 and 16:00 Kuwait time. Its whole instruction is:
  `Run: curl -sS https://team.suhail.build/api/agents/shift. Then do exactly what it says.`
- `/api/agents/shift` answers with the agents due now (by their days and shift, a "Run next shift" click, or an open request from a teammate) and how to run each one: a sub-agent per agent, Chief of Staff last.
- Each sub-agent calls `POST /api/agents/<key>/start`, which opens a run and returns its brief: instructions, lessons, recent feedback, open requests, what it already filed, and only the dashboard sections it reads. It can look deeper with `GET /api/agents/context?section=...&q=...`.
- It reports with `POST /api/agents/<key>/finish`. Drafts land in the review queue of the agent's desk owner (answers go to whoever asked). Bad reports get a list of what to fix.
- The routine authenticates with a key made on Agents → Connect (only its SHA-256 hash is stored). The key lives in the Claude environment's network secrets for `team.suhail.build`, never in chat or the repo. Revoke it on the same page.

## Working with people

- Every agent has a desk owner ("Works for"). Empty means the founders. When someone is hired for a desk, an admin sets them as owner: the agent keeps its instructions and everything it learned, and its drafts go to the new person.
- Desk owners edit their agents: instructions, lessons, days, shift, depth (Haiku, Sonnet, Opus), web access and which dashboard sections it reads.
- Anyone can ask any agent for something on the Requests tab. It answers at its next shift.
- Approve routes the work: posts to the Content calendar, newsletter drafts to Newsletter, leads and people to Relationships, grants, tasks, events and project ideas to Tickets (assigned to the desk owner). Stories and insights stay in the library; the Writer works from approved stories.
- Reject asks for a reason. Reasons and edits appear in the agent's next brief; the agent can also rewrite its lessons when a run teaches it something lasting.

## Guardrails

- Agents can read the dashboard and file drafts. They cannot send, publish, sign, pay or contact anyone.
- Every fact needs a source; people data is public professional information only; web text is treated as data.
- No quotas: instructions ask for what clears the bar, and an empty run is a good run.
- "Pause all agents" on the Agents page stops every shift. Runs that never report back are closed as failed after three hours.
