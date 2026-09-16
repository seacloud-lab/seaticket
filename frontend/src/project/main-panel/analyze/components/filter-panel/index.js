import React, { useCallback, useMemo } from 'react';
import { FilterSelect } from '@/components';
import { gettext } from '@/constants';
import dayjs from '@/sea-metadata/utils/dayjs';
import { presetLabelMapping, DATE_FORMAT } from './constants';
import { getDurationLabel, buildPresetRange, isDisabledPreset } from './utils';

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
  }, [dateMarks, startDate, endDate]);

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
    return state.map((state) => {
      return {
        label: STATE_LABELS[state],
        value: state,
      };
    });
  }, [filterableFieldOptions]);

  const presetOptions = useMemo(() => {
    return Object.keys(presetLabelMapping).map((preset) => ({
      label: presetLabelMapping[preset],
      name: preset,
      value: preset,
      disabled: isDisabledPreset(preset, baseStartDate, baseEndDate),
    }));
  }, [baseStartDate, baseEndDate]);

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

  const onStateChange = useCallback((value) => {
    handleFilterChange('state', value);
  }, [handleFilterChange]);

  const handleStartChange = useCallback((event) => {
    const curIndex = event.target.value;
    const startIndex = Math.min(curIndex, selectedRange.endIndex);
    const endIndex = Math.max(curIndex, selectedRange.endIndex);
    onDateFilterChange(dateMarks[startIndex], dateMarks[endIndex]);
  }, [dateMarks, selectedRange.endIndex, onDateFilterChange]);

  const handleEndChange = useCallback((event) => {
    const curIndex = event.target.value;
    const startIndex = Math.min(selectedRange.startIndex, curIndex);
    const endIndex = Math.max(selectedRange.startIndex, curIndex);
    onDateFilterChange(dateMarks[startIndex], dateMarks[endIndex]);
  }, [dateMarks, selectedRange.startIndex, onDateFilterChange]);

  const handlePresetChange = useCallback((preset) => {
    if (!preset) return;
    const presetRange = buildPresetRange(preset, baseStartDate, baseEndDate);
    onDateFilterChange(presetRange.startDate, presetRange.endDate);
  }, [onDateFilterChange, baseStartDate, baseEndDate]);

  const isShowDateRange = !!baseStartDate && !!baseEndDate;

  return (
    <div className="analyze-filter-panel d-flex align-items-end">
      <FilterSelect
        value={activeState?.value}
        title={gettext('Status')}
        options={stateOptions}
        onChange={onStateChange}
      />
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
          <FilterSelect
            className="ml-2"
            isShowEmptyOption={false}
            value={selectedPresetValue}
            title={rangeLabel}
            options={presetOptions}
            onChange={handlePresetChange}
          />
        </>
      )}
    </div>
  );
};

export default FilterPanel;
