import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
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

  useEffect(() => {
    const handleHiddenPopover = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsShowPopover(false);
      }
    };

    document.addEventListener('click', handleHiddenPopover);
    return () => document.removeEventListener('click', handleHiddenPopover);
  }, []);

  const activeState = useMemo(() => {
    return filters.find(item => item.field === 'state');
  }, [filters]);

  const stateOptions = useMemo(() => {
    const { state = [] } = filterableFieldOptions || {};
    let newState = state;
    if (!activeState || activeState?.value === '--') {
      newState = state.filter(state => state !== '--');
    }
    return newState.map((state) => {
      return {
        label: STATE_LABELS[state],
        name: state,
        value: state,
      };
    });
  }, [filterableFieldOptions, activeState]);

  const label = useMemo(() => {
    if (!activeState || activeState?.value === '--') return gettext('Status');
    return `${gettext('Status')}:${STATE_LABELS[activeState.value]}`;
  }, [activeState]);

  const handleTogglePopover = useCallback(() => {
    if (!isShowPopover) {
      setIsShowPopover(true);
    }
  }, [isShowPopover, setIsShowPopover]);

  const onStateChange = useCallback((value) => {
    handleFilterChange('state', value);
    setIsShowPopover(false);
  }, [handleFilterChange, setIsShowPopover]);

  return (
    <div className="analyze-filter-panel d-flex align-items-center">
      <div className="analyze-add-filter" ref={popoverRef}>
        <div className={classnames('analyze-add-filter-btn', { 'active': isShowPopover })} onClick={handleTogglePopover}>
          <span>{label}</span>
          <Icon symbol="arrow-down" />
        </div>
        {isShowPopover && (
          <OptionEditor
            className="analyze-filter-option-editor"
            options={stateOptions}
            target={popoverRef}
            isSearchEnabled={false}
            value={activeState ? activeState.value : ''}
            onChange={onStateChange}
            onToggle={() => {}}
          />
        )}
      </div>
    </div>
  );
};

export default FilterPanel;
