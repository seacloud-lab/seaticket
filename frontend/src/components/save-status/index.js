import React, { forwardRef, cloneElement, isValidElement, useCallback, useRef, useState, useImperativeHandle } from 'react';
import classnames from 'classnames';
import IconTooltip from '@/components/icon-tooltip';
import { gettext } from '@/constants';
import { isFunction } from '@/utils/type-detection';
import { SAVE_STATUS_TYPE, SAVE_STATUS } from './constants';

import './index.css';

const SaveStatus = forwardRef(({ className, children, callback }, ref) => {
  const [status, setStatus] = useState('');
  const [tip, setTip] = useState('');
  const submissionSequence = useRef(0);
  const latestSubmissionSequence = useRef(0);
  const pendingSubmissions = useRef(new Set());
  const latestSubmissionResult = useRef(null);

  const updateStatus = useCallback((nextStatus, nextTip) => {
    const statusConfig = SAVE_STATUS[nextStatus];
    if (!statusConfig) {
      setStatus('');
      setTip('');
      return;
    }
    setStatus(nextStatus);
    setTip(nextTip || '');
  }, []);

  const startSubmission = useCallback(() => {
    const sequence = ++submissionSequence.current;
    latestSubmissionSequence.current = sequence;
    latestSubmissionResult.current = null;
    pendingSubmissions.current.add(sequence);
    updateStatus(SAVE_STATUS_TYPE.SAVING);
    return sequence;
  }, [updateStatus]);

  const completeSubmission = useCallback((sequence, nextStatus, nextTip) => {
    if (!pendingSubmissions.current.delete(sequence)) return;

    if (sequence === latestSubmissionSequence.current) {
      latestSubmissionResult.current = { status: nextStatus, tip: nextTip };
    }

    if (pendingSubmissions.current.size > 0) {
      updateStatus(SAVE_STATUS_TYPE.SAVING);
      return;
    }

    const result = latestSubmissionResult.current;
    if (!result) return;
    updateStatus(result.status, result.tip);
  }, [updateStatus]);

  const handleCallback = useCallback((...props) => {
    const sequence = startSubmission();
    callback && callback((isSuccess, tip) => {
      let nextStatus = '';
      let nextTip = tip;
      if (isSuccess !== undefined) {
        nextStatus = isSuccess ? SAVE_STATUS_TYPE.SAVED : SAVE_STATUS_TYPE.SAVE_ERROR;
        nextTip = isSuccess ? gettext('Saved') : tip;
      }

      completeSubmission(sequence, nextStatus, nextTip);
    }, ...props);
  }, [callback, completeSubmission, startSubmission]);

  const setImperativeStatus = useCallback((nextStatus, nextTip) => {
    submissionSequence.current += 1;
    latestSubmissionSequence.current = submissionSequence.current;
    latestSubmissionResult.current = null;
    pendingSubmissions.current.clear();
    updateStatus(nextStatus, nextTip);
  }, [updateStatus]);

  const setSubmissionStatus = useCallback((sequence, nextStatus, nextTip) => {
    completeSubmission(sequence, nextStatus, nextTip);
  }, [completeSubmission]);

  useImperativeHandle(ref, () => ({
    setStatus: setImperativeStatus,
    startSubmission,
    setSubmissionStatus,
  }), [setImperativeStatus, startSubmission, setSubmissionStatus]);

  const { icon, className: iconClassName } = SAVE_STATUS[status] || {};

  return (
    <div className={classnames('d-flex align-items-center gap-2 seaqa-save-status', className)}>
      {isValidElement(children) && cloneElement(children, { callback: handleCallback })}
      {isFunction(children) && children({ callback: handleCallback })}
      {status && (<IconTooltip icon={icon} tip={tip} className="mx-0" iconClassName={iconClassName} placement="bottom" size={14} />)}
    </div>
  );
});

export default SaveStatus;
