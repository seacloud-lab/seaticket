import React, { useCallback, useEffect, useState } from 'react';
import classnames from 'classnames';
import CustomizePopover from '../customize-popover';
import SearchInput from '../search-input';
import Option from '../option';
import { searchOptions } from '../../utils/search';
import IconButton from '../icon-button';
import CustomizeAddTool from '../customize-add-tool';

import './index.css';
import { gettext } from '../../constants';
import { Utils } from '../../utils/utils';
import toaster from '../toaster';

const OptionsEditor = ({
  target,
  isLoading = false,
  isMultiple = false,
  placeholder,
  emptyTip,
  value: propsValue = '',
  className,
  options = [],
  onChange,
  onToggle,
  onCreate,
}) => {
  const [value, setValue] = useState(propsValue);
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
      return;
    }
    const newValue = optionValue === value ? '' : optionValue;
    setValue(newValue);
    onChange(newValue);
    onToggle();
  }, [isMultiple, value, onChange, onToggle]);

  const handleClose = useCallback(() => {
    if (isMultiple) {
      onChange(value);
    }
    onToggle();
  }, [isMultiple, value, onChange, onToggle]);

  const handleCreate = useCallback(() => {
    onCreate(searchValue.trim()).then(option => {
      toggleOption(option.value);
    }).catch(error => {
      const errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
    });
  }, [searchValue, onCreate, toggleOption]);

  useEffect(() => {
    const displayOptions = searchOptions(options, searchValue);
    setDisplayOptions(displayOptions);
  }, [isLoading, searchValue, options]);

  return (
    <CustomizePopover
      target={target}
      className={classnames('option-editor-popover', className)}
      hidePopover={handleClose}
      hidePopoverWithEsc={handleClose}
    >
      <div className="option-editor-container">
        <div className="option-editor-search-wrapper">
          <SearchInput isShowSearchIcon={false} value={searchValue} size={28} placeholder={placeholder} onChange={onSearchValueChange} />
        </div>
        <div className="option-editor-content">
          {displayOptions.length === 0 ? (
            <div className="tip-default p-4">{emptyTip}</div>
          ) : (
            <>
              {displayOptions.map(option => {
                const isSelected = value.includes(option.value);
                return (
                  <div className="option-editor-option" key={option.value} onClick={() => toggleOption(option.value)}>
                    {option.label ? option.label : (<Option option={option} />)}
                    <IconButton icon={isSelected ? 'check-mark' : ''} className="no-hover-bg" />
                  </div>
                );
              })}
            </>
          )}
        </div>
        {onCreate && searchValue.trim() && !options.find(o => o.name === searchValue.trim()) && (
          <CustomizeAddTool className="option-editor-add-search-result" name={`${gettext('Create new tag')} ${searchValue.trim()}`} callBack={handleCreate} />
        )}
      </div>
    </CustomizePopover>
  );
};

export default OptionsEditor;
