import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import TrainingSectionPage from './TrainingSectionPage';
import { TRAINING_SECTIONS } from './sections';

const renderPage = (section?: string) =>
  render(<MemoryRouter><TrainingSectionPage section={section} /></MemoryRouter>);

describe('Given the Training & Competency scaffold', () => {
  describe('When the landing page renders', () => {
    it('Then it shows the module title and the coming-soon state', () => {
      renderPage();
      expect(screen.getAllByText('Training & Competency').length).toBeGreaterThan(0);
      expect(screen.getByText(/coming soon/i)).toBeTruthy();
    });
  });

  describe('When a section page renders', () => {
    it('Then it shows that section label', () => {
      renderPage('certifications');
      expect(screen.getAllByText('Certifications').length).toBeGreaterThan(0);
    });
  });

  describe('When the section list is inspected', () => {
    it('Then it has 11 unique slugs', () => {
      const slugs = TRAINING_SECTIONS.map((s) => s.slug);
      expect(slugs).toHaveLength(11);
      expect(new Set(slugs).size).toBe(11);
    });
  });
});
