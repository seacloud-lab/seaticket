import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import classnames from 'classnames';
import Icon from '../icon';
import OptionsEditor from '../options-editor';

import './index.css';

const FilterSelect = ({
  isShowEmptyOption = true,
  isSmall = false,
  value,
  title,
  options: initOptions,
  className,
  onChange,
}) => {
  const [isShowSelector, setIsShowSelector] = useState(false);

  const selectorRef = useRef(null);

  const options = useMemo(() => {
    let _options = Array.isArray(initOptions) ? initOptions.slice(0) : [];
    if (value && isShowEmptyOption) {
      _options.unshift({
        value: '',
        label: '--',
      });
    }
    return _options;
  }, [value, isShowEmptyOption, initOptions]);

  const openSelector = useCallback(() => {
    if (isShowSelector) return;
    setIsShowSelector(true);
  }, [isShowSelector]);

  const handleChange = useCallback((newValue) => {
    onChange && onChange(newValue);
    setIsShowSelector(false);
  }, [onChange]);

  useEffect(() => {
    const handleHiddenPopover = (e) => {
      if (selectorRef.current && !selectorRef.current.contains(e.target)) {
        setIsShowSelector(false);
      }
    };

    document.addEventListener('click', handleHiddenPopover);
    return () => document.removeEventListener('click', handleHiddenPopover);
  }, []);

  return (
    <>
      <div
        className={classnames('seaqa-filter-select-trigger', className, {
          'highlighted': value && value !== '--',
          'seaqa-filter-select-trigger-small': isSmall
        })}
        onClick={openSelector}
        ref={selectorRef}
      >
        <span>{title}</span>
        <Icon symbol="arrow-down" />
      </div>
      {isShowSelector && (
        <OptionsEditor
          className="seaqa-filter-selector"
          options={options}
          target={selectorRef}
          isSearchEnabled={false}
          value={value}
          onChange={handleChange}
          onToggle={() => {}}
        />
      )}
    </>
  );
};

export default FilterSelect;
