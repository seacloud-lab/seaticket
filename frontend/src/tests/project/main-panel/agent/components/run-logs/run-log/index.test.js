import React, { act } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import RunLog from '@/project/main-panel/agent/components/run-logs/run-log';

jest.mock('@/components', () => ({ IconButton: () => null }));
jest.mock('@/constants', () => ({ gettext: text => text }));
jest.mock('@/project/main-panel/connections/components/cell-formatter/date-formatter', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/sea-metadata/constants', () => ({ FROM_NOW: 'from_now' }));
jest.mock('@/project/main-panel/agent/utils', () => ({
  getAgentResource: () => ({ icon: '', type_name: 'Email', _id: 1 }),
}));
jest.mock('@/project/main-panel/agent/components/resource-title', () => () => null);
jest.mock('@/project/main-panel/agent/components/run-logs/run-log/index.css', () => ({}));

const runLog = {
  key: 'email_1',
  owner_source_id: 1,
  owner_source_type: 'email',
  num_of_runs: 1,
  last_active_at: '',
  status: 'processed',
  isFiltered: true,
};

const fireTransitionEnd = (element, propertyName) => {
  const transitionEnd = new Event('transitionend', { bubbles: true });
  Object.defineProperty(transitionEnd, 'propertyName', { value: propertyName });
  fireEvent(element, transitionEnd);
};

describe('RunLog filtered animation', () => {
  let animationFrameCallbacks;
  let nextAnimationFrameId;
  let measuredHeight;

  const getAnimationFrameId = (callIndex) => window.requestAnimationFrame.mock.results[callIndex].value;
  const runAnimationFrame = (animationFrameId) => {
    const callback = animationFrameCallbacks.get(animationFrameId);
    if (!callback) throw new Error(`No RAF callback scheduled for ${animationFrameId}`);
    animationFrameCallbacks.delete(animationFrameId);
    act(() => callback());
  };

  beforeEach(() => {
    animationFrameCallbacks = new Map();
    nextAnimationFrameId = 0;
    measuredHeight = 96;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const animationFrameId = ++nextAnimationFrameId;
      animationFrameCallbacks.set(animationFrameId, callback);
      return animationFrameId;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const height = this.style.height === '0px' || this.style.height === '0' ? 0 : measuredHeight;
      return { height, width: 240, top: 0, left: 0, right: 240, bottom: height, x: 0, y: 0, toJSON: () => {} };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('restarts filtering after the panel hides during the height animation', () => {
    const onRemove = jest.fn();
    const props = { active: true, runLog, onClick: jest.fn(), onRemove };
    const { rerender } = render(<RunLog {...props} isShowLogs={true} />);
    const item = screen.getByText('Email #1').closest('.seaqa-agent-run-log');

    expect(item.style.height).toBe('96px');
    const firstAnimationFrameId = getAnimationFrameId(0);
    runAnimationFrame(firstAnimationFrameId);
    expect(item.style.height).toBe('0px');

    rerender(<RunLog {...props} isShowLogs={false} />);
    expect(item.style.height).toBe('');
    expect(item.classList.contains('seaqa-agent-run-log-filtered')).toBe(false);

    rerender(<RunLog {...props} isShowLogs={true} />);
    expect(item.style.height).toBe('96px');
    expect(item.classList.contains('seaqa-agent-run-log-filtered')).toBe(true);
    const reopenedAnimationFrameId = getAnimationFrameId(1);
    expect(reopenedAnimationFrameId).not.toBe(firstAnimationFrameId);
    runAnimationFrame(reopenedAnimationFrameId);
    fireTransitionEnd(item.querySelector('.seaqa-agent-run-log-header'), 'height');
    fireTransitionEnd(item, 'opacity');
    expect(onRemove).not.toHaveBeenCalled();

    fireTransitionEnd(item, 'height');
    fireTransitionEnd(item, 'height');

    expect(item.style.height).toBe('0px');
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('remeasures height and starts a new animation after hiding an active item', () => {
    const props = { active: true, runLog, onClick: jest.fn(), onRemove: jest.fn() };
    const { rerender } = render(<RunLog {...props} isShowLogs={true} />);
    const item = screen.getByText('Email #1').closest('.seaqa-agent-run-log');
    const firstAnimationFrameId = getAnimationFrameId(0);

    expect(item.style.height).toBe('96px');
    runAnimationFrame(firstAnimationFrameId);
    expect(item.style.height).toBe('0px');

    rerender(<RunLog {...props} isShowLogs={false} />);
    expect(item.style.height).toBe('');

    measuredHeight = 144;
    rerender(<RunLog {...props} isShowLogs={true} />);

    const reopenedAnimationFrameId = getAnimationFrameId(1);
    expect(reopenedAnimationFrameId).not.toBe(firstAnimationFrameId);
    expect(item.style.height).toBe('144px');

    runAnimationFrame(reopenedAnimationFrameId);
    expect(item.style.height).toBe('0px');
  });

  it('waits for the panel to become visible before measuring a filtered item', () => {
    const props = { active: true, runLog, onClick: jest.fn(), onRemove: jest.fn() };
    const { rerender } = render(<RunLog {...props} isShowLogs={false} />);
    const item = screen.getByText('Email #1').closest('.seaqa-agent-run-log');

    expect(item.style.height).toBe('');
    expect(item.classList.contains('seaqa-agent-run-log-filtered')).toBe(false);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();

    rerender(<RunLog {...props} isShowLogs={true} />);

    expect(item.style.height).toBe('96px');
    expect(item.classList.contains('seaqa-agent-run-log-filtered')).toBe(true);
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending animation and clears the measured height when hidden', () => {
    const props = { active: true, runLog, onClick: jest.fn(), onRemove: jest.fn() };
    const { rerender } = render(<RunLog {...props} isShowLogs={true} />);
    const item = screen.getByText('Email #1').closest('.seaqa-agent-run-log');

    expect(item.style.height).toBe('96px');
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    const cancelledAnimationFrameId = getAnimationFrameId(0);

    rerender(<RunLog {...props} isShowLogs={false} />);

    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(cancelledAnimationFrameId);
    expect(item.style.height).toBe('');
    expect(item.classList.contains('seaqa-agent-run-log-filtered')).toBe(false);

    rerender(<RunLog {...props} isShowLogs={true} />);
    expect(item.style.height).toBe('96px');
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);
    const reopenedAnimationFrameId = getAnimationFrameId(1);
    expect(reopenedAnimationFrameId).not.toBe(cancelledAnimationFrameId);

    runAnimationFrame(cancelledAnimationFrameId);
    expect(item.style.height).toBe('96px');
    runAnimationFrame(reopenedAnimationFrameId);
    expect(item.style.height).toBe('0px');
  });

  it('ignores a stale frame and transition after the filtered state changes quickly', () => {
    const onRemove = jest.fn();
    const props = { active: true, onClick: jest.fn(), onRemove };
    const { rerender } = render(<RunLog {...props} runLog={runLog} isShowLogs={true} />);
    const item = screen.getByText('Email #1').closest('.seaqa-agent-run-log');
    const firstAnimationFrameId = getAnimationFrameId(0);

    rerender(<RunLog {...props} runLog={{ ...runLog, isFiltered: false }} isShowLogs={true} />);
    expect(item.style.height).toBe('');
    fireTransitionEnd(item, 'height');
    expect(onRemove).not.toHaveBeenCalled();

    rerender(<RunLog {...props} runLog={runLog} isShowLogs={true} />);
    const restartedAnimationFrameId = getAnimationFrameId(1);
    expect(restartedAnimationFrameId).not.toBe(firstAnimationFrameId);
    expect(item.style.height).toBe('96px');

    runAnimationFrame(firstAnimationFrameId);
    expect(item.style.height).toBe('96px');
    runAnimationFrame(restartedAnimationFrameId);
    expect(item.style.height).toBe('0px');

    fireTransitionEnd(item, 'height');
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('does not measure or animate an unfiltered item', () => {
    const unfilteredRunLog = { ...runLog, isFiltered: false };
    const props = { active: true, runLog: unfilteredRunLog, onClick: jest.fn(), onRemove: jest.fn() };
    const { rerender } = render(<RunLog {...props} isShowLogs={true} />);
    const item = screen.getByText('Email #1').closest('.seaqa-agent-run-log');

    expect(item.style.height).toBe('');
    expect(item.classList.contains('seaqa-agent-run-log-filtered')).toBe(false);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();

    rerender(<RunLog {...props} isShowLogs={false} />);
    rerender(<RunLog {...props} isShowLogs={true} />);

    expect(item.style.height).toBe('');
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });
});
