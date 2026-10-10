import { ApplicationStatus } from './enums/application-status.enum';

/**
 * The application lifecycle state machine, kept as pure data/functions so the
 * business rules are trivially unit-testable in isolation from Nest/DB.
 *
 *   DRAFT ──submit──► SUBMITTED ──assign──► UNDER_REVIEW ──decide──► APPROVED
 *     ▲                                          │                   REJECTED
 *     │                                          └─► INFO_REQUESTED ─┐
 *     └──────────────── (edit) ◄─────────────────────────────────────┘
 *                         INFO_REQUESTED ──resubmit──► SUBMITTED
 */
export const ALLOWED_TRANSITIONS: Record<
  ApplicationStatus,
  ApplicationStatus[]
> = {
  [ApplicationStatus.DRAFT]: [ApplicationStatus.SUBMITTED],
  [ApplicationStatus.SUBMITTED]: [ApplicationStatus.UNDER_REVIEW],
  [ApplicationStatus.UNDER_REVIEW]: [
    ApplicationStatus.APPROVED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.INFO_REQUESTED,
  ],
  [ApplicationStatus.INFO_REQUESTED]: [ApplicationStatus.SUBMITTED],
  [ApplicationStatus.APPROVED]: [],
  [ApplicationStatus.REJECTED]: [],
};

export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuses in which a SALES user may still edit the application's fields. */
export const EDITABLE_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.DRAFT,
  ApplicationStatus.INFO_REQUESTED,
];

export function isEditable(status: ApplicationStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}
