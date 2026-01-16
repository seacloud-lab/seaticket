import React, { useState, useRef, useEffect, useCallback } from 'react';
import { gettext } from '@/constants';
import { Icon, IconTooltip } from '@/components';

import './index.css';

const FilterPanel = ({
  filters,
  filterableFields,
  filterableFieldOptions,
  onAddFilter,
  onRemoveFilter
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedField, setSelectedField] = useState(null);
  const dropdownRef = useRef(null);

  const closeDropdown = useCallback(() => {
    setIsDropdownOpen(false);
    setSelectedField(null);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeDropdown]);

  const handleToggleDropdown = useCallback(() => {
    if (isDropdownOpen) {
      closeDropdown();
    } else {
      setIsDropdownOpen(true);
      setSelectedField(null);
    }
  }, [isDropdownOpen, closeDropdown]);

  const handleSelectField = useCallback((field) => {
    setSelectedField(field);
  }, []);

  const handleSelectValue = useCallback((value) => {
    if (selectedField) {
      onAddFilter(selectedField.field, value);
      closeDropdown();
    }
  }, [selectedField, onAddFilter, closeDropdown]);

  const handleBack = useCallback(() => {
    setSelectedField(null);
  }, []);

  const getFieldLabel = (fieldName) => {
    const field = filterableFields.find(f => f.field === fieldName);
    return field ? field.label : fieldName;
  };

  const availableFields = filterableFields.filter(
    f => !filters.some(filter => filter.field === f.field) && filterableFieldOptions[f.field]?.length > 0
  );

  return (
    <div className="analyze-filter-panel">
      {filters.length > 0 && (
        <div className="analyze-filter-tags">
          {filters.map(filter => (
            <div key={filter.field} className="analyze-filter-tag">
              <span className="analyze-filter-tag-label">{getFieldLabel(filter.field)}:</span>
              <span className="analyze-filter-tag-value">{filter.value}</span>
              <IconTooltip
                icon="close"
                className="analyze-filter-tag-remove"
                tip={gettext('Remove')}
                placement="bottom"
                onClick={() => onRemoveFilter(filter.field)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="analyze-add-filter" ref={dropdownRef}>
        <div
          className={`analyze-add-filter-btn ${availableFields.length === 0 ? 'disabled' : ''}`}
          onClick={availableFields.length > 0 ? handleToggleDropdown : undefined}
        >
          <Icon symbol="plus" className="analyze-add-filter-icon" />
          <span>{gettext('Add filter')}</span>
        </div>

        {isDropdownOpen && (
          <div className="analyze-filter-dropdown">
            {!selectedField ? (
              <>
                <div className="analyze-filter-dropdown-header">
                  {gettext('Select field')}
                </div>
                {availableFields.map(field => (
                  <div
                    key={field.field}
                    className="analyze-filter-dropdown-item"
                    onClick={() => handleSelectField(field)}
                  >
                    <span>{field.label}</span>
                    <Icon symbol="arrow-right" className="analyze-filter-dropdown-arrow" />
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="analyze-filter-dropdown-header with-back">
                  <Icon
                    symbol="arrow-left"
                    className="analyze-filter-dropdown-back"
                    onClick={handleBack}
                  />
                  <span>{selectedField.label}</span>
                </div>
                <div className="analyze-filter-dropdown-values">
                  {filterableFieldOptions[selectedField.field]?.map(value => (
                    <div
                      key={value}
                      className="analyze-filter-dropdown-item"
                      onClick={() => handleSelectValue(value)}
                    >
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterPanel;
