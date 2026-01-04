import React, { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { gettext } from '@/constants';

import './index.css';

const YearRangePicker = ({
  startYear,
  endYear,
  onChange,
  minYear = 1990,
  maxYear = new Date().getFullYear()
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStartYear, setTempStartYear] = useState(startYear);
  const [tempEndYear, setTempEndYear] = useState(endYear);
  const [startDecade, setStartDecade] = useState(() => Math.floor((startYear || new Date().getFullYear()) / 10) * 10);
  const [endDecade, setEndDecade] = useState(() => Math.floor((endYear || new Date().getFullYear()) / 10) * 10);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, tempStartYear, tempEndYear]);

  const handleClose = useCallback(() => {
    if (tempStartYear && tempEndYear && (tempStartYear !== startYear || tempEndYear !== endYear)) {
      onChange(tempStartYear, tempEndYear);
    }
    setIsOpen(false);
  }, [tempStartYear, tempEndYear, startYear, endYear, onChange]);

  const handleToggle = useCallback(() => {
    if (!isOpen) {
      setTempStartYear(startYear);
      setTempEndYear(endYear);
      if (startYear) {
        setStartDecade(Math.floor(startYear / 10) * 10);
      }
      if (endYear) {
        setEndDecade(Math.floor(endYear / 10) * 10);
      }
    }
    setIsOpen(!isOpen);
  }, [isOpen, startYear, endYear]);

  const handleStartYearSelect = useCallback((year) => {
    setTempStartYear(year);
    if (tempEndYear && year > tempEndYear) {
      setTempEndYear(year);
    }
  }, [tempEndYear]);

  const handleEndYearSelect = useCallback((year) => {
    setTempEndYear(year);
    if (tempStartYear && year < tempStartYear) {
      setTempStartYear(year);
    }
  }, [tempStartYear]);

  const generateYears = (decade) => {
    const years = [];
    for (let i = decade - 1; i <= decade + 10; i++) {
      years.push(i);
    }
    return years;
  };

  const renderYearPanel = (decade, setDecade, selectedYear, onSelect) => {
    const years = generateYears(decade);

    return (
      <div className="year-panel">
        <div className="year-panel-header">
          <button
            className="year-nav-btn"
            onClick={() => setDecade(decade - 10)}
            disabled={decade - 10 < minYear - 10}
          >
            {'«'}
          </button>
          <span className="decade-label">{decade}-{decade + 9}</span>
          <button
            className="year-nav-btn"
            onClick={() => setDecade(decade + 10)}
            disabled={decade + 10 > maxYear}
          >
            {'»'}
          </button>
        </div>
        <div className="year-grid">
          {years.map((year) => {
            const isSelected = year === selectedYear;
            const isDisabled = year < minYear || year > maxYear;

            return (
              <button
                key={year}
                className={`year-cell ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => !isDisabled && onSelect(year)}
                disabled={isDisabled}
              >
                {year}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const displayValue = startYear && endYear ? `${startYear}-${endYear}` : '';

  return (
    <div className="year-range-picker" ref={containerRef}>
      <div className="year-range-input" onClick={handleToggle}>
        <input
          type="text"
          readOnly
          value={displayValue}
          placeholder={gettext('Select year range')}
          className="form-control"
        />
      </div>
      {isOpen && (
        <div className="year-range-dropdown">
          <div className="year-range-header">
            <span className="year-display">{tempStartYear || '----'}</span>
            <span className="year-separator">~</span>
            <span className="year-display">{tempEndYear || '----'}</span>
          </div>
          <div className="year-panels">
            {renderYearPanel(startDecade, setStartDecade, tempStartYear, handleStartYearSelect)}
            {renderYearPanel(endDecade, setEndDecade, tempEndYear, handleEndYearSelect)}
          </div>
        </div>
      )}
    </div>
  );
};

YearRangePicker.propTypes = {
  startYear: PropTypes.number,
  endYear: PropTypes.number,
  onChange: PropTypes.func.isRequired,
  minYear: PropTypes.number,
  maxYear: PropTypes.number
};

export default YearRangePicker;
