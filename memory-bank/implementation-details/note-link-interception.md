# Obsidian Note-Link Interception (T28)

**Status:** Reported Android crash fixed; user confirmed on affected device
**Related tasks:** T28, T11

## Current behavior

Chat-rendered note links preserve the original Obsidian-rendered anchor nodes.
A capture-phase listener on the stable message container delegates click
handling, preventing stale renderer references that could crash Android.
`WeakSet` tracking prevents duplicate listener installation, and the listener
intercepts before target handlers. The fix is in `15b0f8e`; focused tests cover
anchor identity, event ordering, and duplicate-handler prevention. The user
confirmed that the Android crash is fixed.

## Verification boundary

The reproduced Android link-click crash is fixed and user-confirmed. The prior
debug log lacked handler breadcrumbs, which led to a source-level investigation
and the anchor-preservation fix. Alias-link and external-URL variants were not
separately reported as retested; those remain useful coverage, not a reason to
leave the reported crash open.
