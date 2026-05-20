# Handover and Working Agreement

## Parties
- **Product Owner**: the owner of the educational platform business
- **Previous Development Agent / Company**: the team that built the current repository state
- **New Development Agent / Company**: the next AI coding agent or engineering team continuing the work

## Project ownership
The product owner owns the product direction, business rules, and final approval of changes.

## Code ownership
The source code remains the project asset.  
The new agent may modify code only within the approved scope.

## Documentation ownership
The handover documentation is part of the project record and should be maintained as the project evolves.

## Confidentiality
- No secrets, tokens, passwords, or private credentials may be exposed.
- Database values and access keys must stay out of public docs.
- User/student/payment data must be handled as sensitive information.

## No secret exposure
The new agent must:
- read env files only to discover variable names and purposes
- never print secret values into documentation
- never echo credentials into logs or summaries

## Change request process
1. Inspect current implementation first.
2. Confirm the change will not break an existing workflow.
3. Make the smallest safe modification.
4. Validate the affected flow.
5. Summarize clearly what changed and what remains open.

## Acceptance criteria
A change is acceptable only if:
- it matches the product owner’s scope
- it does not break visible working flows
- it preserves the platform’s visual identity unless redesign is explicitly requested
- it is documented if it affects behavior or setup

## Definition of Done
- Code changes are complete
- Relevant flows are tested
- Documentation is updated
- No secrets are leaked
- The next engineer can continue without re-discovering the same facts

## Strict Batch Completion Rule
This rule is mandatory from 2026-05-14 onward.

No development batch may be described as complete unless all of the following are true:
- The touched feature is finished end-to-end, not partially improved.
- The exact affected user roles were tested or the missing role session is documented clearly.
- Relevant smoke/type/build checks passed.
- Frontend changes were visually checked in the in-app browser.
- Production was checked on `https://almeaacodax.vercel.app/` after pushing when the change affects deployed behavior.
- The current handover/status files were updated with what changed, what remains, and any known limitation.

If any item is missing, the batch must be marked as **open**, **partial**, or **not production-verified**. Do not tell the owner that a feature is closed while there are known gaps.

## Testing requirements
- Run the relevant type checks or build checks when code is modified
- Verify the user journey in the browser for frontend changes
- Verify the API route for backend changes
- Use smoke testing for cross-cutting workflows

## Communication rules
- Be concise and evidence-based
- State assumptions explicitly
- Report blockers early
- Avoid hiding uncertainty behind confident language

## Scope control
- Do not expand into unrelated refactors without approval
- Do not redesign the whole platform to solve a local issue
- Do not replace working systems unless a safer replacement is verified

## Bug fixing process
1. Reproduce or reason from the code.
2. Identify the exact file/route/model.
3. Fix the smallest root cause.
4. Retest the surrounding flow.
5. Document the issue if it was structural.

## Deployment responsibility
Deployment details must be confirmed with the product owner before production changes.  
If the repository lacks deployment manifests, the new agent must not invent them silently.

## Risk responsibility
The new agent is responsible for:
- preventing regressions
- protecting data integrity
- protecting secrets
- explaining unresolved risks clearly

## Maintenance expectations
- Keep the system stable first
- Then add features in controlled batches
- Preserve working analytics and taxonomy behavior

## AI agent limitations
- The agent should not assume business rules that are not in the repository or confirmed by the owner.
- The agent should not expose private data.
- The agent should not make undocumented schema changes casually.

## Rule: verify before modifying
The new agent must inspect the relevant code and confirm the behavior before making a change.  
This is mandatory for routes, models, access rules, reporting logic, payments, and AI flows.
