import React, { useCallback, useEffect, useRef, useState } from 'react';
import classnames from 'classnames';
import OptionEditor from '../option-editor';
import Icon from '../icon';
import { Utils } from '@/utils/utils';
import { gettext } from '@/constants';

import '../customize-select/index.css';

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
  const [allOptions, setAllOptions] = useState([]);
  const [isShowSelector, setIShowSelector] = useState(false);

  const ref = useRef(null);

  useEffect(() => {
    if (typeof api !== 'function') {
      setErrorMessage(gettext('Load options failed.'));
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    if (!api) {
      setIsLoading(false);
      return;
    }
    api().then(res => {
      const { options } = res.data || {};
      setAllOptions(Array.isArray(options) ? options : []);
      setErrorMessage('');
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      setErrorMessage(errorMessage);
    }).finally(() => {
      setIsLoading(false);
    });
  }, [api]);

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
    if (errorMessage) return (<span className="error">{errorMessage}</span>);
    const selectOption = allOptions.find(o => o.value === value);
    if (!selectOption) return (<span className="select-placeholder">{placeholder}</span>);
    return (
      <span className="selected-option-show">{selectOption?.label}</span>
    );
  }, [isLoading, errorMessage, value, placeholder, allOptions, openEditor]);

  return (
    <>
      <div
        ref={ref}
        className={classnames('seaqa-select custom-select seaqa-customize-select',
          { 'focus': isShowSelector },
          { 'disabled': disabled || errorMessage },
          className
        )}
        onClick={openEditor}
      >
        <div className='selected-option'>
          {renderSelected()}
          {!disabled && !isLoading && !errorMessage && (<Icon symbol="arrow-down" />)}
        </div>
      </div>
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
    </>
  );
};

export default CustomizeSelectSync;
