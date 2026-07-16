# Release Gate Checklist
**BIK Business Toolkit — Phase 2 Tools**  
**Last updated:** 16 July 2026

A tool may only be marked **Available in Beta** when every applicable gate below is checked. Gates marked N/A for a specific tool must be documented as such.

---

## Gate Checklist

### Gate 1 — Product QA
- [ ] All required fields validated and showing appropriate errors
- [ ] Calculations verified manually against known inputs
- [ ] Conditional fields show/hide correctly
- [ ] Long text wraps correctly in generated document
- [ ] Special characters and line breaks handled correctly in generated document
- [ ] Local storage saves and restores correctly (autosave)
- [ ] Document history saves on generation
- [ ] Document history load/duplicate/delete working
- [ ] PDF print layout tested in Chrome and Edge
- [ ] Mobile layout tested on a small viewport
- [ ] Keyboard accessible (tab order, focus states)
- [ ] Unsafe HTML input tested (script tags, angle brackets in input fields)
- [ ] Empty state (no documents yet) renders correctly
- [ ] Reset/clear form working
- [ ] Cross-tool builder profile data fills correctly

### Gate 2 — Security Review
- [ ] All user input passed through `esc()` before insertion in generated HTML
- [ ] No SQL injection risk (N/A for static site)
- [ ] No server-side data transmission (all localStorage)
- [ ] API key never logged or transmitted (AI Writer key)

### Gate 3 — Calculation Review
- [ ] Financial calculations independently verified against manual calculation
- [ ] GST disclaimer present ("indicative only — not tax advice")
- [ ] Retention calculation noted as per-claim, not cumulative (where applicable)
- [ ] Edge cases tested (zero values, very large values, empty fields)

### Gate 4 — Copy and Disclaimer Review
- [ ] No claim of legislative compliance (e.g. no "BCIPA-compliant", "WHS Act compliant")
- [ ] No claim of legal validity or binding effect
- [ ] Standard disclaimer present in every generated document
- [ ] Jurisdiction limitations documented in tool description or in-tool notice
- [ ] Where professional review is recommended, this is stated in the tool
- [ ] Australian English throughout

### Gate 5 — Jurisdiction Limitations Documented
- [ ] Tool description states which states/territories it is designed for (or that state-specific verification is required)
- [ ] Where legislation varies by state, the tool makes this clear
- [ ] Where supporting documents may be required (e.g. BIF Act supporting statements), this is noted

### Gate 6 — Professional Review (Required for Category B and C tools)
- [ ] **Category B:** Copy and disclaimer reviewed internally for accuracy
- [ ] **Category C:** Document reviewed by an appropriately qualified Australian professional (construction lawyer, WHS professional, or other relevant expert)
- [ ] Professional review is documented in this register with the reviewer's name and date
- [ ] Any changes required by the reviewer have been applied

### Gate 7 — Release Owner Approval
- [ ] Tool has been demonstrated to the release owner (product lead)
- [ ] Release owner has approved for the applicable release category
- [ ] Release category recorded in the Legal and Safety Tool Register

### Gate 8 — Changelog and Roadmap Updated
- [ ] Tool listed in release-notes.html under the correct version
- [ ] Tool listed in roadmap.html with the correct status (Available in Beta / Controlled Beta / Coming Soon)
- [ ] Tool description in roadmap accurately reflects what the tool does and does not do
- [ ] Tool is accessible from the dashboard with the correct label

---

## Current Gate Status by Tool

| Tool | G1 QA | G2 Security | G3 Calc | G4 Copy | G5 Jurisdiction | G6 Review | G7 Approval | G8 Changelog |
|------|-------|------------|---------|---------|----------------|----------|------------|-------------|
| Progress Claim | ⬜ | ✅ | ⬜ | ✅ | ⚠️ partial | ⬜ needed | ⬜ | ✅ |
| SWMS | ⬜ | ✅ | N/A | ✅ | ⚠️ partial | ❌ HOLD | ⬜ | ✅ |
| Toolbox Talk | ⬜ | ✅ | N/A | ✅ | N/A | ✅ N/A | ⬜ | ✅ |
| Payment Reminder | ⬜ | ✅ | N/A | ⚠️ partial | ⬜ | ⬜ needed | ⬜ | ✅ |
| Practical Completion | ⬜ | ✅ | N/A | ✅ | ⚠️ partial | ✅ N/A | ⬜ | ✅ |
| Notice to Show Cause | ⬜ | ✅ | N/A | ✅ | ⬜ | ❌ HOLD | ⬜ | ✅ |
| Contract Termination | ⬜ | ✅ | ⬜ | ✅ | ⬜ | ❌ HOLD | ⬜ | ✅ |
| Subcontractor Agreement | ⬜ | ✅ | ⬜ | ✅ | ⬜ | ❌ HOLD | ⬜ | ✅ |
| Handover Checklist | ⬜ | ✅ | N/A | ✅ | N/A | ✅ N/A | ⬜ | ✅ |
| Instruction to Proceed | ⬜ | ✅ | ⬜ | ✅ | N/A | ✅ N/A | ⬜ | ✅ |
| Non-Conformance Report | ⬜ | ✅ | N/A | ✅ | N/A | ✅ N/A | ⬜ | ✅ |
| Incident Report | ⬜ | ✅ | N/A | ⚠️ reg. notice needed | ⬜ | ✅ N/A | ⬜ | ✅ |
| EOT Claim | ⬜ | ✅ | N/A | ✅ | ⚠️ partial | ✅ N/A | ⬜ | ✅ |
| Delay Notice | ⬜ | ✅ | N/A | ✅ | ⚠️ partial | ✅ N/A | ⬜ | ✅ |
| Inspection Checklist | ⬜ | ✅ | N/A | ✅ | N/A | ✅ N/A | ⬜ | ✅ |

**Legend:** ✅ Complete | ⬜ Pending | ⚠️ Partial / needs work | ❌ HOLD — do not release | N/A Not applicable

---

## HOLD List — Do Not Release

The following tools must not be released in any form until the HOLD is resolved by professional review:

| Tool | Hold Reason | Action Required |
|------|------------|----------------|
| SWMS | WHS compliance cannot be claimed. AI Writer on controlMeasures field is a safety risk. Consultation record missing. | Engage WHS professional. Disable or gate AI Writer on controlMeasures. Add consultation record field. |
| Notice to Show Cause | Incorrectly issued NSC can constitute breach or repudiation. | Engage construction lawyer. |
| Contract Termination Notice | Wrongful termination creates serious liability. | Engage construction lawyer. |
| Subcontractor Agreement | Creates real contractual obligations. Generated agreement omits many protective terms. | Engage construction lawyer. |

---

## Release Decision Log

| Date | Tool | Decision | Decided By | Notes |
|------|------|---------|-----------|-------|
| 16 Jul 2026 | All 15 tools | Feature complete; audit initiated | Product | Phase 2 build complete |
| 16 Jul 2026 | SWMS, NSC, CTN, SA | HOLD | Audit | Professional review required |
| 16 Jul 2026 | Toolbox Talk, Handover Checklist, NCR, Inspection Checklist | Approved for beta | Audit | Low-risk category A tools |
| 16 Jul 2026 | Progress Claim, Payment Reminder, Practical Completion, ITP, Incident Report, EOT, Delay Notice | Controlled Beta | Audit | Category B — disclaimers reviewed and applied |
