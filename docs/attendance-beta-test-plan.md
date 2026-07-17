# Site Sign-In & Workforce Register — Beta Test Plan

**Version:** Beta 1  
**Date:** July 2026  
**Tester:** ___________________________  
**Device / Browser:** ___________________________  
**Site / Project used for testing:** ___________________________

---

## Before You Start

1. Open the BIK Business Toolkit at biksolutions.com.au
2. Create a test project (or use an existing active project)
3. Use a second device (phone) to simulate a worker scanning the QR code
4. All data is stored on your device — nothing is sent to a server

---

## Test Cases

### A — New Worker Check-In via QR Code

**Purpose:** Confirm the full QR check-in flow works end-to-end under 20 seconds.

**Steps:**
1. Open a project → scroll to Site Attendance → click **Show QR Code**
2. On a second device (phone), scan the QR code with the camera app
3. Tap the link — confirm the check-in page loads with the correct project name and address
4. Enter name, company, trade, select worker type, tap **Check In**
5. Confirm the success screen appears with project address and a checkout button

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| QR page loads in < 5 seconds | ✓ | | |
| Project name shown on check-in page | ✓ | | |
| Check-in completes | ✓ | | |
| Worker appears in builder dashboard immediately | ✓ | | |

---

### B — Worker Appears in Builder Dashboard Immediately

**Purpose:** Builder can see new check-in without refreshing.

**Steps:**
1. Complete Test Case A
2. On the builder device, open `attendance.html` for the same project
3. Confirm the new worker appears in the "On Site Now" section

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| Worker shown in "On Site Now" section | ✓ | | |
| Check-in time correct | ✓ | | |

---

### C — Worker Check-Out via Success Page Link

**Purpose:** Worker can check out using the link on the success screen.

**Steps:**
1. After checking in (Test A), tap **Check Out** on the success screen
2. Confirm the checkout confirmation screen appears with hours recorded
3. Note: "Recorded site hours are not automatically approved payroll or billable hours"

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| Checkout screen loads | ✓ | | |
| Hours shown correctly | ✓ | | |
| Disclaimer shown | ✓ | | |

---

### D — Worker Check-Out via Manual Lookup (Lost Link)

**Purpose:** Worker who closed the page can still check out by looking themselves up.

**Steps:**
1. On a phone, go to `checkout.html` (or scan QR again and tap "Check Out instead")
2. Enter name and mobile number used at check-in
3. Confirm their record appears — tap **This is me → Check Out**

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| Manual lookup finds the record | ✓ | | |
| Checkout completes successfully | ✓ | | |
| Hours shown on confirmation | ✓ | | |

---

### E — Returning Worker (Duplicate Prevention)

**Purpose:** Worker who scans QR again is shown their existing check-in, not a blank form.

**Steps:**
1. Check in a worker (Test A)
2. Scan the QR code again on the same device with the same name/mobile
3. Confirm the "Already Signed In" screen appears with check-in time and checkout option

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| "Already Signed In" screen shown | ✓ | | |
| Check-in time shown correctly | ✓ | | |
| "That's not me" option available | ✓ | | |

---

### F — Builder Manual Check-Out from Dashboard

**Purpose:** Builder can check out a worker from the attendance dashboard.

**Steps:**
1. Open `attendance.html` for the project
2. Find a worker in "On Site Now" — click **✓ Check out**
3. Confirm the worker moves to "Checked Out Today"

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| Check out button works | ✓ | | |
| Worker moves to checked-out section | ✓ | | |
| Hours calculated correctly | ✓ | | |

---

### G — Edit Attendance Record with Audit Trail

**Purpose:** Builder can correct a record and the change is logged.

**Steps:**
1. On `attendance.html`, click **✏️ Edit** on any worker record
2. Change the check-in time by 30 minutes
3. Select a correction reason from the dropdown
4. Click **Save**
5. Click **📋 History** on the same record — confirm the change is logged

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| Edit modal opens with current values | ✓ | | |
| Save updates the record | ✓ | | |
| Hours recalculate after time edit | ✓ | | |
| Audit history shows the change with reason | ✓ | | |

---

### H — Break Minutes Deducted from Hours

**Purpose:** Break minutes entered by builder reduce the recorded site hours.

**Steps:**
1. Edit a checked-out record
2. Enter 30 in the Break (minutes) field
3. Save — confirm hours displayed are reduced by 0.5h

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| Break minutes field visible in edit modal | ✓ | | |
| Hours recalculate correctly after break entered | ✓ | | |

---

### I — Forgotten / Overnight Checkout (>18 hours)

**Purpose:** Records over 18 hours are flagged as "Checkout Required", not auto-closed.

**Steps:**
1. Edit a check-in record and set the time-in to more than 18 hours ago
2. Save — confirm the record appears in "Checkout Required" section (amber)
3. Confirm the record is excluded from site hours total

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| Record shown in "Checkout Required" section | ✓ | | |
| Record NOT included in site hours total | ✓ | | |
| Warning shown in dashboard strip on project page | ✓ | | |

---

### J — Void a Record

**Purpose:** Builder can remove a duplicate or erroneous record without permanently deleting it.

**Steps:**
1. On `attendance.html`, click **✕ Void** on a record
2. Select a void reason and confirm
3. Confirm the record moves to "Voided Records" (greyed out) and is excluded from all totals

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| Void confirmation dialog appears | ✓ | | |
| Record moved to Voided section | ✓ | | |
| Voided record excluded from stats and reports | ✓ | | |

---

### K — Emergency Roll Call

**Purpose:** Builder can get a printable list of on-site workers in an emergency.

**Steps:**
1. On `attendance.html`, click **🚨 Roll Call**
2. Confirm the modal shows only workers currently on site
3. Click **Print Roll Call** — confirm print dialog opens

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| Roll Call modal shows on-site workers only | ✓ | | |
| Count shown correctly | ✓ | | |
| Print triggers correctly | ✓ | | |

---

### L — Daily Attendance CSV Export

**Purpose:** CSV exports correctly with all required fields, opens in Excel.

**Steps:**
1. On `attendance.html`, go to Reports tab
2. Click **Download Daily CSV**
3. Open in Excel — confirm: BOM encoded (no strange characters), all columns present including Break (min), Status, Corrected

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| File downloads | ✓ | | |
| Opens correctly in Excel | ✓ | | |
| Break (min) column present | ✓ | | |
| Status column present | ✓ | | |

---

### M — Workforce Register CSV Export

**Purpose:** Workforce register exports all unique workers with recorded site hours.

**Steps:**
1. On `attendance.html`, go to Reports tab
2. Click **Download Workforce Register CSV**
3. Confirm column header says "Recorded Site Hrs" (not "labour hours")

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| File downloads | ✓ | | |
| "Recorded Site Hrs" column header | ✓ | | |
| All unique workers listed | ✓ | | |

---

### N — Print Daily Report

**Purpose:** Print-ready daily attendance report generates correctly.

**Steps:**
1. On `attendance.html`, go to Reports tab
2. Click **Print Daily Report**
3. Confirm the print preview shows: project name, date, worker list with times and hours, disclaimer

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| Print preview opens | ✓ | | |
| Disclaimer shown: "not automatically approved payroll or billable hours" | ✓ | | |
| Voided records excluded | ✓ | | |

---

### O — Print QR Sign (A4)

**Purpose:** Builder can print a professional QR sign to display on site.

**Steps:**
1. On `project.html`, click **🖨️ Print QR Sign** in the Site Attendance section
2. Confirm an A4 printable page opens with: project name, address, QR code, instructions, BIK branding
3. Print (or close)

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| Print page opens in new window | ✓ | | |
| QR code is correct (scan to verify) | ✓ | | |
| Project name and address shown | ✓ | | |
| Instructions readable | ✓ | | |

---

### P — Invalid or Expired QR Token

**Purpose:** Invalid tokens show a clear error, not a broken form.

**Steps:**
1. Visit `checkin.html?t=invalidtoken123` manually in the browser
2. Confirm a "not found" or clear error message is shown
3. Confirm no form is shown

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| Error screen shown for invalid token | ✓ | | |
| No blank or broken form shown | ✓ | | |

---

### Q — Mobile Layout (Phone)

**Purpose:** Check-in flow is usable on a phone without zooming or horizontal scrolling.

**Steps:**
1. On a phone, scan the QR code
2. Complete the full check-in form
3. Check out using the success page link

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| All fields visible without zooming | ✓ | | |
| No horizontal scrolling on any screen | ✓ | | |
| Buttons are large enough to tap easily | ✓ | | |

---

### R — Data Persists After Browser Close

**Purpose:** Attendance records survive a browser restart.

**Steps:**
1. Check in a worker
2. Close the browser completely
3. Reopen and visit `attendance.html`
4. Confirm the worker record is still present

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| Records present after browser close and reopen | ✓ | | |

---

### S — Demo Data Load and Clear

**Purpose:** Demo data can be loaded for testing and removed cleanly.

**Steps:**
1. On `attendance.html`, go to Reports tab
2. Click **Load Attendance Demo Data**
3. Confirm demo records appear in the dashboard
4. Click **Remove Demo Data**
5. Confirm only demo records are removed and real records remain

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| Demo records appear with "(Demo)" label | ✓ | | |
| Demo clear removes only demo records | ✓ | | |

---

### T — Privacy Notice on Check-In Form

**Purpose:** Workers see a privacy notice before submitting their details.

**Steps:**
1. Open the check-in form (scan QR or visit checkin.html?t=...)
2. Scroll to the bottom of the form before submitting
3. Confirm a privacy notice is visible explaining how data is stored

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| Privacy notice visible before submit button | ✓ | | |
| Notice explains data is stored on builder's device only | ✓ | | |

---

### U — Dashboard Smart Actions

**Purpose:** Dashboard shows relevant attendance alerts.

**Steps:**
1. Create a situation where a worker has been on site for >18 hours (edit time-in)
2. Open `dashboard.html`
3. Confirm a "requires checkout confirmation" alert appears
4. Click the action link — confirm it goes to the correct project's attendance page

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| Alert shown for >18h worker | ✓ | | |
| Link goes to correct project attendance | ✓ | | |

---

### V — No Console Errors on Live Deployment

**Purpose:** No JavaScript errors in the browser console on the live site.

**Steps:**
1. On the live GitHub Pages site (biksolutions.com.au), open browser DevTools → Console
2. Visit `dashboard.html`, `attendance.html`, `checkin.html`, `checkout.html`, `project.html`
3. Confirm no red errors in the console

| | Expected | Pass/Fail | Notes |
|---|---|---|---|
| No console errors on dashboard | ✓ | | |
| No console errors on attendance | ✓ | | |
| No console errors on checkin | ✓ | | |
| No console errors on checkout | ✓ | | |
| No console errors on project | ✓ | | |

---

## Test Summary

| Total cases | Passed | Failed | Not tested |
|---|---|---|---|
| 22 | | | |

**Overall result:** PASS / FAIL / PARTIAL

**Key issues found:**

1. 
2. 
3. 

**Tester signature:** ___________________________ **Date:** ___________
