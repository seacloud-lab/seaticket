import React, { useCallback, useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import { Button } from 'reactstrap';
import OptionEditor from '../option-editor';
import Icon from '../icon';
import { Utils } from '@/utils/utils';
import { gettext } from '@/constants';

import '../customize-select/index.css';
import './index.css';

const CustomizeSelectSync = ({
  disabled,
  value,
  className,
  placeholder,
  api,
  onChange,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [showRetry, setShowRetry] = useState(false);
  const [allOptions, setAllOptions] = useState([]);
  const [isShowSelector, setIShowSelector] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const ref = useRef(null);

  useEffect(() => {
    if (!api) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    api().then(res => {
      const { options } = res.data || {};
      setAllOptions(Array.isArray(options) ? options : []);
      setErrorMessage('');
      setShowRetry(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      setErrorMessage(errorMessage);
      setShowRetry(true);
    }).finally(() => {
      setIsLoading(false);
    });
  }, [api, retryCount]);

  const handleRetry = useCallback((e) => {
    e.stopPropagation();
    setIsLoading(true);
    setErrorMessage('');
    setRetryCount(c => c + 1);
  }, []);

  const openEditor = useCallback(() => {
    if (isLoading || errorMessage) return;
    setIShowSelector(true);
  }, [isLoading, errorMessage]);

  const handleChange = useCallback((newValue) => {
    if (newValue === value) return;
    const option = allOptions.find(o => o.value === newValue);
    onChange && onChange(option);
  }, [value, allOptions, onChange]);

  const renderSelected = useCallback(() => {
    if (isLoading) return (<span className="seaqa-tip-default select-placeholder">{gettext('Loading...')}</span>);
    const selectOption = allOptions.find(o => o.value === value);
    if (!selectOption) return (<span className="select-placeholder">{placeholder}</span>);
    return (
      <span className="selected-option-show">{selectOption?.label}</span>
    );
  }, [isLoading, value, placeholder, allOptions]);

  return (
    <div>
      <div className="d-flex align-items-center">
        <div
          ref={ref}
          className={classnames('seaqa-select custom-select seaqa-customize-select',
            { 'focus': isShowSelector },
            { 'disabled': disabled || !!errorMessage },
            className
          )}
          style={{ flex: 1, minWidth: 0 }}
          onClick={openEditor}
        >
          <div className='selected-option'>
            {renderSelected()}
            {!disabled && !isLoading && (<Icon symbol="arrow-down" />)}
          </div>
        </div>
        {showRetry && (
          <Button
            type="button"
            color="secondary"
            className="ml-2 seaqa-customize-select-sync-retry"
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
        <div className="seaqa-customize-select-sync-error mt-2">{errorMessage}</div>
      )}
      {!disabled && isShowSelector && (
        <OptionEditor
          className="seaqa-settings-popover"
          target={ref}
          sameWidthWithTarget={240}
          isMultiple={false}
          isSearchEnabled={true}
          value={value}
          options={allOptions}
          onChange={handleChange}
          onToggle={() => setIShowSelector(false)}
        />
      )}
    </div>
  );
};

export default CustomizeSelectSync;
