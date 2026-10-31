import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TemplatePreview } from './PerformanceReviewsPage';

const tpl: any = {
    id: 't1', name: 'Annual', review_type: 'annual', rating_scale: 5, description: 'Yearly review',
    requires_self_review: true, requires_manager_review: true,
    sections: [{ id: 's1', title: 'Goals', weight: 40, fields: [{ type: 'rating', label: 'Goal delivery' }] }],
};

describe('Given the review template preview', () => {
    it('When no template is selected Then nothing renders', () => {
        const { container } = render(<TemplatePreview template={undefined} />);
        expect(container).toBeEmptyDOMElement();
    });
    it('When a template is selected Then sections and questions are listed read-only', () => {
        render(<TemplatePreview template={tpl} />);
        expect(screen.getByText('Goals (40%)')).toBeInTheDocument();
        expect(screen.getByText('Goal delivery')).toBeInTheDocument();
        expect(screen.getByText('Yearly review')).toBeInTheDocument();
    });
    it('When a template has no sections Then an empty note shows', () => {
        render(<TemplatePreview template={{ ...tpl, sections: [] }} />);
        expect(screen.getByText(/no sections yet/i)).toBeInTheDocument();
    });
});

describe('Given a template with self and manager review', () => {
    it('When previewed Then the scale and who assesses are summarised', () => {
        render(<TemplatePreview template={tpl} />);
        expect(screen.getByText('5-point scale · employee self-assessment · manager assessment')).toBeInTheDocument();
        expect(screen.getByTestId('template-preview')).toBeInTheDocument();
    });
});
