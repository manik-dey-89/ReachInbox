import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/emails/StatusBadge';
import { RecipientStatus, JobStatus, CampaignStatus } from '@/types';

describe('StatusBadge', () => {
  it('renders "Sent" label for SENT status', () => {
    render(<StatusBadge status={RecipientStatus.SENT} />);
    expect(screen.getByText('Sent')).toBeInTheDocument();
  });

  it('renders "Failed" label for FAILED status', () => {
    render(<StatusBadge status={JobStatus.FAILED} />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders "Pending" label for PENDING status', () => {
    render(<StatusBadge status={JobStatus.PENDING} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders "Completed" label for COMPLETED status', () => {
    render(<StatusBadge status={JobStatus.COMPLETED} />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders "Processing" label for PROCESSING status', () => {
    render(<StatusBadge status={JobStatus.PROCESSING} />);
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('renders "Scheduled" label for SCHEDULED campaign status', () => {
    render(<StatusBadge status={CampaignStatus.SCHEDULED} />);
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
  });

  it('applies success variant CSS class for SENT status', () => {
    render(<StatusBadge status={RecipientStatus.SENT} />);
    const badge = screen.getByText('Sent');
    // success variant includes green classes
    expect(badge.className).toMatch(/green/);
  });

  it('applies error variant CSS class for FAILED status', () => {
    render(<StatusBadge status={JobStatus.FAILED} />);
    const badge = screen.getByText('Failed');
    expect(badge.className).toMatch(/red/);
  });

  it('applies warning variant CSS class for PENDING status', () => {
    render(<StatusBadge status={JobStatus.PENDING} />);
    const badge = screen.getByText('Pending');
    expect(badge.className).toMatch(/yellow/);
  });

  it('renders an unknown status as its raw string value', () => {
    render(<StatusBadge status="UNKNOWN_STATUS" />);
    expect(screen.getByText('UNKNOWN_STATUS')).toBeInTheDocument();
  });
});
