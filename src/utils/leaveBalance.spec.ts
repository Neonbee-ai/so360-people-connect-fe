import { balanceError, minWorkingDays } from './leaveBalance';

describe('Given a leave date range', () => {
    it('When it spans a weekend / Then only Mon-Fri are counted', () => {
        expect(minWorkingDays('2026-12-04', '2026-12-08')).toBe(3); // Fri..Tue
    });
    it('When half-days are ticked / Then 0.5 is removed per end', () => {
        expect(minWorkingDays('2026-12-01', '2026-12-03', true, true)).toBe(2);
    });
    it('When the range is reversed / Then null', () => {
        expect(minWorkingDays('2026-12-05', '2026-12-01')).toBeNull();
    });
});

describe('Given a remaining balance', () => {
    it('When the request exceeds it / Then an error message is returned', () => {
        expect(balanceError(26, 55)).toMatch(/exceeds your remaining balance of 26/);
    });
    it('When the request fits / Then no error', () => {
        expect(balanceError(26, 26)).toBe('');
    });
    it('When there is no balance row (unlimited/unpaid) / Then no error', () => {
        expect(balanceError(undefined, 99)).toBe('');
    });
});
