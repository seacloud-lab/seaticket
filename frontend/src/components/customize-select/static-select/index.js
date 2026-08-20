import React, { Fragment, useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import ModalPortal from '../../modal-portal';
import Options from '../options';
import { getEventClassName } from '@/utils/dom';
import SelectTrigger from '../select-trigger';

const SyncSelect = ({
  className,
  containerClassName,
  value,
  options = [],
  searchable,
  searchPlaceholder,
  noOptionsPlaceholder,
  supportMultipleSelect,
  disabled,
  isInModal,
  id,
  offset,
  placeholder,
  children,
  onChange,
}) => {
  const [isShowSelector, setIsShowSelector] = useState(false);

  const selectTriggerRef = useRef(null);

  const onToggle = useCallback((event) => {
    event.preventDefault();
    /*
      if select is showing, click events do not need to be monitored by other click events,
      so it can be closed when other select is clicked.
    */
    if (isShowSelector) event.stopPropagation();
    const eventClassName = getEventClassName(event);
    if (disabled ||
      eventClassName.indexOf('seaqa-search-input-wrapper') > -1 ||
      eventClassName.indexOf('seaqa-search-input') > -1 ||
      eventClassName.indexOf('seaqa-clear-icon-button') > -1 ||
      eventClassName.indexOf('seaqa-icon-svg-close') > -1 ||
      eventClassName.indexOf('seaqa-select-options-search-container') > -1)
      return;
    // Prevent closing by pressing the space-bar in the search input
    if (event.target.value === '') return;
    setIsShowSelector(pre => !pre);
  }, [isShowSelector, disabled]);

  const onClickOutside = useCallback((event) => {
    if (selectTriggerRef.current.contains(event.target)) return;
    setIsShowSelector(false);
  }, []);

  const closeSelector = useCallback(() => {
    setIsShowSelector(false);
  }, []);

  const getTriggerTop = useCallback(() => {
    if (!selectTriggerRef.current) return 38;
    const { height } = selectTriggerRef.current?.getBoundingClientRect() || {};
    return height;
  }, []);

  const getTriggerPosition = useCallback(() => {
    if (!selectTriggerRef.current) return {};
    return selectTriggerRef.current?.getBoundingClientRect() || {};
  }, []);

  const renderSelectedValue = useCallback(() => {
    if (children) {
      return (
        <span className="selected-option-show">
          {children}
        </span>
      );
    }
    let selectedOptions = [];
    if (Array.isArray(value)) {
      selectedOptions = value.map(item => options.find(o => o.value === item));
    } else {
      selectedOptions = [options.find(o => o.value === value)];
    }
    selectedOptions = selectedOptions.filter(Boolean);
    if (selectedOptions.length > 0) {
      return (
        <span className="selected-option-show">
          {selectedOptions.map(option => (<Fragment key={option.value}>{option.label}</Fragment>))}
        </span>
      );
    }
    return (<span className="select-placeholder">{placeholder}</span>);
  }, [value, options, placeholder, children]);

  const OptionsShell = isInModal ? ModalPortal : Fragment;
  return (
    <SelectTrigger
      focus={isShowSelector}
      disabled={disabled}
      className={className}
      id={id}
      innerRef={selectTriggerRef}
      selectedValue={renderSelectedValue()}
      onClick={onToggle}
    >
      {isShowSelector && (
        <OptionsShell>
          <Options
            className={containerClassName}
            isInModal={isInModal}
            offset={offset}
            value={value}
            top={getTriggerTop()}
            position={getTriggerPosition()}
            options={options}
            onChange={onChange}
            searchable={searchable}
            searchPlaceholder={searchPlaceholder}
            noOptionsPlaceholder={noOptionsPlaceholder}
            onClickOutside={onClickOutside}
            closeSelector={closeSelector}
            supportMultipleSelect={supportMultipleSelect}
          />
        </OptionsShell>
      )}
    </SelectTrigger>
  );
};

SyncSelect.propTypes = {
  className: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.array, PropTypes.number]),
  options: PropTypes.array,
  placeholder: PropTypes.string,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  searchable: PropTypes.bool,
  searchPlaceholder: PropTypes.string,
  noOptionsPlaceholder: PropTypes.string,
  isInModal: PropTypes.bool, // if select component in a modal (option group need ModalPortal to show)
};

export default SyncSelect;
