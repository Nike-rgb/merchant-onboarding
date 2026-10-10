import { ApplicationStatus } from './enums/application-status.enum';
import { canTransition, isEditable } from './application-state';

describe('application state machine', () => {
  describe('canTransition', () => {
    it('allows the happy-path lifecycle', () => {
      expect(
        canTransition(ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED),
      ).toBe(true);
      expect(
        canTransition(
          ApplicationStatus.SUBMITTED,
          ApplicationStatus.UNDER_REVIEW,
        ),
      ).toBe(true);
      expect(
        canTransition(
          ApplicationStatus.UNDER_REVIEW,
          ApplicationStatus.APPROVED,
        ),
      ).toBe(true);
      expect(
        canTransition(
          ApplicationStatus.UNDER_REVIEW,
          ApplicationStatus.REJECTED,
        ),
      ).toBe(true);
      expect(
        canTransition(
          ApplicationStatus.UNDER_REVIEW,
          ApplicationStatus.INFO_REQUESTED,
        ),
      ).toBe(true);
      expect(
        canTransition(
          ApplicationStatus.INFO_REQUESTED,
          ApplicationStatus.SUBMITTED,
        ),
      ).toBe(true);
    });

    it('rejects invalid transitions', () => {
      // cannot skip straight from draft to approved
      expect(
        canTransition(ApplicationStatus.DRAFT, ApplicationStatus.APPROVED),
      ).toBe(false);
      // cannot decide before review
      expect(
        canTransition(ApplicationStatus.SUBMITTED, ApplicationStatus.APPROVED),
      ).toBe(false);
      // terminal states cannot move
      expect(
        canTransition(ApplicationStatus.APPROVED, ApplicationStatus.SUBMITTED),
      ).toBe(false);
      expect(
        canTransition(
          ApplicationStatus.REJECTED,
          ApplicationStatus.UNDER_REVIEW,
        ),
      ).toBe(false);
    });
  });

  describe('isEditable', () => {
    it('is editable only in DRAFT and INFO_REQUESTED', () => {
      expect(isEditable(ApplicationStatus.DRAFT)).toBe(true);
      expect(isEditable(ApplicationStatus.INFO_REQUESTED)).toBe(true);
      expect(isEditable(ApplicationStatus.SUBMITTED)).toBe(false);
      expect(isEditable(ApplicationStatus.UNDER_REVIEW)).toBe(false);
      expect(isEditable(ApplicationStatus.APPROVED)).toBe(false);
    });
  });
});
