# Phase 2 Tool Audit
**Date:** 16 July 2026  
**Scope:** All 15 Phase 2 tools added in the `claude/bik-solutions-website-yevsuk` branch  
**Auditor:** Product, Legal-Risk, Safety and QA review  
**Status:** COMPLETE — corrections applied

---

## Summary of Findings

| # | Tool | Classification | Release Decision |
|---|------|---------------|-----------------|
| 1 | Progress Claim | B — Controlled Release | LIMITED GO with jurisdiction disclaimer |
| 2 | SWMS | C — Professional Review Required | NO-GO pending WHS expert review |
| 3 | Toolbox Talk | A — Low-Risk Beta | GO |
| 4 | Payment Reminder | B — Controlled Release | LIMITED GO with disclaimers |
| 5 | Practical Completion Notice | B — Controlled Release | LIMITED GO |
| 6 | Notice to Show Cause | C — Professional Review Required | NO-GO pending legal review |
| 7 | Contract Termination Notice | C — Professional Review Required | NO-GO pending legal review |
| 8 | Subcontractor Agreement | C — Professional Review Required | NO-GO pending legal review |
| 9 | Handover Checklist | A — Low-Risk Beta | GO |
| 10 | Instruction to Proceed | B — Controlled Release | LIMITED GO |
| 11 | Non-Conformance Report | A — Low-Risk Beta | GO |
| 12 | Incident Report | B — Controlled Release | LIMITED GO with statutory notice |
| 13 | EOT Claim | B — Controlled Release | LIMITED GO with contract caveat |
| 14 | Delay Notice | B — Controlled Release | LIMITED GO with contract caveat |
| 15 | Inspection Checklist | A — Low-Risk Beta | GO |

---

## Critical Issues Found and Corrected

### Issue 1 — BCIPA 2004 referenced in Progress Claim (CRITICAL)
**Location:** `js/tools/progress-claim/config.js` — file comment line 3, placeholder line 297, and generated document "Legislative Notice" section  
**Problem:** BCIPA 2004 was repealed and replaced in Queensland by the Building Industry Fairness (Security of Payment) Act 2017 (BIF Act). Every other Australian state and territory has its own separate security of payment legislation. The generated document contained a hardcoded statement "This payment claim is made under the Building and Construction Industry Payments Act 2004 (Qld)" which is wrong.  
**Fix Applied:** Removed "BCIPA-compliant" from the file comment. Replaced the "Legislative Notice" section with an accurate, jurisdiction-neutral note that:
- Names the correct current Queensland legislation (BIF Act 2017)
- Lists the applicable legislation for each other state/territory
- Makes clear the user must verify the applicable Act for their jurisdiction
- Notes that supporting statements may be required in some cases
- Does not assert compliance

### Issue 2 — BCIPA tag on Progress Claim in dashboard, roadmap, project.html (CRITICAL)
**Location:** `dashboard.html`, `roadmap.html`, `project.html`, `progress-claim.html` (meta)  
**Problem:** UI copy described the Progress Claim as "BCIPA-compliant" — a misleading claim referencing repealed legislation.  
**Fix Applied:** All occurrences replaced with accurate, non-compliance-claiming descriptions.

### Issue 3 — "WHS Act compliant" in SWMS (CRITICAL)
**Location:** `js/tools/swms/config.js` line 3, `swms.html` meta description, `roadmap.html`, `coming-soon.html`, `toolkit.html`, `ai-documents.html`, `productivity.html`  
**Problem:** The SWMS cannot be described as "WHS Act compliant" — WHS compliance requires site-specific hazard identification, consultation with workers, review by a competent person, and ongoing monitoring. A tool-generated document can only produce a structured starting point.  
**Fix Applied:** All "WHS Act compliant" / "compliant with Safe Work Australia" copy replaced with accurate language.

### Issue 4 — "compliant, professional" copy in ai-documents.html
**Location:** `ai-documents.html` line 75  
**Problem:** "Built for Australian construction — compliant, professional" implies legal compliance.  
**Fix Applied:** Replaced with "professional, practical".

### Issue 5 — "Contractually compliant delay notice. Protect your programme rights." in coming-soon.html
**Location:** `coming-soon.html` line 243  
**Problem:** Claims compliance and promises to "protect programme rights" — outcome depends on contract, service, and notice timing not within BIK's control.  
**Fix Applied:** Replaced with accurate description.

### Issue 6 — Payment Reminder references BCIPA in roadmap.html
**Location:** `roadmap.html` line 311  
**Problem:** "BCIPA reference where applicable" — BCIPA is repealed.  
**Fix Applied:** Replaced with "security of payment reference where applicable."

---

## Tool-by-Tool Findings

### 1. Progress Claim
**Intended user:** Licensed builder or contractor making a payment claim for work completed  
**Intended use case:** Structured progress claim document to accompany a payment claim submitted to the principal or head contractor  
**Must not be used for:**
- As a substitute for advice from a construction lawyer on payment claim rights
- Claims to a head contractor in Queensland without reviewing supporting statement requirements under the BIF Act 2017 s.77
- Claims under contracts with specific claim format requirements (check the contract first)
- Claims where the applicable state legislation has deadlines that affect the claim (served by reference date — the tool does not calculate reference dates)

**Critical missing inputs:**
- State/territory jurisdiction (affects which Act applies)
- Whether the claim is a head contract or subcontract claim (affects supporting statement obligations)
- Contract type (some contracts restrict when and how claims can be made)
- Reference date (the date on or after which the claim can be made under s.68 BIF Act or equivalent)

**Calculations requiring validation:**
- Retention calculation: `thisClaim * (rate / 100)` — applied to this claim amount only. Does not track cumulative retention held. This is a simplification that may be incorrect depending on the contract. Noted in disclaimer.
- No validation that previouslyClaimed + thisClaimAmount ≤ contractValue

**Legal risks:** High. Incorrect legislative statement previously hardcoded. Now corrected. User must still understand their specific obligations.  
**Required disclaimer added:** Jurisdiction note, supporting statement note, contract review obligation.  
**Release classification:** B — Controlled Release  
**External review required:** Construction lawyer to review supporting statement requirements and jurisdiction accuracy  
**Recommendation:** LIMITED GO — with prominent in-tool jurisdiction warning and disclaimer

---

### 2. SWMS — Safe Work Method Statement
**Intended user:** PCBU (person conducting a business or undertaking), site supervisor, or WHS coordinator  
**Intended use case:** Produce a structured SWMS starting point for high-risk construction work  
**Must not be used for:**
- As a complete substitute for workplace consultation and review by a competent person
- Without site-specific hazard identification (generic hazards are not adequate)
- Issued as "WHS Act compliant" — compliance requires implementation, monitoring, and review, not just a document
- Without a qualified person verifying the control measures are appropriate
- For any work type without first verifying it is classified as high-risk construction work under the applicable WHS Regulation

**Current architecture limitations:**
- The tool collects free-text hazards and controls. It cannot verify that the controls are appropriate, site-specific, or adequate under the hierarchy of controls. AI-generated controls (via AI Writer) could be generic and inadequate.
- There is no consultation record — the WHS Regulation (Qld reg. 296) requires workers who will carry out the work to be consulted in preparing the SWMS.
- The form does not require the user to confirm a competent person has reviewed the document.
- The `aiFields` includes `controlMeasures` — AI must never generate control measures that are presented as site-adequate.

**WHS Regulation (Qld) obligations not yet captured:**
- Record that workers were consulted in preparing the SWMS (reg. 296)
- Name of competent person who reviewed the SWMS
- Confirmation of who will monitor the implementation of controls
- What will happen if conditions change (review trigger)

**Recommendation:** NO-GO — must not be publicly released until:
1. AI Writer is disabled for controlMeasures field OR a prominent warning is added that AI-generated controls must be individually reviewed by a competent person
2. A consultation record field is added
3. A competent-person review confirmation is added
4. Tool description is updated to make clear this is a structured draft, not a compliant document
5. A WHS professional reviews the tool output and required fields

---

### 3. Toolbox Talk
**Intended user:** Site supervisor or builder  
**Intended use case:** Record of a site safety briefing with attendance register  
**Legal risk:** Low. Record of a meeting — no regulatory compliance claim required.  
**Missing inputs:** None critical.  
**Required disclaimer:** Standard is adequate.  
**Recommendation:** GO

---

### 4. Payment Reminder
**Intended user:** Builder or contractor chasing overdue invoices  
**Intended use case:** Professional letter to client requesting payment  
**Must not be used for:** As formal statutory demand under Corporations Act, or as a substitute for debt recovery advice when the amount is material  
**Level 3 "final notice":** The generated copy references intent to "suspend works" and "pursue debt recovery." This should make clear the user must verify they have the contractual right to suspend before doing so.  
**Missing inputs:** Whether the amount arises from a contract with suspension rights  
**Legal risk:** Moderate for Level 3 escalation  
**Recommendation:** LIMITED GO — Level 1 and 2 are low risk. Level 3 warning added.

---

### 5. Practical Completion Notice
**Intended user:** Builder issuing notice of practical completion  
**Intended use case:** Formal notice to client that works are complete  
**Must not be used for:** Contracts with specific form requirements for PC notice (check contract first)  
**Missing inputs:** Whether an occupancy permit / certificate of occupancy has been issued  
**Legal risk:** Moderate. Contract-specific.  
**Recommendation:** LIMITED GO with contract review reminder

---

### 6. Notice to Show Cause
**Intended user:** Party asserting a breach by the other party  
**Intended use case:** Formal notice requiring explanation of a breach  
**Must not be used for:** Where the applicable contract does not require or permit a show cause notice before other remedies; as a substitute for legal advice; issued without first reviewing the specific contract  
**Legal risk:** High. An incorrectly issued, prematurely issued, or improperly served NSC can constitute repudiation or waiver. The consequences are severe.  
**Current disclaimer:** Strong — already says "not a substitute for independent legal advice from a qualified construction lawyer."  
**Recommendation:** NO-GO — must not be in beta without a qualified construction lawyer reviewing the generated output for a range of common contract types (AS4000, HIA, ABIC, domestic)

---

### 7. Contract Termination Notice
**Intended user:** Party who wishes to terminate a contract  
**Intended use case:** Formal notice of termination  
**Must not be used for:** Without legal advice — wrongful termination can result in the terminating party being in breach. The consequences include liability for the other party's losses.  
**Legal risk:** Extreme. This is arguably the single highest-risk document in the suite.  
**Current disclaimer:** Adequate but may not be sufficient to prevent misuse.  
**Additional safety gate required:** A pre-generation acknowledgement that the user has sought legal advice and that BIK is not responsible for consequences.  
**Recommendation:** NO-GO — professional legal review required before release

---

### 8. Subcontractor Agreement
**Intended user:** Head contractor engaging a trade subcontractor  
**Intended use case:** Simple written agreement / purchase order for subcontract work  
**Must not be used for:** As a substitute for a properly reviewed contract; complex subcontracts; subcontracts with retention trust obligations under the BIF Act 2017 (Qld) or equivalent; where the contract value or relationship requires a more comprehensive document  
**Legal risk:** High. The agreement creates binding contractual obligations. The generated document does not include many standard protective clauses (dispute resolution, variation procedure, WHS obligations, insurance requirements, intellectual property, or jurisdiction).  
**Current disclaimer:** Does not adequately warn about the limitations of this agreement compared to a professionally drafted subcontract.  
**Recommendation:** NO-GO — a construction lawyer must review whether the generated agreement adequately protects the user and what minimum terms must be included

---

### 9. Handover Checklist
**Intended user:** Builder at practical completion  
**Intended use case:** Record of items handed over to the client  
**Legal risk:** Low. A record document.  
**Recommendation:** GO

---

### 10. Instruction to Proceed
**Intended user:** Head contractor or project manager  
**Intended use case:** Written authorisation to commence or continue works  
**Legal risk:** Moderate. Creates a financial authorisation. GST disclosure required.  
**Recommendation:** LIMITED GO

---

### 11. Non-Conformance Report
**Intended user:** Builder, supervisor, or quality officer  
**Intended use case:** Record of work that does not meet specification  
**Legal risk:** Low. Internal quality management record.  
**Recommendation:** GO

---

### 12. Incident Report
**Intended user:** Site supervisor or employer  
**Intended use case:** Record of a workplace incident  
**Must not be used for:** As a substitute for statutory notification — serious incidents (fatality, serious injury, dangerous occurrence) must be reported to the relevant WHS regulator immediately by phone. This tool cannot replace that obligation.  
**Missing inputs:** The tool asks whether regulatory notification is required but does not provide regulator contact details or explain what triggers a notification obligation.  
**Legal risk:** Moderate. Failing to notify a regulator is a serious offence. The tool must make clear this is a record-keeping tool, not a notification system.  
**Recommendation:** LIMITED GO — with prominent note that statutory notification to WorkSafe / SafeWork must be made separately and immediately for serious incidents

---

### 13. Extension of Time Claim
**Intended user:** Builder or contractor claiming additional time under a contract  
**Intended use case:** Formal written EOT claim  
**Must not be used for:** Where the contract requires a specific form or content of EOT claim; as a substitute for reviewing the contract's notice requirements before issuing  
**Legal risk:** Moderate. Strict notice requirements in most contracts — late or incorrectly formatted notices may extinguish the entitlement. Current disclaimer is appropriate.  
**Recommendation:** LIMITED GO

---

### 14. Delay Notice
**Intended user:** Builder or contractor  
**Intended use case:** Formal notice of a delaying event to preserve contractual rights  
**Must not be used for:** Where notice periods have already expired; without reviewing the applicable contract's notice requirements  
**Legal risk:** Moderate. Same strict-notice risk as EOT. Current disclaimer is appropriate.  
**Recommendation:** LIMITED GO

---

### 15. Inspection Checklist
**Intended user:** Builder or supervisor  
**Intended use case:** Stage-based inspection record  
**Legal risk:** Low.  
**Recommendation:** GO

---

## Professional Review Priority Order

1. **SWMS** — immediate. WHS risk is highest. Must not be in beta without a WHS professional review.
2. **Contract Termination Notice** — highest legal risk. Wrongful termination is a serious liability exposure.
3. **Notice to Show Cause** — closely related to CTN. Often issued before termination.
4. **Subcontractor Agreement** — commercially important but creates real contractual obligations. Lawyer review required.
5. **Progress Claim** — most commercially used. Legislative accuracy now corrected but nuances around supporting statements and state differences need expert validation.

---

## Calculations Review

| Tool | Calculation | Status |
|------|------------|--------|
| Progress Claim | `netPayable = thisClaim - retentionAmt` | Correct for simple case. Does not track cumulative retention. Noted in disclaimer. |
| Progress Claim | `totalPayable = calcTotal(netPayable, hasGST)` | GST on net (after retention) — this is the correct approach. |
| Variation Notice | `calcTotal(cost, hasGST)` | Correct. |
| Quote Builder | Line items × qty | Inherited from prior sprint — validated as correct. |
| Payment Reminder | No financial calculation | N/A |
| Instruction to Proceed | `calcTotal(authorisedAmount, hasGST)` | Correct. |
| Subcontractor Agreement | `calcTotal(subcontractPrice, hasGST)` | Correct. |

---

## Remaining Work Estimate

| Category | Effort |
|----------|--------|
| WHS expert review (SWMS) | External — 4–8 hrs professional engagement |
| Legal review (NSC, CTN, SA) | External — 8–16 hrs construction lawyer |
| Progress Claim jurisdiction validation | External — 2–4 hrs |
| SWMS consultation record field | 2 hrs development |
| SWMS competent-person gate | 1 hr development |
| Incident Report regulator details | 2 hrs development |
| Dashboard/roadmap labelling | Complete — applied in this commit |
| Release gate checklist setup | Complete — applied in this commit |
