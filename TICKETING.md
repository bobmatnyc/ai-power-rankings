# Ticketing

How issues and PRs are tracked in this repo. Facts below come from the labels and
issues on GitHub as of 2026-11-12.

## Status labels

An issue carries at most one `status:*` label at a time. Move it forward by
removing the old label and adding the next.

| Order | Label | Meaning (label description) | Issues carrying it |
|---|---|---|---|
| 1 | `status:in-progress` | A session has claimed it and is working it now | 7 |
| 2 | `status:coded` | Implementation pushed on a branch; PR not yet merged | 2 |
| 3 | `status:merged` | PR merged to main; live verification pending | 18 |
| 4 | `status:tested` | Verified live; eligible to close | 16 |

Counts cover all 199 issues, open and closed. All 16 `status:tested` issues are
closed. No issue carries two `status:*` labels.

## Blocked

`blocked` ("Blocked on an open question or dependency") is a separate label. It
sits alongside the current `status:*` label rather than replacing it. No issue
carries it at the time of writing.

## Closing

Close an issue with evidence in a final comment: the fixing PR, the merge commit,
the deployment, and the live check output (for example #417, #414).

## PRs

- PR bodies reference the issue with `Refs #N`. They do not use auto-close
  keywords (`Closes`, `Fixes`); the issue closes by hand once verified.
- A hold uses the `do-not-merge` label ("Merging waits on an explicit go"). Some
  held PRs are also drafts (#455); others are not (#360).

## Other labels

- `size:xs`, `size:s`, `size:m`, `size:l`, `size:xl` estimate effort.
- `goal:G12` ("AI Power Ranking design and functionality refresh") groups work
  under a goal; it is the only `goal:G*` label in use.
