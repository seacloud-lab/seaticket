import React, { useCallback, useEffect, useRef, useState, Fragment } from 'react';
import axios from 'axios';
import classnames from 'classnames';
import { Button } from 'reactstrap';
import Icon from '../../icon';
import { Utils } from '@/utils/utils';
import { gettext } from '@/constants';
import SelectTrigger from '../select-trigger';
import ModalPortal from '../../modal-portal';
import Options from '../options';
import { getEventClassName } from '@/utils/dom';

import './index.css';

const RemoteSelect = ({
  disabled,
  value,
  className,
  containerClassName,
  placeholder,
  api,
  isInModal,
  offset,
  onChange,
  searchable,
  searchPlaceholder = gettext('Select option'),
  noOptionsPlaceholder = gettext('No options'),
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [showRetry, setShowRetry] = useState(false);
  const [allOptions, setAllOptions] = useState([]);
  const [isShowSelector, setIsShowSelector] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const selectTriggerRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();

    if (!api) {
      setIsLoading(false);
      return () => controller.abort();
    }
    setIsLoading(true);
    setErrorMessage('');
    api(controller.signal).then(res => {
      if (controller.signal.aborted) return;
      const { options } = res.data || {};
      setAllOptions(Array.isArray(options) ? options : []);
      setErrorMessage('');
      setShowRetry(false);
    }).catch(error => {
      if (controller.signal.aborted || axios.isCancel(error)) return;
      const errorMessage = Utils.getErrorMsg(error);
      setErrorMessage(errorMessage);
      setShowRetry(true);
    }).finally(() => {
      if (controller.signal.aborted) return;
      setIsLoading(false);
    });

    return () => controller.abort();
  }, [api, retryCount]);

  const handleRetry = useCallback((e) => {
    e.stopPropagation();
    setIsLoading(true);
    setErrorMessage('');
    setRetryCount(c => c + 1);
  }, []);

  const handleChange = useCallback((newValue) => {
    if (newValue === value) return;
    const option = allOptions.find(o => o.value === newValue);
    onChange && onChange(newValue, option);
  }, [value, allOptions, onChange]);

  const renderSelected = useCallback(() => {
    if (isLoading) return (<span className="seaqa-tip-default select-placeholder">{gettext('Loading...')}</span>);
    const selectOption = allOptions.find(o => o.value === value);
    if (!selectOption) return (<span className="select-placeholder">{placeholder}</span>);
    return (
      <span className="selected-option-show">{selectOption?.label}</span>
    );
  }, [isLoading, value, placeholder, allOptions]);

  const onToggle = useCallback((event) => {
    if (isLoading || errorMessage || disabled) return;
    event.preventDefault();
    /*
      if select is showing, click events do not need to be monitored by other click events,
      so it can be closed when other select is clicked.
    */
    if (isShowSelector) event.stopPropagation();
    const eventClassName = getEventClassName(event);
    if (disabled ||
      eventClassName.indexOf('seaqa-search-input-wrapper') > -1 ||
      eventClassName.indexOf('seaqa-search-input') > -1 ||
      eventClassName.indexOf('seaqa-clear-icon-button') > -1 ||
      eventClassName.indexOf('seaqa-icon-svg-close') > -1 ||
      eventClassName.indexOf('seaqa-select-options-search-container') > -1)
      return;
    // Prevent closing by pressing the space bar in the search input
    if (event.target.value === '') return;
    setIsShowSelector(pre => !pre);
  }, [isShowSelector, disabled, isLoading, errorMessage]);

  const onClickOutside = useCallback((event) => {
    if (selectTriggerRef.current.contains(event.target)) return;
    setIsShowSelector(false);
  }, []);

  const closeSelector = useCallback(() => {
    setIsShowSelector(false);
  }, []);

  const getTriggerTop = useCallback(() => {
    if (!selectTriggerRef.current) return 38;
    const { height } = selectTriggerRef.current?.getBoundingClientRect() || {};
    return height;
  }, []);

  const getTriggerPosition = useCallback(() => {
    if (!selectTriggerRef.current) return {};
    return selectTriggerRef.current?.getBoundingClientRect() || {};
  }, []);

  const OptionsShell = isInModal ? ModalPortal : Fragment;

  return (
    <div>
      <div className="d-flex align-items-center">
        <SelectTrigger
          innerRef={selectTriggerRef}
          focus={isShowSelector}
          disabled={disabled || !!errorMessage || isLoading}
          className={classnames('flex-1 seaqa-async-select', className)}
          selectedValue={renderSelected()}
          onClick={onToggle}
        >
          {isShowSelector && (
            <OptionsShell>
              <Options
                isInModal={isInModal}
                className={containerClassName}
                offset={offset}
                value={value}
                top={getTriggerTop()}
                position={getTriggerPosition()}
                options={allOptions}
                onChange={handleChange}
                searchable={searchable}
                searchPlaceholder={searchPlaceholder}
                noOptionsPlaceholder={noOptionsPlaceholder}
                onClickOutside={onClickOutside}
                closeSelector={closeSelector}
                supportMultipleSelect={false}
              />
            </OptionsShell>
          )}
        </SelectTrigger>
        {showRetry && (
          <Button
            type="button"
            color="secondary"
            className="ml-2 seaqa-customize-async-select-retry"
            disabled={isLoading}
            title={gettext('Retry')}
            aria-label={gettext('Retry')}
            onClick={isLoading ? undefined : handleRetry}
          >
            <Icon symbol="refresh" />
          </Button>
        )}
      </div>
      {errorMessage && (
        <div className="error mt-2">{errorMessage}</div>
      )}
    </div>
  );
};

export default RemoteSelect;
