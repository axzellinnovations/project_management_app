import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LabelPicker from './LabelPicker';
import * as labelsService from '@/services/labels-service';
import type { Label } from '@/types';

jest.mock('@/services/labels-service', () => ({
  getProjectLabels: jest.fn(),
  createLabel: jest.fn(),
  updateLabel: jest.fn(),
  deleteLabel: jest.fn(),
}));

describe('LabelPicker Component', () => {
  const mockLabels: Label[] = [
    { id: 1, name: 'Bug', color: '#EF4444' },
    { id: 2, name: 'Feature', color: '#22C55E' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (labelsService.getProjectLabels as jest.Mock).mockResolvedValue([...mockLabels]);
  });

  it('renders trigger button with count and opens dropdown on click', async () => {
    const handleChange = jest.fn();
    render(
      <LabelPicker
        projectId={10}
        selectedLabels={[mockLabels[0]]}
        onChange={handleChange}
      />
    );

    expect(screen.getByRole('button', { name: /Labels 1/i })).toBeInTheDocument();
    expect(screen.getByText('Bug')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Labels 1/i }));

    await waitFor(() => {
      expect(labelsService.getProjectLabels).toHaveBeenCalledWith(10);
    });

    expect(screen.getByPlaceholderText(/Search or new label/i)).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();
  });

  it('allows creating a new label', async () => {
    const createdLabel: Label = { id: 3, name: 'Refactor', color: '#3B82F6' };
    (labelsService.createLabel as jest.Mock).mockResolvedValue(createdLabel);

    const handleChange = jest.fn();
    render(
      <LabelPicker
        projectId={10}
        selectedLabels={[]}
        onChange={handleChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Labels/i }));

    await waitFor(() => {
      expect(screen.getByText('Bug')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Search or new label/i);
    fireEvent.change(input, { target: { value: 'Refactor' } });

    const createBtn = screen.getByTitle(/Create label/i);
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(labelsService.createLabel).toHaveBeenCalledWith(10, 'Refactor', expect.any(String));
      expect(handleChange).toHaveBeenCalledWith([createdLabel]);
    });
  });

  it('allows editing an existing label', async () => {
    const updatedLabel: Label = { id: 1, name: 'Critical Bug', color: '#EF4444' };
    (labelsService.updateLabel as jest.Mock).mockResolvedValue(updatedLabel);

    const handleChange = jest.fn();
    render(
      <LabelPicker
        projectId={10}
        selectedLabels={[mockLabels[0]]}
        onChange={handleChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Labels 1/i }));

    await waitFor(() => {
      expect(screen.getByText('Bug')).toBeInTheDocument();
    });

    const editBtn = screen.getByLabelText(/Edit label Bug/i);
    fireEvent.click(editBtn);

    const editInput = screen.getByPlaceholderText('Label name');
    expect(editInput).toHaveValue('Bug');

    fireEvent.change(editInput, { target: { value: 'Critical Bug' } });

    const saveBtn = screen.getByTitle('Save changes');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(labelsService.updateLabel).toHaveBeenCalledWith(1, 'Critical Bug', expect.any(String));
      expect(handleChange).toHaveBeenCalledWith([updatedLabel]);
    });
  });

  it('allows deleting a label with confirmation', async () => {
    (labelsService.deleteLabel as jest.Mock).mockResolvedValue(undefined);

    const handleChange = jest.fn();
    render(
      <LabelPicker
        projectId={10}
        selectedLabels={[mockLabels[0]]}
        onChange={handleChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Labels 1/i }));

    await waitFor(() => {
      expect(screen.getByText('Bug')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByLabelText(/Delete label Bug/i);
    fireEvent.click(deleteBtn);

    expect(screen.getByText(/Delete "Bug"\?/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /^Delete$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(labelsService.deleteLabel).toHaveBeenCalledWith(1);
      expect(handleChange).toHaveBeenCalledWith([]);
    });
  });
});
