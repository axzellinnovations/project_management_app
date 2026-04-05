import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatInput } from './chatInput';
import { uploadChatDocument } from './uploadChatDocument';

const mockUseParams = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

jest.mock('emoji-picker-react', () => ({
  __esModule: true,
  default: ({ onEmojiClick }: { onEmojiClick: (emojiData: { emoji: string }) => void }) => (
    <button onClick={() => onEmojiClick({ emoji: '😀' })}>Pick emoji</button>
  ),
  Theme: { LIGHT: 'light' },
}));

jest.mock('./uploadChatDocument', () => ({
  uploadChatDocument: jest.fn(),
}));

const mockedUploadChatDocument = uploadChatDocument as jest.Mock;

describe('ChatInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParams.mockReturnValue({ id: '42' });
  });

  it('renders and sends a trimmed message on Enter', () => {
    const onSendMessage = jest.fn();

    render(<ChatInput onSendMessage={onSendMessage} placeholder="Message team..." />);

    const input = screen.getByLabelText('Message input');
    fireEvent.change(input, { target: { value: '  hello team  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSendMessage).toHaveBeenCalledWith('hello team');
    expect((input as HTMLTextAreaElement).value).toBe('');
  });

  it('does not send message when Enter is pressed with Shift', () => {
    const onSendMessage = jest.fn();

    render(<ChatInput onSendMessage={onSendMessage} />);

    const input = screen.getByLabelText('Message input');
    fireEvent.change(input, { target: { value: 'line one' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it('supports mention insertion from mention dropdown', () => {
    const onSendMessage = jest.fn();

    render(
      <ChatInput
        onSendMessage={onSendMessage}
        enableMentions={true}
        mentionCandidates={['alice', 'alex', 'bob']}
      />
    );

    const input = screen.getByLabelText('Message input');
    fireEvent.change(input, { target: { value: '@al', selectionStart: 3 } });

    expect(screen.getByLabelText('Mention alice')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Mention alice'));

    expect((input as HTMLTextAreaElement).value).toBe('@alice ');
  });

  it('keeps send button disabled for whitespace-only input', () => {
    const onSendMessage = jest.fn();

    render(<ChatInput onSendMessage={onSendMessage} />);

    const input = screen.getByLabelText('Message input');
    fireEvent.change(input, { target: { value: '    ' } });

    const sendButton = screen.getByRole('button', { name: 'Send message' });
    fireEvent.click(sendButton);

    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it('uploads file and sends uploaded URL when upload succeeds', async () => {
    const onSendMessage = jest.fn();
    mockedUploadChatDocument.mockResolvedValueOnce('https://files.example.com/report.pdf');

    render(<ChatInput onSendMessage={onSendMessage} />);

    const fileInput = screen.getByLabelText('Attach a file') as HTMLInputElement;
    const file = new File(['hello'], 'report.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockedUploadChatDocument).toHaveBeenCalledWith('42', file);
      expect(onSendMessage).toHaveBeenCalledWith('https://files.example.com/report.pdf');
    });
  });

  it('alerts user when file upload fails', async () => {
    const onSendMessage = jest.fn();
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    mockedUploadChatDocument.mockRejectedValueOnce(new Error('upload failed'));

    render(<ChatInput onSendMessage={onSendMessage} />);

    const fileInput = screen.getByLabelText('Attach a file') as HTMLInputElement;
    const file = new File(['hello'], 'report.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Failed to upload file.');
    });

    expect(onSendMessage).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
