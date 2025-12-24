import React, { forwardRef, useCallback, useEffect, useState, useImperativeHandle, useMemo, useRef } from 'react';
import classnames from 'classnames';
import SearchInput from '../../search-input';
import Option from '../../option';
import { searchOptions } from '@/utils/search';
import IconButton from '../../icon-button';
import CustomizeAddTool from '../../customize-add-tool';
import { gettext, KeyCodes } from '@/constants';
import { Utils } from '@/utils/utils';
import { isFunction } from '@/utils/type-detection';
import toaster from '../../toaster';
import { isEsc, isEnter, isUpArrow, isDownArrow, isTab } from '@/utils/hotkey';

import './index.css';

const Main = forwardRef(({
  id,
  isMultiple = false,
  isSearchEnabled = true,
  checkPlacement = 'right',
  className,
  optionClassName,
  placeholder,
  emptyTip = gettext('No options available'),
  value: propsValue = '',
  options = [],
  maxHeight = 200,
  optionHeight = 30,
  children,
  onChange,
  onToggle,
  onCreate,
  onPressTab,
  addToolText = gettext('Add tag'),
}, ref) => {
  const [value, setValue] = useState(propsValue || (isMultiple ? [] : ''));
  const [searchValue, setSearchValue] = useState('');
  const [displayOptions, setDisplayOptions] = useState(options);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const displayOptionsRef = useRef(null);

  const maxItemNum = useMemo(() => Math.floor(parseInt(maxHeight) / parseInt(optionHeight)) - 1, [maxHeight, optionHeight]);
  const validCheckPlacement = useMemo(() => checkPlacement === 'left' ? 'left' : 'right', [checkPlacement]);

  const onSearchValueChange = useCallback((newSearchValue) => {
    if (searchValue === newSearchValue) return;
    setSearchValue(newSearchValue);
  }, [options, searchValue]);

  const toggleOption = useCallback((optionValue) => {
    if (isMultiple) {
      let newValue = Array.isArray(value) ? value.slice(0) : [];
      const optionIndex = newValue.findIndex(v => v === optionValue);
      if (optionIndex === -1) {
        newValue.push(optionValue);
      } else {
        newValue.splice(optionIndex, 1);
      }
      setValue(newValue);
      onChange && onChange(newValue);
      return;
    }
    const newValue = optionValue === value ? '' : optionValue;
    setValue(newValue);
    onChange && onChange(newValue);
    onToggle && onToggle();
  }, [isMultiple, value, onChange, onToggle]);

  const handleCreate = useCallback(() => {
    onCreate(searchValue.trim()).then(option => {
      toggleOption(option.value);
    }).catch(error => {
      const errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
    });
  }, [searchValue, onCreate, toggleOption]);

  const onMenuMouseEnter = useCallback((highlightIndex) => {
    setHighlightIndex(highlightIndex);
  }, []);

  const onMenuMouseLeave = useCallback(() => {
    setHighlightIndex(-1);
  }, []);

  const onEnter = useCallback((event) => {
    event.preventDefault();
    let option;
    if (displayOptions.length === 1) {
      option = displayOptions[0];
    } else if (highlightIndex > -1) {
      option = displayOptions[highlightIndex];
    }
    if (!option) return;
    toggleOption(option.value);
  }, [displayOptions, highlightIndex, toggleOption]);

  const onUpArrow = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (highlightIndex > 0) {
      setHighlightIndex(highlightIndex - 1);
      if (highlightIndex < displayOptions.length - maxItemNum) {
        displayOptionsRef.current.scrollTop -= optionHeight;
      }
    } else {
      setHighlightIndex(displayOptions.length - 1);
      displayOptionsRef.current.scrollTop = displayOptionsRef.current.scrollHeight;
    }
  }, [displayOptionsRef, highlightIndex, maxItemNum, displayOptions, optionHeight]);

  const onDownArrow = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (highlightIndex < displayOptions.length - 1) {
      setHighlightIndex(highlightIndex + 1);
      if (highlightIndex >= maxItemNum) {
        displayOptionsRef.current.scrollTop += optionHeight;
      }
    } else {
      setHighlightIndex(0);
      displayOptionsRef.current.scrollTop = 0;
    }
  }, [displayOptionsRef, highlightIndex, maxItemNum, displayOptions, optionHeight]);

  const blur = useCallback(() => {
    onChange && onChange();
  }, [onChange]);

  const onEsc = useCallback((event) => {
    blur();
  }, [blur]);

  const onHotKey = useCallback((event) => {
    if (isEnter(event)) {
      onEnter(event);
    } else if (isUpArrow(event)) {
      onUpArrow(event);
    } else if (isDownArrow(event)) {
      onDownArrow(event);
    } else if (isTab(event)) {
      if (isFunction(onPressTab)) {
        onPressTab(event);
      }
    } else if (isEsc(event)) {
      onEsc(event);
    }
  }, [onEnter, onUpArrow, onDownArrow, onPressTab, onEsc]);

  const onKeyDown = useCallback((event) => {
    if (
      event.keyCode === KeyCodes.ChineseInputMethod ||
      event.keyCode === KeyCodes.LeftArrow ||
      event.keyCode === KeyCodes.RightArrow
    ) {
      event.stopPropagation();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', onHotKey, true);
    return () => {
      document.removeEventListener('keydown', onHotKey, true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onHotKey]);

  useEffect(() => {
    // Reset highlight index
    setHighlightIndex(-1);
  }, [displayOptions]);

  useEffect(() => {
    const displayOptions = searchOptions(options, searchValue);
    setDisplayOptions(displayOptions);
  }, [searchValue, options]);

  useImperativeHandle(ref, () => ({
    getValue: () => {
      return value;
    },
    setValue: (value) => {
      setValue(value);
    }
  }), [value]);

  return (
    <div id={id} className={classnames('option-editor-container', className)}>
      {children && (
        <div className="option-editor-selected-value-wrapper">
          {children}
        </div>
      )}
      {isSearchEnabled && (
        <div className="option-editor-search-wrapper">
          <SearchInput
            isShowSearchIcon={false}
            autoFocus={true}
            value={searchValue}
            size={28}
            placeholder={placeholder}
            onKeyDown={onKeyDown}
            onChange={onSearchValueChange}
          />
        </div>
      )}
      <div
        className={classnames('option-editor-content', { 'empty': displayOptions.length === 0 })}
        style={{ maxHeight }}
        ref={displayOptionsRef}
      >
        {displayOptions.length === 0 ? (
          <div className="tip-default">{emptyTip}</div>
        ) : (
          <>
            {displayOptions.map((option, i) => {
              const isSelected = value && Array.isArray(value) ? value.includes(option.value) : value === option.value;
              return (
                <div
                  className={classnames('option-editor-option', optionClassName, {
                    'active': highlightIndex === i,
                    [`check-placement-${validCheckPlacement}`]: validCheckPlacement
                  })}
                  key={option.value}
                  onClick={() => toggleOption(option.value)}
                  onMouseEnter={() => onMenuMouseEnter(i)}
                  onMouseLeave={() => onMenuMouseLeave(i)}
                >
                  {validCheckPlacement === 'right' ? (
                    <>
                      {option.label ? option.label : (<Option option={option} />)}
                      <IconButton icon={isSelected ? 'check' : ''} className="no-hover-bg" />
                    </>
                  ) : (
                    <>
                      <IconButton icon={isSelected ? 'check' : ''} className="no-hover-bg" />
                      {option.label ? option.label : (<Option option={option} />)}
                    </>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
      {onCreate && searchValue.trim() && !options.find(o => o.name === searchValue.trim()) && (
        <CustomizeAddTool
          className="option-editor-add-search-result"
          name={`${addToolText} ${searchValue.trim()}`}
          callBack={handleCreate}
        />
      )}
    </div>
  );
});

export default Main;
