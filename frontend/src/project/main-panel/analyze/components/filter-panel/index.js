import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import dayjs from '@/sea-metadata/utils/dayjs';
import { gettext } from '@/constants';
import { Icon, OptionEditor } from '@/components';
import classnames from 'classnames';
import { getDurationLabel, buildPresetRange, isDisabledPreset } from './utils';
import { presetLabelMapping, DATE_FORMAT } from './constants';

import './index.css';

const STATE_LABELS = {
  open: gettext('Open'),
  closed: gettext('Closed'),
  '--': '--',
};

const FilterPanel = ({
  filters,
  filterableFieldOptions,
  handleFilterChange,
  baseStartDate,
  baseEndDate,
  startDate,
  endDate,
  onDateFilterChange,
}) => {
  const [isShowPopover, setIsShowPopover] = useState(false);
  const [isShowPresetPopover, setIsShowPresetPopover] = useState(false);
  const popoverRef = useRef(null);
  const presetPopoverRef = useRef(null);

  useEffect(() => {
    const handleHiddenPopover = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsShowPopover(false);
      }
      if (presetPopoverRef.current && !presetPopoverRef.current.contains(e.target)) {
        setIsShowPresetPopover(false);
      }
    };

    document.addEventListener('click', handleHiddenPopover);
    return () => document.removeEventListener('click', handleHiddenPopover);
  }, []);

  const activeState = useMemo(() => {
    return filters.find(item => item.field === 'state');
  }, [filters]);

  const dateMarks = useMemo(() => {
    const parsedStart = dayjs(baseStartDate);
    const parsedEnd = dayjs(baseEndDate);
    if (!parsedStart || !parsedEnd) return [];

    const marks = [];
    let cursor = parsedStart;
    while (cursor.isBefore(parsedEnd) || cursor.isSame(parsedEnd, 'day')) {
      marks.push(cursor.format(DATE_FORMAT));
      cursor = cursor.add(1, 'day');
    }
    return marks;
  }, [baseStartDate, baseEndDate]);

  const maxIndex = dateMarks.length > 0 ? dateMarks.length - 1 : 0;

  const selectedRange = useMemo(() => {
    return {
      startIndex: Math.max(dateMarks.indexOf(startDate), 0),
      endIndex: Math.max(dateMarks.indexOf(endDate), 0),
      startDate,
      endDate,
    };
  }, [dateMarks, maxIndex, startDate, endDate]);

  const selectedPresetValue = useMemo(() => {
    const { startIndex, endIndex, startDate, endDate } = selectedRange;

    const days = endIndex - startIndex + 1;
    if (days === dateMarks.length) return 'all';

    const isYTD = dayjs(endDate).diff(dayjs(startDate), 'year', true) === 1;
    if (isYTD) return 'YTD';

    return `${days}D`;
  }, [selectedRange, dateMarks]);

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

  const presetOptions = useMemo(() => {
    return Object.keys(presetLabelMapping).map((preset) => ({
      label: presetLabelMapping[preset],
      name: preset,
      value: preset,
      disabled: isDisabledPreset(preset, baseStartDate, baseEndDate),
    }));
  }, [presetLabelMapping, baseStartDate, baseEndDate]);

  const stateLabel = useMemo(() => {
    if (!activeState || activeState?.value === '--') return gettext('Status');
    return `${gettext('Status')}:${STATE_LABELS[activeState.value]}`;
  }, [activeState]);

  const rangeLabel = useMemo(() => {
    return getDurationLabel(selectedRange.startDate, selectedRange.endDate);
  }, [selectedRange]);

  const sliderStyle = useMemo(() => {
    const total = Math.max(maxIndex, 1);
    const startPercent = (selectedRange.startIndex / total) * 100;
    const endPercent = (selectedRange.endIndex / total) * 100;
    return {
      left: `${startPercent}%`,
      width: `${Math.max(endPercent - startPercent, 0)}%`,
    };
  }, [selectedRange, maxIndex]);

  const handleTogglePopover = useCallback(() => {
    if (!isShowPopover) {
      setIsShowPopover(true);
    }
  }, [isShowPopover]);

  const onStateChange = useCallback((value) => {
    handleFilterChange('state', value);
    setIsShowPopover(false);
  }, [handleFilterChange]);

  const handleStartChange = useCallback((event) => {
    const curIndex = event.target.value;
    const startIndex = Math.min(curIndex, selectedRange.endIndex);
    const endIndex = Math.max(curIndex, selectedRange.endIndex);
    onDateFilterChange(dateMarks[startIndex], dateMarks[endIndex]);
  }, [maxIndex, selectedRange.endIndex]);

  const handleEndChange = useCallback((event) => {
    const curIndex = event.target.value;
    const startIndex = Math.min(selectedRange.startIndex, curIndex);
    const endIndex = Math.max(selectedRange.startIndex, curIndex);
    onDateFilterChange(dateMarks[startIndex], dateMarks[endIndex]);
  }, [maxIndex, selectedRange.startIndex]);

  const handlePresetChange = useCallback((preset) => {
    if (!preset) return;
    const presetRange = buildPresetRange(preset, baseStartDate, baseEndDate);
    onDateFilterChange(presetRange.startDate, presetRange.endDate);
    setIsShowPresetPopover(false);
  }, [onDateFilterChange, baseStartDate, baseEndDate]);

  const isShowDateRange = !!baseStartDate && !!baseEndDate;

  return (
    <div className="analyze-filter-panel d-flex align-items-end">
      <div className="analyze-add-filter" ref={popoverRef}>
        <div className={classnames('analyze-add-filter-btn', { 'active': isShowPopover })} onClick={handleTogglePopover}>
          <span>{stateLabel}</span>
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
            modifiers={[
              {
                name: 'offset',
                options: {
                  offset: [0, 4],
                }
              }
            ]}
          />
        )}
      </div>
      {isShowDateRange && (
        <>
          <div className="analyze-filter-divider"></div>
          <div className="analyze-date-filter">
            <span className="analyze-date-filter-start-label">{selectedRange.startDate || '--'}</span>
            <div className="analyze-date-filter-slider">
              <div className="analyze-date-filter-track" />
              <div className="analyze-date-filter-track-active" style={sliderStyle} />
              <input
                className="analyze-date-filter-range analyze-date-filter-range-start"
                type="range"
                min={0}
                max={maxIndex}
                step={1}
                value={selectedRange.startIndex}
                onChange={handleStartChange}
                disabled={dateMarks.length === 0}
              />
              <input
                className="analyze-date-filter-range analyze-date-filter-range-end"
                type="range"
                min={0}
                max={maxIndex}
                step={1}
                value={selectedRange.endIndex}
                onChange={handleEndChange}
                disabled={dateMarks.length === 0}
              />
            </div>
            <span className="analyze-date-filter-end-label">{selectedRange.endDate || '--'}</span>
          </div>
          <div className="analyze-date-filter-dropdown" ref={presetPopoverRef}>
            <div className="analyze-date-filter-dropdown-btn" onClick={() => {setIsShowPresetPopover(prev => !prev);}}>
              <span>{rangeLabel}</span>
              <Icon symbol="arrow-down" />
            </div>
            {isShowPresetPopover && (
              <OptionEditor
                className="analyze-filter-option-editor analyze-date-filter-presets"
                options={presetOptions}
                target={presetPopoverRef}
                isSearchEnabled={false}
                value={selectedPresetValue}
                onChange={handlePresetChange}
                onToggle={() => {}}
                modifiers={[
                  {
                    name: 'offset',
                    options: {
                      offset: [0, 4],
                    }
                  }
                ]}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FilterPanel;
