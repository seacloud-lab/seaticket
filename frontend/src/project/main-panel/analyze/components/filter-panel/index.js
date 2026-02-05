import React, { useState, useRef, useCallback, useMemo } from 'react';
import { gettext } from '@/constants';
import { Icon, OptionEditor } from '@/components';
import classnames from 'classnames';

import './index.css';

const STATE_LABELS = {
  open: gettext('Open'),
  closed: gettext('Closed'),
  '--': '--',
};

const FilterPanel = ({ filters, filterableFieldOptions, handleFilterChange }) => {
  const [isShowPopover, setIsShowPopover] = useState(false);
  const popoverRef = useRef(null);

  const state = useMemo(() => {
    return filters.find(item => item.field === 'state');
  }, [filters]);

  const stateOptions = useMemo(() => {
    const { state = [] } = filterableFieldOptions || {};
    return state.map((state) => {
      return {
        label: STATE_LABELS[state],
        name: state,
        value: state,
      };
    });
  }, [filterableFieldOptions]);

  const isDisabled = useMemo(() => {
    const { state = [] } = filterableFieldOptions || {};
    return state.length === 0 ? true : false;
  }, [filterableFieldOptions]);

  const handleTogglePopover = useCallback(() => {
    if (isDisabled) return;
    if (!isShowPopover) {
      setIsShowPopover(true);
    }
  }, [isShowPopover, isDisabled, setIsShowPopover]);

  const onStateChange = useCallback((value) => {
    handleFilterChange('state', value);
    setIsShowPopover(false);
  }, [handleFilterChange, setIsShowPopover]);

  return (
    <div className="analyze-filter-panel">
      <div className="analyze-add-filter" ref={popoverRef}>
        <div className={classnames('analyze-add-filter-btn', { 'active': state, 'disabled': isDisabled })} onClick={handleTogglePopover}>
          <span>{gettext('Status')}</span>
          <Icon symbol="arrow-down" />
        </div>
        {isShowPopover && (
          <OptionEditor
            className="analyze-filter-option-editor"
            options={stateOptions}
            target={popoverRef}
            checkPlacement="left"
            isSearchEnabled={false}
            value={state ? state.value : ''}
            onChange={onStateChange}
            onToggle={() => setIsShowPopover(false)}
          />
        )}
      </div>
    </div>
  );
};

export default FilterPanel;
