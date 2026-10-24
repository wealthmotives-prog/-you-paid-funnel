# You Paid Member Experience — next lightweight improvement
Status: DESIGN / NOT DEPLOYED.

## One-screen priority
- Preserve the four existing portal tabs: Overview, Work History, Verification, Account.
- Keep only employer name, address, start month, and employment status immediately visible in employment intake.
- Collapse employer phone and contact email behind "Add employer contact details (optional)"; never contact employer simply because details were entered.
- Show "X of 3 foundation steps completed" and progress bar based on existing employment and schedule declarations and optional work-history intake.
- Continue treating all user declarations as self-declared/unverified.
- Place a clear "What happens next?" explanation after each successful save.
- Keyboard and screen-reader accessibility: native details/summary, visible labels, status updates, reduced-motion transitions.
- Preserve element IDs and existing handlers to avoid breaking saving or verification workflows.

## QA gate
Test signed-out/signed-in, mobile width, keyboard navigation, empty and partially complete members, save/reload, bad employer email, failure messages, and no accidental employer outreach. Keep evidence uploads disabled.
