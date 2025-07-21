import React, { useCallback, useRef, useState } from 'react';
import CustomizePopover from '../customize-popover';
import SearchInput from '../search-input';
import Option from '../option';
import { searchOptions } from '../../utils/search';
import IconButton from '../icon-button';

import './index.css';

const OptionsEditor = ({
  target,
  isMultiple = false,
  placeholder,
  emptyTip,
  value: propsValue = '',
  options = [],
  onChange,
  onClose,
}) => {
  const [value, setValue] = useState(propsValue);
  const [searchValue, setSearchValue] = useState('');

  const displayOptions = useRef(options);

  const onSearchValueChange = useCallback((newSearchValue) => {
    if (searchValue === newSearchValue) return;
    displayOptions.current = searchOptions(options, newSearchValue);
    setSearchValue(newSearchValue);
  }, [options, searchValue]);

  const toggleOption = useCallback((optionID) => {
    const newValue = optionID === value ? '' : optionID;
    setValue(newValue);
    if (!isMultiple) {
      onChange(newValue);
      onClose();
    }
  }, [isMultiple, value, onChange, onClose]);

  const handleClose = useCallback(() => {
    if (isMultiple) {
      onChange(value);
    }
    onClose();
  }, [isMultiple, value, onChange, onClose]);

  return (
    <CustomizePopover
      target={target}
      popoverClassName="option-editor-popover"
      hidePopover={handleClose}
      hidePopoverWithEsc={handleClose}
    >
      <div className="option-editor-container">
        <div className="option-editor-search-wrapper">
          <SearchInput isShowSearchIcon={false} value={searchValue} size={28} placeholder={placeholder} onChange={onSearchValueChange} />
        </div>
        <div className="option-editor-content">
          {displayOptions.current.length === 0 ? (
            <div className="tip-default p-4">{emptyTip}</div>
          ) : (
            <>
              {displayOptions.current.map(option => {
                const isSelected = value.includes(option.id);
                return (
                  <div className="option-editor-option" key={option.id} onClick={() => toggleOption(option.id)}>
                    <Option option={option} />
                    <IconButton icon={isSelected ? 'check-mark' : ''} className="no-hover-bg" />
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </CustomizePopover>

  );
};

export default OptionsEditor;
