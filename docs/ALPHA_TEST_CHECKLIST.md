# BiteMap NOVA — Alpha Test Checklist

This is the short, repeatable test for sharing BiteMap with a small group. The
goal is to learn whether anglers can complete the core journey and identify bad
data—not to prove that every public water or bite prediction is complete.

## Before sharing

- Start the complete stack and wait for both `web` and `api` to report healthy.
- Use a non-default PostgreSQL password.
- Set `BITEMAP_ADMIN_EMAILS` to the account email that should see the private
  administrator data-health and feedback queue.
- Set `NWS_USER_AGENT` to a real contact address.
- Open the app in a private browser window and create a fresh tester account.
- Confirm that a saved spot and trip remain after restarting the stack.

## Tester journey

Ask each tester to complete these tasks without coaching:

1. Start with no fish selected and find a plausible nearby public fishing spot.
2. Add one or more target species and explain what they think the score means.
3. Change the prediction time and confirm the map/list update together.
4. Open a spot, review what is present versus what is forecast to bite, and open
   Google Maps directions.
5. Check the consumption-advisory panel as if they intended to keep fish.
6. Save the spot and confirm it appears in **My spots** immediately.
7. Log a real or clearly labeled test trip with its actual time and location.
8. Use **Feedback** to report one confusing detail, bug, data concern, or idea.

## Questions to ask afterward

- What did you think the score represented?
- Which piece of evidence made you trust—or distrust—the result?
- Was any fish, access point, water type, advisory, or regulation obviously wrong?
- Could you tell modeled presence from direct documentation?
- Did the timeline feel responsive?
- What information was missing before you would decide to make the trip?
- Would you use this again, and for what exact decision?

## Administrator review

Open `/admin/data-health` with an allowlisted account. Review tester reports
there. A feedback report is only a lead: it must go through the normal
source-verification workflow before it changes access, species evidence,
advisories, or scoring rules.

## Pass criteria for the small alpha

- No account, favorite, trip, or feedback loss across a normal restart.
- No broken core route or repeatable server error.
- No score is mistaken for a catch probability after reading the explanation.
- Testers can distinguish verified access, listed access, direct evidence, and
  modeled presence.
- Every high-impact incorrect-data report has an owner and a verification next
  step.

## Known limitations to disclose

- Coverage is ambitious but not exhaustive; listed waters still need exact
  access review.
- Some species presence is conservatively modeled and labeled as such.
- Bite scores are scientifically informed suitability estimates, not measured
  catch rates or guarantees.
- Forecast reach is limited to the available provider window.
- Regulations, closures, weather, and posted access rules must still be checked
  with the responsible authority.
