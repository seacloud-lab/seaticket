import React, { useState, useRef, useCallback, useMemo } from 'react';
import { gettext } from '@/constants';
import { Icon, OptionEditor } from '@/components';
import classnames from 'classnames';

import './index.css';

const FilterPanel = ({ filters, filterableFieldOptions, onAddFilter, onRemoveFilter }) => {
  const [selectedState, setSelectedState] = useState('');
  const [isShowPopover, setIsShowPopover] = useState(false);
  const popoverRef = useRef(null);

  const isDisabled = Object.keys(filterableFieldOptions).length === 0;
  const isActive = filters.length > 0;

  const options = useMemo(() => {
    const { state = [] } = filterableFieldOptions || {};
    return state.map((state) => {
      return {
        label: state,
        name: state,
        value: state,
      };
    });
  }, [filterableFieldOptions]);

  const handleTogglePopover = useCallback(() => {
    if (isDisabled) return;
    if (!isShowPopover) {
      setIsShowPopover(true);
    }
  }, [isShowPopover, isDisabled, setIsShowPopover]);

  const handleSelectValue = useCallback((value) => {
    if (value) {
      onAddFilter('state', value);
    } else {
      onRemoveFilter('state');
    }
    setSelectedState(value);
    setIsShowPopover(false);
  }, [onAddFilter, onRemoveFilter, setSelectedState, setIsShowPopover]);

  return (
    <div className="analyze-filter-panel">
      <div className="analyze-add-filter" ref={popoverRef}>
        <div className={classnames('analyze-add-filter-btn', { 'active': isActive, 'disabled': isDisabled })} onClick={handleTogglePopover}>
          <span>{gettext('Status')}</span>
          <Icon symbol="arrow-down" />
        </div>
        {isShowPopover && (
          <OptionEditor
            className="analyze-filter-option-editor"
            options={options}
            target={popoverRef}
            checkPlacement="left"
            isSearchEnabled={false}
            value={selectedState}
            onChange={handleSelectValue}
            onToggle={() => setIsShowPopover(false)}
          />
        )}
      </div>
    </div>
  );
};

export default FilterPanel;
