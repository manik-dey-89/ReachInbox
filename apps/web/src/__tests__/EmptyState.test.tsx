import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '@/components/common/EmptyState';
import { Mail } from 'lucide-react';

describe('EmptyState', () => {
  it('renders the title', () => {
    render(
      <EmptyState
        icon={Mail}
        title="No emails yet"
        description="You have not sent any emails."
      />,
    );
    expect(screen.getByText('No emails yet')).toBeInTheDocument();
  });

  it('renders the description', () => {
    render(
      <EmptyState
        icon={Mail}
        title="No emails yet"
        description="You have not sent any emails."
      />,
    );
    expect(screen.getByText('You have not sent any emails.')).toBeInTheDocument();
  });

  it('does not render an action button when no action prop is given', () => {
    render(
      <EmptyState
        icon={Mail}
        title="No emails"
        description="Nothing here."
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders an action button when the action prop is provided', () => {
    render(
      <EmptyState
        icon={Mail}
        title="No emails"
        description="Nothing here."
        action={{ label: 'Compose email', onClick: vi.fn() }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Compose email' })).toBeInTheDocument();
  });

  it('calls onClick when the action button is clicked', async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={Mail}
        title="No emails"
        description="Nothing here."
        action={{ label: 'Compose email', onClick }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Compose email' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders the icon element', () => {
    const { container } = render(
      <EmptyState
        icon={Mail}
        title="No emails"
        description="Nothing here."
      />,
    );
    // Lucide renders an SVG
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
