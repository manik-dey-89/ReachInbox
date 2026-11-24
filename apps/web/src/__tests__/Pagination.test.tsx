import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from '@/components/common/Pagination';

describe('Pagination', () => {
  it('renders the correct "Showing X–Y of Z" text for the first page', () => {
    render(<Pagination page={1} pageSize={10} total={50} onPageChange={vi.fn()} />);
    // The component uses an en-dash (–) between start and end
    expect(screen.getByText(/Showing 1/)).toBeInTheDocument();
    expect(screen.getByText(/of 50/)).toBeInTheDocument();
  });

  it('renders the correct range on the second page', () => {
    render(<Pagination page={2} pageSize={10} total={50} onPageChange={vi.fn()} />);
    expect(screen.getByText(/Showing 11/)).toBeInTheDocument();
    expect(screen.getByText(/of 50/)).toBeInTheDocument();
  });

  it('Previous button is disabled on the first page', () => {
    render(<Pagination page={1} pageSize={10} total={50} onPageChange={vi.fn()} />);
    const prevButton = screen.getByLabelText('Previous page');
    expect(prevButton).toBeDisabled();
  });

  it('Next button is disabled on the last page', () => {
    render(<Pagination page={5} pageSize={10} total={50} onPageChange={vi.fn()} />);
    const nextButton = screen.getByLabelText('Next page');
    expect(nextButton).toBeDisabled();
  });

  it('Previous button is enabled on pages after the first', () => {
    render(<Pagination page={2} pageSize={10} total={50} onPageChange={vi.fn()} />);
    const prevButton = screen.getByLabelText('Previous page');
    expect(prevButton).not.toBeDisabled();
  });

  it('Next button is enabled when there are more pages', () => {
    render(<Pagination page={1} pageSize={10} total={50} onPageChange={vi.fn()} />);
    const nextButton = screen.getByLabelText('Next page');
    expect(nextButton).not.toBeDisabled();
  });

  it('calls onPageChange with page - 1 when Previous is clicked', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={3} pageSize={10} total={50} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByLabelText('Previous page'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with page + 1 when Next is clicked', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageSize={10} total={50} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('calls onPageChange with the correct page number when a page button is clicked', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageSize={10} total={50} onPageChange={onPageChange} />);
    await userEvent.click(screen.getByLabelText('Page 3'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('returns null when total is 0', () => {
    const { container } = render(
      <Pagination page={1} pageSize={10} total={0} onPageChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
