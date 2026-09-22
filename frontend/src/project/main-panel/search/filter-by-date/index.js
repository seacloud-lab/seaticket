import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import dayjs from 'dayjs';
import PropTypes from 'prop-types';
import { DatePicker, CustomizePopover, IconButton
} from '@/components';
import SelectTrigger from '@/components/customize-select/select-trigger';
import { gettext } from '../../../../constants';
import { SEARCH_FILTERS_KEY, SEARCH_FILTER_BY_DATE_OPTION_KEY, SEARCH_FILTER_BY_DATE_TYPE_KEY } from '../constants';

import './index.css';

const DATE_INPUT_WIDTH = 118;

const FilterByDate = ({ date, onChange }) => {
  const [value, setValue] = useState(date.value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [isCustomDateHover, setIsCustomDateHover] = useState(false);
  const [type] = useState(date.type || SEARCH_FILTER_BY_DATE_TYPE_KEY.LAST_UPDATED_TIME);
  const [isCustomDate, setIsCustomDate] = useState(date.value === SEARCH_FILTER_BY_DATE_OPTION_KEY.CUSTOM);
  const [time, setTime] = useState({
    from: date.from,
    to: date.to,
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const editorRef = useRef(null);

  const options = useMemo(() => {
    return [
      {
        value: SEARCH_FILTER_BY_DATE_OPTION_KEY.TODAY,
        label: gettext('Today'),
      }, {
        value: SEARCH_FILTER_BY_DATE_OPTION_KEY.LAST_7_DAYS,
        label: gettext('Last 7 days'),
      }, {
        value: SEARCH_FILTER_BY_DATE_OPTION_KEY.LAST_30_DAYS,
        label: gettext('Last 30 days'),
      },
      'Divider',
      {
        value: SEARCH_FILTER_BY_DATE_OPTION_KEY.CUSTOM,
        label: gettext('Custom time'),
      },
    ];
  }, []);

  const handleDatePickerOpenChange = useCallback((newValue) => {
    setIsDatePickerOpen(newValue);
  }, []);

  const toggle = useCallback(() => setIsOpen(!isOpen), [isOpen]);

  const onClearDate = useCallback(() => {
    setValue('');
    setIsCustomDate(false);
    setTime({
      from: null,
      to: null,
    });
    setIsOpen(false);
  }, []);

  const onOptionClick = useCallback((newValue) => {
    if (newValue === value) {
      onClearDate();
      return;
    }
    const today = dayjs().endOf('day');
    const isCustomOption = newValue === SEARCH_FILTER_BY_DATE_OPTION_KEY.CUSTOM;
    setIsCustomDate(isCustomOption);
    setValue(newValue);
    setIsOpen(isCustomOption);
    switch (newValue) {
      case SEARCH_FILTER_BY_DATE_OPTION_KEY.TODAY: {
        setTime({
          from: dayjs().startOf('day').unix(),
          to: today.unix()
        });
        break;
      }
      case SEARCH_FILTER_BY_DATE_OPTION_KEY.LAST_7_DAYS: {
        setTime({
          from: dayjs().subtract(6, 'day').startOf('day').unix(),
          to: today.unix()
        });
        break;
      }
      case SEARCH_FILTER_BY_DATE_OPTION_KEY.LAST_30_DAYS: {
        setTime({
          from: dayjs().subtract(30, 'day').startOf('day').unix(),
          to: today.unix()
        });
        break;
      }
      case SEARCH_FILTER_BY_DATE_OPTION_KEY.CUSTOM: {
        setTime({
          from: null,
          to: null,
        });
        break;
      }
      default:
        break;
    }
  }, [value, onClearDate]);

  const disabledStartDate = useCallback((startDate) => {
    if (!startDate) return false;
    const today = dayjs();
    const endValue = time.to;

    if (!endValue) {
      return startDate.isAfter(today);
    }
    return endValue.isBefore(startDate) || startDate.isAfter(today);
  }, [time]);

  const disabledEndDate = useCallback((endDate) => {
    if (!endDate) return false;
    const today = dayjs().endOf('day');
    const startValue = time.from;
    if (!startValue) {
      return endDate.isAfter(today);
    }
    return endDate.isBefore(startValue) || endDate.isAfter(today);
  }, [time]);

  useEffect(() => {
    if (!isOpen) {
      if (type !== date.type || time.from !== date.from || time.to !== date.to) {
        onChange(SEARCH_FILTERS_KEY.DATE, {
          type,
          value,
          from: time.from,
          to: time.to,
        });
      }
    }
  }, [isOpen, date, time, type, value, onChange]);

  const optionClassname = classnames('options-editor-option check-placement-right', { 'pe-none': isDatePickerOpen });

  return (
    <>
      <SelectTrigger
        innerRef={editorRef}
        className="seaqa-search-filter-by-date-trigger"
        disabled={false}
        focus={isOpen}
        highlight={value}
        hasBorder={false}
        selectedValue={(<span className="selected-option-show">{gettext('Last modified time')}</span>)}
        onClick={() => setIsOpen(true)}
      />
      {isOpen && (
        <CustomizePopover
          target={editorRef}
          className="options-editor-popover seaqa-search-filter-by-date-popover"
          containerClassName="options-editor-container"
          canHidePopover={!isDatePickerOpen}
          hidePopoverWithEsc={toggle}
          hidePopover={toggle}
        >
          <div className="options-editor-content">
            {value && (
              <div className={optionClassname} onClick={onClearDate}>
                <div className="options-editor-option-content">
                  <span className="text-truncate">{'--'}</span>
                </div>
              </div>
            )}
            {options.map((option, index) => {
              if (option === 'Divider') {
                return (<div className="options-editor-divider-option" key={index}></div>);
              }
              const isSelected = option?.value === value;
              const isCustomDateOption = option.value === SEARCH_FILTER_BY_DATE_OPTION_KEY.CUSTOM;
              return (
                <div
                  className={optionClassname}
                  key={index}
                  onClick={() => onOptionClick(option?.value)}
                  onMouseEnter={isCustomDateOption ? () => setIsCustomDateHover(true) : undefined }
                  onMouseLeave={isCustomDateOption ? () => setIsCustomDateHover(false) : undefined }
                  style={(isCustomDate && isCustomDateOption) ? { borderRadius: '4px 4px 0px 0px' } : {}}
                >
                  <div className="options-editor-option-content">
                    <span className="text-truncate" title={option.label}>{option.label}</span>
                  </div>
                  <IconButton icon={isSelected ? 'check-mark-option' : ''} className="options-editor-option-check-btn no-hover-bg" />
                </div>
              );
            })}
            {isCustomDate && (
              <div
                className="filter-by-date-custom-date-container-outer pb-1"
                style={{ backgroundColor: isCustomDateHover ? 'rgba(0, 0, 0, 0.04)' : '#fff' }}
              >
                <div className="filter-by-date-custom-date-container p-2 mx-2 d-flex align-items-center justify-content-between border-radius-4">
                  <div className="custom-date-container">
                    <div className="font-size-13 line-height-20 mb-1">{gettext('Start date')}</div>
                    <DatePicker
                      disabledDate={disabledStartDate}
                      value={time.from}
                      onChange={(value) => setTime({ ...time, from: value?.startOf('day') })}
                      inputWidth={DATE_INPUT_WIDTH}
                      onOpenChange={handleDatePickerOpenChange}
                    />
                  </div>
                  <div className="custom-date-container">
                    <div className="font-size-13 line-height-20 mb-1">{gettext('End date')}</div>
                    <DatePicker
                      disabledDate={disabledEndDate}
                      value={time.to}
                      onChange={(value) => setTime({ ...time, to: value?.endOf('day') })}
                      inputWidth={DATE_INPUT_WIDTH}
                      onOpenChange={handleDatePickerOpenChange}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CustomizePopover>
      )}
    </>
  );
};

FilterByDate.propTypes = {
  date: PropTypes.shape({
    type: PropTypes.string,
    value: PropTypes.string,
    start: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
    end: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
  }),
  onChange: PropTypes.func.isRequired,
};

export default FilterByDate;
