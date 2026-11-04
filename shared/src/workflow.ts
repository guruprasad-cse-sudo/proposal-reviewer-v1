/** Proposal status workflow. Change transitions here; server and web both read this. */
export type Role = "faculty" | "rd" | "admin";
export type Status = "draft" | "internal_review" | "changes_requested" | "approved" | "submitted" | "sanctioned" | "not_sanctioned" | "withdrawn";

interface Transition { to: Status; label: string; by: "owner" | "reviewer"; }

export const TRANSITIONS: Record<Status, Transition[]> = {
  draft: [{ to: "internal_review", label: "Send to R&D cell", by: "owner" }, { to: "withdrawn", label: "Withdraw", by: "owner" }],
  internal_review: [
    { to: "approved", label: "Approve for submission", by: "reviewer" },
    { to: "changes_requested", label: "Request changes", by: "reviewer" },
    { to: "draft", label: "Recall to draft", by: "owner" },
  ],
  changes_requested: [{ to: "internal_review", label: "Resubmit to R&D cell", by: "owner" }, { to: "withdrawn", label: "Withdraw", by: "owner" }],
  approved: [{ to: "submitted", label: "Mark as submitted to agency", by: "owner" }, { to: "changes_requested", label: "Reopen for changes", by: "reviewer" }],
  submitted: [{ to: "sanctioned", label: "Record: sanctioned", by: "owner" }, { to: "not_sanctioned", label: "Record: not sanctioned", by: "owner" }],
  sanctioned: [],
  not_sanctioned: [{ to: "draft", label: "Revise for another call", by: "owner" }],
  withdrawn: [{ to: "draft", label: "Reopen as draft", by: "owner" }],
};

/** Statuses in which the owner may edit the proposal content. */
export const EDITABLE: Status[] = ["draft", "changes_requested", "not_sanctioned", "withdrawn"];

export function allowedTransitions(status: Status, isOwner: boolean, role: Role): Transition[] {
  const reviewer = role === "rd" || role === "admin";
  return (TRANSITIONS[status] || []).filter((t) => (t.by === "owner" ? isOwner || role === "admin" : reviewer));
}
