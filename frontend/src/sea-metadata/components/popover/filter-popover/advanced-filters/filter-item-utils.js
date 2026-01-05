import React, { Fragment } from 'react';
import classnames from 'classnames';
import Icon from '@/components/icon';
import { gettext } from '@/constants';
import { COLUMNS_ICON_CONFIG, FILTER_PREDICATE_SHOW, FILTER_TERM_MODIFIER_SHOW } from '../../../../constants';
import { isWhiteColor } from '@/utils/color-utils';
import SelectOption from '@/sea-metadata/components/cell-formatter/select-option';
import { getOptionDisplayNameByOption } from '@/sea-metadata/utils/column';
import { IconButton } from '@/components';

class FilterItemUtils {

  static generatorColumnOption(column) {
    if (!column) return null;
    const { type, display_name: name } = column;
    return {
      value: { column },
      name: name,
      label: (
        <>
          <span className="sea-metadata-filter-header-icon">
            <Icon className="sea-metadata-icon" symbol={COLUMNS_ICON_CONFIG[type]} />
          </span>
          <span className="select-option-name">{name}</span>
        </>
      )
    };
  }

  static generatorPredicateOption(filterPredicate) {
    return {
      value: { filterPredicate },
      label: <span className="select-option-name">{FILTER_PREDICATE_SHOW[filterPredicate]}</span>
    };
  }

  static generatorTermModifierOption(filterTermModifier) {
    return {
      value: { filterTermModifier },
      label: <span className="select-option-name">{FILTER_TERM_MODIFIER_SHOW[filterTermModifier]}</span>
    };
  }

  static generatorSingleSelectOption(option, selectedOption) {
    return {
      value: { columnOption: option },
      name: getOptionDisplayNameByOption(option),
      label: (
        <div className="select-option-name single-option-name">
          <SelectOption option={option} className="single-select-option ml-0" />
          <IconButton className="single-check-icon no-hover-bg" icon={selectedOption?.id === option.id ? 'check-mark' : ''} />
        </div>
      )
    };
  }

  static generatorMultipleSelectOption(option, filterTerm) {
    return {
      value: { columnOption: option },
      label: (
        <div className="select-option-name multiple-option-name">
          <SelectOption option={option} className={classnames('multiple-select-option ml-0', { 'multiple-select-option-white': isWhiteColor(option.color) })} />
          <IconButton className="single-check-icon no-hover-bg" icon={filterTerm.indexOf(option.id) > -1 ? 'check-mark' : ''} />
        </div>
      )
    };
  }

  static generatorConjunctionOptions() {
    return [
      {
        value: { filterConjunction: 'And' },
        label: (<span className="select-option-name">{gettext('And')}</span>)
      },
      {
        value: { filterConjunction: 'Or' },
        label: (<span className="select-option-name">{gettext('Or')}</span>)
      }
    ];
  }

  static getActiveConjunctionOption(conjunction) {
    if (conjunction === 'And') {
      return {
        value: { filterConjunction: 'And' },
        label: (<span className="select-option-name">{gettext('And')}</span>)
      };
    }
    return {
      value: { filterConjunction: 'Or' },
      label: (<span className="select-option-name">{gettext('Or')}</span>)
    };
  }
}

export default FilterItemUtils;
