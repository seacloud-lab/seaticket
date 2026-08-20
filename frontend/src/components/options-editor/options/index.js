import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import classnames from 'classnames';
import Tip from '../tip';
import { isFunction, isNumber } from '@/utils/type-detection';
import { isEsc, isEnter, isUpArrow, isDownArrow, isTab } from '@/utils/hotkey';
import CenteredLoading from '../../centered-loading';
import Option from './option';

import './index.css';

const Options = ({
  isLoading = false,
  displayOptions = [],
  options = [],
  maxHeight,
  isAsyncSearch,
  searchValue,
  emptyTip,
  value,
  checkPlacement,
  optionHeight,
  optionClassName,
  onToggleOption,
  onPressTab,
  onToggle,
  defaultHighlightIndex = -1,
}) => {
  const maxItemNum = useMemo(() => isNumber(optionHeight) ? Math.floor(parseInt(maxHeight) / parseInt(optionHeight)) - 1 : 30, [maxHeight, optionHeight]);

  const optionsRef = useRef(null);

  const [highlightIndex, setHighlightIndex] = useState(defaultHighlightIndex);

  const onOptionMouseEnter = useCallback((highlightIndex) => {
    setHighlightIndex(highlightIndex);
  }, []);

  const onOptionMouseLeave = useCallback(() => {
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
    if (!option || option.disabled) return;
    onToggleOption(option.value);
  }, [displayOptions, highlightIndex, onToggleOption]);

  const getEnabledIndex = useCallback((startIndex, step) => {
    let index = startIndex;
    while (index >= 0 && index < displayOptions.length) {
      if (!displayOptions[index].disabled) return index;
      index += step;
    }
    return -1;
  }, [displayOptions]);

  const displayOptionsLength = displayOptions.length;

  const onUpArrow = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const nextIndex = getEnabledIndex(highlightIndex - 1, -1);
    if (nextIndex > -1) {
      setHighlightIndex(nextIndex);
      if (nextIndex < displayOptionsLength - maxItemNum) {
        optionsRef.current.scrollTop -= (isNumber(optionHeight) ? optionHeight : 30);
      }
    } else {
      setHighlightIndex(getEnabledIndex(displayOptionsLength - 1, -1));
      optionsRef.current.scrollTop = optionsRef.current.scrollHeight;
    }
  }, [highlightIndex, maxItemNum, displayOptionsLength, optionHeight, getEnabledIndex]);

  const onDownArrow = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const nextIndex = getEnabledIndex(highlightIndex + 1, 1);
    if (nextIndex > -1) {
      setHighlightIndex(nextIndex);
      if (nextIndex >= maxItemNum) {
        optionsRef.current.scrollTop += (isNumber(optionHeight) ? optionHeight : 30);
      }
    } else {
      setHighlightIndex(getEnabledIndex(0, 1));
      optionsRef.current.scrollTop = 0;
    }
  }, [highlightIndex, maxItemNum, optionHeight, getEnabledIndex]);

  const onEsc = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    onToggle && onToggle();
  }, [onToggle]);

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

  useEffect(() => {
    document.addEventListener('keydown', onHotKey, true);
    return () => {
      document.removeEventListener('keydown', onHotKey, true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onHotKey]);

  useEffect(() => {
    setHighlightIndex(defaultHighlightIndex);
  }, [displayOptions, defaultHighlightIndex]);

  return (
    <div
      className={classnames('options-editor-content', { 'empty': displayOptions.length === 0 })}
      style={{ maxHeight, minHeight: isNumber(optionHeight) ? optionHeight : 20 }}
      ref={optionsRef}
    >
      {isLoading && (
        <CenteredLoading style={{ minHeight: '100px' }} />
      )}
      {!isLoading && displayOptions.length === 0 && (
        <Tip isAsyncSearch={isAsyncSearch} height={optionHeight} options={options} searchValue={searchValue} tip={emptyTip}/>
      )}
      {!isLoading && displayOptions.length > 0 && (
        <>
          {displayOptions.map((option, i) => {
            const isSelected = value && Array.isArray(value) ? value.includes(option.value) : value === option.value;
            return (
              <Option
                key={option.value}
                className={optionClassName}
                checkPlacement={checkPlacement}
                highlight={highlightIndex === i}
                isSelected={isSelected}
                option={option}
                height={optionHeight}
                index={i}
                onChange={onToggleOption}
                onMouseEnter={onOptionMouseEnter}
                onMouseLeave={onOptionMouseLeave}
              />
            );
          })}
        </>
      )}
    </div>
  );
};

export default Options;
