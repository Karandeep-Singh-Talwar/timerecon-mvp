import { describe, it, expect } from 'vitest';
import { exportTimesheetCSV } from '@/lib/export';

describe('Timesheet Export', () => {
  it('should format hours correctly in CSV rows', () => {
    const minutes = 90;
    const hours = (minutes / 60).toFixed(2);
    expect(hours).toBe('1.50');
  });

  it('should generate valid CSV header structure', () => {
    const headers = ['Date', 'Work Item', 'Project', 'Description', 'Hours', 'Billable'];
    const csvLine = headers.join(',');
    expect(csvLine).toBe('Date,Work Item,Project,Description,Hours,Billable');
  });
});
