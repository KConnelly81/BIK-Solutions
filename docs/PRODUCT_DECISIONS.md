# Product Decisions

Binding decisions that govern how BIK tools behave. These are not guidelines — they are constraints. All future development must comply.

---

## Decision 001 — AI never invents facts

**Status:** Accepted  
**Date:** 2026-07-15

**Decision:**  
AI writing modes may rewrite, restructure, strengthen, or simplify the text a user has written. They must never add facts, figures, dates, names, quantities, specifications, or claims that are not already present in the user's input.

**Reason:**  
Maintain trust. A builder who sends an AI-generated variation notice to a client or head contractor is putting their professional reputation and legal position on the line. If the AI invents a figure, a date, or a claim the builder never authorised, the consequences range from embarrassing to legally damaging. The user is the source of truth. The AI is an editor, not an author.

**Implications for implementation:**
- System prompts for all AI modes must include an explicit instruction: "Do not add any facts, figures, names, dates, amounts, or claims not present in the original text."
- The `contract-protection` mode is particularly at risk — strengthening language must not introduce new obligations or representations.
- AI output should be reviewed in the same UI field it was written into, so the user can immediately see and correct what changed.
- If the AI cannot improve the text without inventing facts, it must return the original text unchanged rather than fabricate.
