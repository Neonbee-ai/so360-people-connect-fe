/**
 * BDD specs: every modal panel is height-capped to 90% of the viewport.
 *
 * All modals across the People Connect MFE render through the shared
 * <Modal> component (src/components/Modal.tsx). The inline "modals" in the
 * pages (AllocationsPage, DepartmentsPage, FeedbackPage, GoalsPage,
 * LeaveRequestsPage, LeaveTypesPage, PeoplePage, PerformanceReviewsPage,
 * PersonDetailPage, ReviewTemplatesPage, TimeEntriesPage, WorkLocationsPage)
 * all reuse this same <Modal>, so guaranteeing the shared panel carries
 * `max-h-[90vh]` guarantees the constraint for every modal in the MFE.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import Modal from './Modal';

const panelsWith90vh = () =>
  Array.from(document.querySelectorAll('div')).filter((el) =>
    el.className.includes('max-h-[90vh]'),
  );

describe('Modal — viewport height cap', () => {
  describe('Given the shared Modal is open', () => {
    it('When rendered / Then its panel carries the max-h-[90vh] class', () => {
      render(
        <Modal isOpen onClose={() => {}} title="Height Capped">
          <p>Content</p>
        </Modal>,
      );
      const panels = panelsWith90vh();
      expect(panels.length).toBeGreaterThan(0);
    });

    it('When rendered at size sm / Then the panel is still height-capped', () => {
      render(
        <Modal isOpen onClose={() => {}} title="Small" size="sm">
          <p>Content</p>
        </Modal>,
      );
      expect(panelsWith90vh().length).toBeGreaterThan(0);
    });

    it('When rendered at size xl / Then the panel is still height-capped', () => {
      render(
        <Modal isOpen onClose={() => {}} title="Wide" size="xl">
          <p>Content</p>
        </Modal>,
      );
      expect(panelsWith90vh().length).toBeGreaterThan(0);
    });

    it('When rendered / Then the capped panel also scrolls overflow internally', () => {
      render(
        <Modal isOpen onClose={() => {}} title="Scrolls">
          <p>Content</p>
        </Modal>,
      );
      const capped = panelsWith90vh();
      expect(capped.some((el) => el.className.includes('overflow-y-auto'))).toBe(true);
    });
  });
});

// Regression: overlay must paint above the shell NavBar (z-500); carries z-[600].
describe('Modal — overlay stacking above the NavBar', () => {
  it('When open / Then an overlay carries z-[600]', () => {
    render(<Modal isOpen onClose={() => {}} title="Z"><p>C</p></Modal>);
    const overlays = Array.from(document.querySelectorAll('div')).filter(
      (el) => el.className.includes('fixed') && el.className.includes('inset-0'),
    );
    expect(overlays.some((el) => el.className.includes('z-[600]'))).toBe(true);
  });
});
