import React, { forwardRef, cloneElement, isValidElement, useCallback, useEffect, useRef, useState, useImperativeHandle } from 'react';
import classnames from 'classnames';
import IconTooltip from '@/components/icon-tooltip';
import { gettext } from '@/constants';
import { isFunction } from '@/utils/type-detection';
import { SAVE_STATUS_TYPE, SAVE_STATUS } from './constants';

import './index.css';

const SaveStatus = forwardRef(({ isValidChanged = true, className, children, callback }, ref) => {
  const [status, setStatus] = useState('');
  const [tip, setTip] = useState('');
  const previousIsValidChanged = useRef(isValidChanged);

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

  useEffect(() => {
    const wasValidChanged = previousIsValidChanged.current;
    previousIsValidChanged.current = isValidChanged;
    if (wasValidChanged && !isValidChanged && status === SAVE_STATUS_TYPE.SAVE_ERROR) {
      updateStatus('');
    }
  }, [isValidChanged, status, updateStatus]);

  const handleCallback = useCallback((update) => {
    if (isValidChanged) updateStatus(SAVE_STATUS_TYPE.SAVING);
    callback && callback((isSuccess, tip) => {
      if (isSuccess === undefined) {
        updateStatus('');
        return;
      }
      const nextStatus = isSuccess ? SAVE_STATUS_TYPE.SAVED : SAVE_STATUS_TYPE.SAVE_ERROR;
      updateStatus(nextStatus, isSuccess ? gettext('Saved') : tip);
    }, update);
  }, [isValidChanged, callback, updateStatus]);

  useImperativeHandle(ref, () => ({
    setStatus: updateStatus,
  }), [updateStatus]);

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
