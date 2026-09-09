import React, { forwardRef, useCallback, useEffect, useState, useImperativeHandle } from 'react';
import classnames from 'classnames';
import { gettext, KeyCodes } from '@/constants';
import { searchOptions } from '@/utils/search';
import { isFunction, isNumber } from '@/utils/type-detection';
import { Utils } from '@/utils/utils';
import CustomizeAddTool from '../../../customize-add-tool';
import SearchInput from '../../../search-input';
import toaster from '../../../toaster';
import Options from '../../options';

import './index.css';

const DEFAULT_SEARCH_HEIGHT = 28;

const Container = forwardRef(({
  id,
  isMultiple = false,
  isAsyncSearch = false,
  isSearchEnabled = true,
  checkPlacement = 'right',
  className,
  optionClassName,
  searchHeight = DEFAULT_SEARCH_HEIGHT,
  placeholder,
  emptyTip = gettext('No options available'),
  value: propsValue = '',
  options = [],
  maxHeight = 240,
  optionHeight = 32,
  children,
  onChange,
  onToggle,
  onCreate,
  onPressTab,
  isShowClearIcon = true,
  isShowSearchIcon = false,
  defaultHighlightIndex = 0,
  addToolText = gettext('Add option'),
}, ref) => {
  const [value, setValue] = useState(propsValue || (isMultiple ? [] : propsValue === 0 ? 0 : ''));
  const [searchValue, setSearchValue] = useState('');
  const [displayOptions, setDisplayOptions] = useState(options);

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

  const handleCreate = useCallback(() => {
    onCreate(searchValue.trim()).then(option => {
      toggleOption(option.value);
    }).catch(error => {
      const errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
    });
  }, [searchValue, onCreate, toggleOption]);

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
    setDisplayOptions(searchOptions(options, searchValue));
  }, [searchValue, options]);

  useImperativeHandle(ref, () => ({
    getValue: () => {
      return value;
    },
    setValue: (value) => {
      setValue(value);
    }
  }), [value]);

  const showCreateBtn = isFunction(onCreate) && searchValue.trim() && !options.find(o => o.name === searchValue.trim());
  let validMaxHeight = maxHeight - (isSearchEnabled ? 26 : 18); // 26: padding-top(12/8) + padding-bottom(12/8) + border(2)
  if (displayOptions.length > 0) {
    // 16px is the padding top and bottom of the options
    validMaxHeight = Math.min(validMaxHeight, displayOptions.length * (isNumber(optionHeight) ? optionHeight : 32) + 16);
  }

  return (
    <div
      id={id}
      className={classnames('options-editor-container', className, {
        'options-editor-container-multiple': isMultiple,
        'options-editor-container-single': !isMultiple,
        'search-enabled': isSearchEnabled,
        'selected-value-display': children,
        'add-search-result-enabled': isSearchEnabled && showCreateBtn,
        'small-size-option': searchHeight <= 30
      })}
    >
      {children && (
        <div className="options-editor-selected-value-wrapper">
          {typeof children === 'function' ? children({ value, onChange: toggleOption }) : children}
        </div>
      )}
      {isSearchEnabled && (
        <div className="options-editor-search-wrapper">
          <SearchInput
            isShowSearchIcon={isShowSearchIcon}
            autoFocus={true}
            value={searchValue}
            size={searchHeight}
            placeholder={placeholder}
            onKeyDown={onKeyDown}
            onChange={onSearchValueChange}
            isShowClearIcon={searchValue ? isShowClearIcon : false}
            onClear={() => setSearchValue('')}
          />
        </div>
      )}
      <Options
        options={displayOptions}
        maxHeight={validMaxHeight}
        isAsyncSearch={isAsyncSearch}
        isSearchEnabled={isSearchEnabled}
        searchValue={searchValue}
        emptyTip={emptyTip}
        value={value}
        checkPlacement={checkPlacement}
        optionHeight={optionHeight}
        optionClassName={optionClassName}
        onToggleOption={toggleOption}
        onPressTab={onPressTab}
        onToggle={onToggle}
        defaultHighlightIndex={defaultHighlightIndex}
      />
      {showCreateBtn && (
        <div className="options-editor-add-tool">
          <CustomizeAddTool
            className={classnames('options-editor-add-search-result')}
            callBack={handleCreate}
          >
            <span>{addToolText}</span>
            <span className="ml-1 font-weight-bold">{searchValue.trim()}</span>
          </CustomizeAddTool>
        </div>
      )}
    </div>
  );
});

export default Container;
