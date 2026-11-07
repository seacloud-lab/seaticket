import React, { forwardRef, cloneElement, isValidElement, useCallback, useEffect, useRef, useState, useImperativeHandle } from 'react';
import classnames from 'classnames';
import IconTooltip from '@/components/icon-tooltip';
import { gettext } from '@/constants';
import { isFunction } from '@/utils/type-detection';
import { Utils } from '@/utils/utils';
import { SAVE_STATUS_TYPE, SAVE_STATUS } from './constants';

import './index.css';

const SaveStatus = forwardRef(({ className, type = '', children, callback }, ref) => {
  const [status, setStatus] = useState('');
  const [tip, setTip] = useState('');
  const [errorCode, setErrorCode] = useState(0);

  const statusRef = useRef('');
  const savedStatusTimer = useRef(null);
  const savedStatusVersion = useRef(0);
  const hasSuccessfulSubmission = useRef(false);
  const submissionSequence = useRef(0);
  const latestSubmissionSequence = useRef(0);
  const pendingSubmissions = useRef(new Set());
  const latestSubmissionResult = useRef(null);

  const updateStatus = useCallback((nextStatus, nextTip, nextErrorCode) => {
    clearTimeout(savedStatusTimer.current);
    savedStatusTimer.current = null;
    const statusVersion = ++savedStatusVersion.current;
    statusRef.current = nextStatus || '';

    const statusConfig = SAVE_STATUS[nextStatus];
    if (!statusConfig) {
      setStatus('');
      setTip('');
      setErrorCode(0);
      return;
    }
    setStatus(nextStatus);
    setTip(nextTip || '');
    setErrorCode(nextErrorCode || 0);

    if (nextStatus === SAVE_STATUS_TYPE.SAVED) {
      savedStatusTimer.current = setTimeout(() => {
        if (statusRef.current !== SAVE_STATUS_TYPE.SAVED || savedStatusVersion.current !== statusVersion) return;
        statusRef.current = '';
        setStatus('');
        setTip('');
        setErrorCode(0);
        savedStatusTimer.current = null;
      }, 5000);
    }
  }, []);

  useEffect(() => () => clearTimeout(savedStatusTimer.current), []);

  const startSubmission = useCallback(() => {
    const sequence = ++submissionSequence.current;
    latestSubmissionSequence.current = sequence;
    latestSubmissionResult.current = null;
    pendingSubmissions.current.add(sequence);
    updateStatus(SAVE_STATUS_TYPE.SAVING);
    return sequence;
  }, [updateStatus]);

  const completeSubmission = useCallback((sequence, nextStatus, nextTip, nextErrorCode) => {
    if (!pendingSubmissions.current.delete(sequence)) return;

    if (sequence === latestSubmissionSequence.current) {
      latestSubmissionResult.current = { status: nextStatus, tip: nextTip, code: nextErrorCode };
      hasSuccessfulSubmission.current = nextStatus === SAVE_STATUS_TYPE.SAVED;
    }

    if (pendingSubmissions.current.size > 0) {
      updateStatus(SAVE_STATUS_TYPE.SAVING);
      return;
    }

    const result = latestSubmissionResult.current;
    if (!result) return;
    updateStatus(result.status, result.tip, result.code);
  }, [updateStatus]);

  const handleCallback = useCallback((...props) => {
    if (!callback || pendingSubmissions.current.size > 0 || hasSuccessfulSubmission.current) return;
    const sequence = startSubmission();
    callback && callback(({ error } = {}, isCascadeUpdate = false) => {
      if (isCascadeUpdate) {
        pendingSubmissions.current.delete(sequence);
        if (sequence === latestSubmissionSequence.current) {
          latestSubmissionResult.current = null;
          hasSuccessfulSubmission.current = false;
        }
        if (pendingSubmissions.current.size > 0) {
          updateStatus(SAVE_STATUS_TYPE.SAVING);
        } else {
          updateStatus('');
        }
        return;
      }
      const isSuccess = !error;
      const nextStatus = isSuccess ? SAVE_STATUS_TYPE.SAVED : SAVE_STATUS_TYPE.SAVE_ERROR;
      const nextTip = isSuccess ? gettext('Saved') : Utils.getErrorMsg(error);
      const nextErrorCode = isSuccess ? 0 : error?.response?.status || 0;

      completeSubmission(sequence, nextStatus, nextTip, nextErrorCode);
    }, ...props);
  }, [callback, completeSubmission, startSubmission, updateStatus]);

  const handleContentChange = useCallback(() => {
    hasSuccessfulSubmission.current = false;
    if (statusRef.current === SAVE_STATUS_TYPE.SAVING) {
      submissionSequence.current += 1;
      latestSubmissionSequence.current = submissionSequence.current;
      latestSubmissionResult.current = null;
      pendingSubmissions.current.clear();
      updateStatus('');
      return;
    }
    if (statusRef.current === SAVE_STATUS_TYPE.SAVED) updateStatus('');
  }, [updateStatus]);

  const setImperativeStatus = useCallback((nextStatus, nextTip) => {
    submissionSequence.current += 1;
    latestSubmissionSequence.current = submissionSequence.current;
    latestSubmissionResult.current = null;
    pendingSubmissions.current.clear();
    hasSuccessfulSubmission.current = nextStatus === SAVE_STATUS_TYPE.SAVED;
    updateStatus(nextStatus, nextTip);
  }, [updateStatus]);

  const setSubmissionStatus = useCallback((sequence, nextStatus, nextTip, nextErrorCode = 0) => {
    completeSubmission(sequence, nextStatus, nextTip, nextErrorCode);
  }, [completeSubmission]);

  useImperativeHandle(ref, () => ({
    setStatus: setImperativeStatus,
    startSubmission,
    setSubmissionStatus,
  }), [setImperativeStatus, startSubmission, setSubmissionStatus]);

  const { icon, className: iconClassName } = SAVE_STATUS[status] || {};

  const isInputContentError = errorCode === 400 && type.includes('input') && status === SAVE_STATUS_TYPE.SAVE_ERROR && tip;

  const saveStatus = isInputContentError ? null : (
    <>
      {status && (
        <IconTooltip
          icon={icon}
          tip={tip}
          className="mx-0"
          iconClassName={iconClassName}
          placement="bottom"
          size={14}
          tabIndex={status === SAVE_STATUS_TYPE.SAVE_ERROR ? 0 : undefined}
          role={status === SAVE_STATUS_TYPE.SAVE_ERROR ? 'img' : undefined}
          aria-label={status === SAVE_STATUS_TYPE.SAVE_ERROR ? tip : undefined}
        />
      )}
    </>
  );

  if (type.includes('custom')) {
    return (
      <div className={classnames('seaqa-save-status', className, {
        'seaqa-save-status-error': status === SAVE_STATUS_TYPE.SAVE_ERROR,
        'flex-column': isInputContentError,
      })}>
        {isValidElement(children) && cloneElement(children, { callback: handleCallback, saveStatus, onContentChange: handleContentChange })}
        {isFunction(children) && children({ callback: handleCallback, saveStatus, onContentChange: handleContentChange })}
        {isInputContentError && (
          <div className="text-danger seaqa-input-error-tip">
            {tip}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={classnames('d-flex seaqa-save-status', className, {
      'seaqa-save-status-error': status === SAVE_STATUS_TYPE.SAVE_ERROR,
      'flex-column': isInputContentError,
      'align-items-center gap-4': !isInputContentError
    })}>
      {isValidElement(children) && cloneElement(children, { callback: handleCallback, onContentChange: handleContentChange })}
      {isFunction(children) && children({ callback: handleCallback, onContentChange: handleContentChange })}
      {isInputContentError ? (
        <div className="text-danger seaqa-input-error-tip">
          {tip}
        </div>
      ) : (
        <>
          {saveStatus}
        </>
      )}
    </div>
  );
});

export default SaveStatus;
