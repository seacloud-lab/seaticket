import React, { forwardRef, useCallback, useEffect, useState, useImperativeHandle } from 'react';
import classnames from 'classnames';
import SearchInput from '../../search-input';
import { searchOptions } from '@/utils/search';
import CustomizeAddTool from '../../customize-add-tool';
import { gettext, KeyCodes } from '@/constants';
import { Utils } from '@/utils/utils';
import toaster from '../../toaster';
import Options from '../options';
import { isFunction, isNumber } from '@/utils/type-detection';

import './index.css';

const SEARCH_SIZE = 30;

const OptionEditorContainer = forwardRef(({
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
  maxHeight = 240,
  optionHeight = 32,
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
    validMaxHeight = Math.min(validMaxHeight, displayOptions.length * (isNumber(optionHeight) ? optionHeight : 32));
  }

  return (
    <div
      id={id}
      className={classnames('option-editor-container', className, {
        'search-enabled': isSearchEnabled,
        'selected-value-display': children,
        'add-search-result-enabled': isSearchEnabled && showCreateBtn,
        'small-size-option': SEARCH_SIZE <= 30
      })}
    >
      {children && (
        <div className="option-editor-selected-value-wrapper">
          {typeof children === 'function' ? children({ value, onChange: toggleOption }) : children}
        </div>
      )}
      {isSearchEnabled && (
        <div className="option-editor-search-wrapper">
          <SearchInput
            isShowSearchIcon={false}
            autoFocus={true}
            value={searchValue}
            size={SEARCH_SIZE}
            placeholder={placeholder}
            onKeyDown={onKeyDown}
            onChange={onSearchValueChange}
          />
        </div>
      )}
      <Options
        hasAvailableOptions={options.length > 0}
        options={displayOptions}
        maxHeight={validMaxHeight}
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
      />
      {showCreateBtn && (
        <CustomizeAddTool
          className={classnames('option-editor-add-search-result', { 'mt-2': displayOptions.length === 0 })}
          name={`${addToolText} ${searchValue.trim()}`}
          callBack={handleCreate}
        />
      )}
    </div>
  );
});

export default OptionEditorContainer;
