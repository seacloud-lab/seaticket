import React, { act } from 'react';
import { screen } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { toaster } from '@/components';
import { knowledgeBaseAPI, ticketsAPI } from '@/project/api';
import { useData } from '@/project/hooks';
import CreateKBRecordDialog from '@/project/main-panel/tickets/components/create-kb-record-dialog';

jest.mock('reactstrap', () => ({
  Modal: ({ children }) => <div>{children}</div>,
  ModalBody: ({ children }) => <div>{children}</div>,
  ModalFooter: ({ children }) => <div>{children}</div>,
  Form: ({ children }) => <form>{children}</form>,
  FormGroup: ({ children }) => <div>{children}</div>,
  Label: ({ for: htmlFor, children }) => <label htmlFor={htmlFor}>{children}</label>,
  Input: ({ type, ...props }) => type === 'textarea' ? <textarea {...props} /> : <input type={type} {...props} />,
  Button: ({ children, color, ...props }) => <button {...props}>{children}</button>,
}));
jest.mock('@/components', () => ({
  ModalHeader: ({ children }) => <div>{children}</div>,
  CenteredLoading: () => <div role="status">Loading</div>,
  CenteredError: ({ children }) => <div role="alert">{children}</div>,
  toaster: { success: jest.fn(), danger: jest.fn() },
}));
jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('@/project/api', () => ({
  ticketsAPI: { listProjectTicketComments: jest.fn(), convertTicketToKnowledgeBaseRecord: jest.fn() },
  knowledgeBaseAPI: { createRecord: jest.fn() },
}));
jest.mock('@/project/hooks', () => ({ useData: jest.fn() }));
jest.mock('@/project/main-panel/knowledge-base/constants', () => ({ KB_TABLE_NAME: 'kb' }));
jest.mock('@/utils/utils', () => ({ Utils: { getErrorMsg: error => error.message } }));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe('Create knowledge base record request lifecycle', () => {
  const originalActEnvironment = global.IS_REACT_ACT_ENVIRONMENT;
  let container;
  let root;
  let onClose;
  let markTablesViewExpired;
  const render = id => act(() => root.render(
    <CreateKBRecordDialog projectUuid="project" ticket={{ _id: id, title: `Title ${id}`, content: `Content ${id}` }} onClose={onClose} />
  ));

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    jest.clearAllMocks();
    onClose = jest.fn();
    markTablesViewExpired = jest.fn();
    useData.mockReturnValue({ markTablesViewExpired });
    ticketsAPI.listProjectTicketComments.mockResolvedValue({ data: { ticket_comments: [] } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    global.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  });

  it('generates content using the target ticket and comments, then expires the knowledge base cache on success', async () => {
    ticketsAPI.listProjectTicketComments.mockResolvedValue({ data: { ticket_comments: [{ creator: 'user', content: 'Comment' }, { content: '' }] } });
    ticketsAPI.convertTicketToKnowledgeBaseRecord.mockResolvedValue({ data: { kb_title: 'Generated title', kb_content: 'Generated content' } });
    knowledgeBaseAPI.createRecord.mockResolvedValue({ data: {} });
    await act(async () => render('A'));

    expect(ticketsAPI.listProjectTicketComments).toHaveBeenCalledWith('project', 'A', 1, 25);
    expect(ticketsAPI.convertTicketToKnowledgeBaseRecord).toHaveBeenCalledWith('project', 'Title A', 'Content A', [{ creator: 'user', created_time: '', content: 'Comment' }]);
    expect(screen.getByLabelText('Title*').value).toBe('Generated title');
    expect(screen.getByLabelText('Content*').value).toBe('Generated content');
    await act(async () => screen.getByRole('button', { name: 'Submit' }).click());
    expect(knowledgeBaseAPI.createRecord).toHaveBeenCalledWith('project', { title: 'Generated title', content: 'Generated content' });
    expect(markTablesViewExpired).toHaveBeenCalledWith(['kb']);
    expect(toaster.success).toHaveBeenCalledWith('Record created');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not start content generation when closed while comments are loading', async () => {
    const comments = deferred();
    ticketsAPI.listProjectTicketComments.mockReturnValue(comments.promise);
    render('A');
    act(() => root.render(null));
    await act(async () => {
      comments.resolve({ data: { ticket_comments: [] } });
      await comments.promise;
    });
    expect(ticketsAPI.convertTicketToKnowledgeBaseRecord).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'])('ignores an old generation %s after switching targets', async outcome => {
    const old = deferred();
    ticketsAPI.convertTicketToKnowledgeBaseRecord.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ data: { kb_title: 'Generated B', kb_content: 'Content B' } });
    await act(async () => render('A'));
    await act(async () => render('B'));
    await act(async () => {
      if (outcome === 'resolve') old.resolve({ data: { kb_title: 'Generated A', kb_content: 'Content A' } });
      else old.reject(new Error('Old generation failed'));
      await old.promise.catch(() => {});
    });
    expect(screen.getByLabelText('Title*').value).toBe('Generated B');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
