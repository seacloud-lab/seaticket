import React, { forwardRef, useCallback, useEffect, useState, useImperativeHandle, useMemo, useRef } from 'react';
import axios from 'axios';
import classnames from 'classnames';
import SearchInput from '../../search-input';
import Option from '../../option';
import IconButton from '../../icon-button';
import { gettext, KeyCodes } from '@/constants';
import { Utils } from '@/utils/utils';
import { isFunction } from '@utils/type-detection';
import toaster from '../../toaster';

import './index.css';

const Main = forwardRef(({
  isMultiple = false,
  placeholder,
  emptyTip,
  value: propsValue = '',
  checkPlacement = 'right',
  className,
  optionClassName,
  maxHeight = 200,
  optionHeight = 30,
  onChange,
  onToggle,
  onPressTab,
  onSearch,
}, ref) => {
  const [value, setValue] = useState(propsValue || (isMultiple ? [] : ''));
  const [searchValue, setSearchValue] = useState('');
  const [options, setOptions] = useState([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const displayOptionsRef = useRef(null);
  const abortControllerRef = useRef(null);
  const timer = useRef(null);

  const maxItemNum = useMemo(() => Math.floor(parseInt(maxHeight) / parseInt(optionHeight)) - 1, [maxHeight, optionHeight]);
  const validCheckPlacement = useMemo(() => checkPlacement === 'left' ? 'left' : 'right', [checkPlacement]);

  const onSearchValueChange = useCallback((newSearchValue) => {
    if (searchValue === newSearchValue) return;
    setSearchValue(newSearchValue);
  }, [searchValue]);

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

  const onMenuMouseEnter = useCallback((highlightIndex) => {
    setHighlightIndex(highlightIndex);
  }, []);

  const onMenuMouseLeave = useCallback(() => {
    setHighlightIndex(-1);
  }, []);

  const onEnter = useCallback((event) => {
    event.preventDefault();
    let option;
    if (options.length === 1) {
      option = options[0];
    } else if (highlightIndex > -1) {
      option = options[highlightIndex];
    }
    if (!option) return;
    toggleOption(option.value);
  }, [options, highlightIndex, toggleOption]);

  const onUpArrow = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (highlightIndex === 0) {
      setHighlightIndex(options.length - 1);
      displayOptionsRef.current.scrollTop = 0;
      return;
    }
    setHighlightIndex(highlightIndex - 1);
    if (highlightIndex > options.length - maxItemNum) {
      displayOptionsRef.current.scrollTop -= optionHeight;
    }
  }, [displayOptionsRef, highlightIndex, maxItemNum, options, optionHeight]);

  const onDownArrow = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (highlightIndex === options.length - 1) {
      setHighlightIndex(0);
      displayOptionsRef.current.scrollTop = 0;
      return;
    }
    setHighlightIndex(highlightIndex + 1);
    if (highlightIndex >= maxItemNum) {
      displayOptionsRef.current.scrollTop += optionHeight;
    }
  }, [displayOptionsRef, highlightIndex, maxItemNum, options, optionHeight]);

  const blur = useCallback(() => {
    onChange && onChange();
  }, [onChange]);

  const onEsc = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    blur();
  }, [blur]);

  const onHotKey = useCallback((event) => {
    if (event.keyCode === KeyCodes.Enter) {
      onEnter(event);
    } else if (event.keyCode === KeyCodes.UpArrow) {
      onUpArrow(event);
    } else if (event.keyCode === KeyCodes.DownArrow) {
      onDownArrow(event);
    } else if (event.keyCode === KeyCodes.Tab) {
      if (isFunction(onPressTab)) {
        onPressTab(event);
      }
    } else if (event.keyCode === KeyCodes.Esc) {
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
    const highlightIndex = options.length === 0 ? -1 : 0;
    setHighlightIndex(highlightIndex);
  }, [options]);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    timer.current && clearTimeout(timer.current);

    if (!searchValue) {
      setOptions([]);
      return;
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      onSearch(searchValue, abortControllerRef.current.signal).then(options => {
        setOptions(options);
      }).catch(error => {
        if (!axios.isCancel(error)) {
          const errorMessage = Utils.getErrorMsg(error);
          toaster.danger(this.props.gettext(errorMessage));
        }
      }).finally(() => {
        abortControllerRef.current = null;
      });
    }, 300);
  }, [searchValue, onSearch]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      timer.current && clearTimeout(timer.current);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    getValue: () => {
      return value;
    },
    setValue: (value) => {
      setValue(value);
    }
  }), [value]);

  return (
    <div className={classnames('option-editor-container', className)}>
      <div className="option-editor-search-wrapper">
        <SearchInput
          autoFocus={true}
          value={searchValue}
          size={28}
          placeholder={placeholder}
          onKeyDown={onKeyDown}
          onChange={onSearchValueChange}
          onClear={() => onSearchValueChange('')}
        />
      </div>
      <div
        className={classnames('option-editor-content', { 'empty': options.length === 0 })}
        style={{ maxHeight }}
        ref={displayOptionsRef}
      >
        {options.length === 0 ? (
          <div className="tip-default">
            {searchValue ? emptyTip : gettext('Enter characters to start searching')}
          </div>
        ) : (
          <>
            {options.map((option, i) => {
              const isSelected = value.includes(option.value);
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
    </div>
  );
});

export default Main;
