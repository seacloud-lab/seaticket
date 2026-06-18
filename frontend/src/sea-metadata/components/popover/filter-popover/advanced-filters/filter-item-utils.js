import React, { Fragment } from 'react';
import classnames from 'classnames';
import Icon from '@/components/icon';
import { gettext } from '@/constants';
import { COLUMNS_ICON_CONFIG, FILTER_PREDICATE_SHOW, FILTER_TERM_MODIFIER_SHOW } from '../../../../constants';
import { isWhiteColor } from '@/utils/color-utils';
import SelectOption from '@/sea-metadata/components/cell-formatter/select-option';
import { getOptionDisplayNameByOption } from '@/sea-metadata/utils/column';
import { IconButton } from '@/components';
import TagOption from '@/components/tag-option';

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
          <span className="select-option-name mr-4">{name}</span>
        </>
      )
    };
  }

  static generatorPredicateOption(filterPredicate, isActive) {
    const filterPredicateDisplay = FILTER_PREDICATE_SHOW[filterPredicate] || '';
    const translatedPredicateText = isActive ? filterPredicateDisplay.replace(/\s*\.{3}$/, '') : filterPredicateDisplay;

    return {
      value: { filterPredicate },
      label: <span className="select-option-name">{translatedPredicateText}</span>
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
      name: getOptionDisplayNameByOption(option),
      label: (
        <div className="select-option-name multiple-option-name">
          <SelectOption option={option} className={classnames('multiple-select-option ml-0', { 'multiple-select-option-white': isWhiteColor(option.color) })} />
          <IconButton className="single-check-icon no-hover-bg" icon={filterTerm.indexOf(option.id) > -1 ? 'check-mark' : ''} />
        </div>
      )
    };
  }

  static generatorTagOption(tag, filterTerm) {
    return {
      value: { tag },
      name: tag.name,
      label: (
        <div className="select-option-name multiple-option-name">
          <TagOption tag={tag} className="multiple-select-option" />
          <IconButton className="single-check-icon no-hover-bg" icon={filterTerm.indexOf(Number(tag.id)) > -1 ? 'check-mark' : ''} />
        </div>
      )
    };
  }

  static generatorConjunctionOptions() {
    return [
      {
        value: { filterConjunction: 'And' },
        label: (
          <div className="select-option-name conjunction-option-name">
            <span>{gettext('And')}</span>
          </div>
        )
      },
      {
        value: { filterConjunction: 'Or' },
        label: (
          <div className="select-option-name conjunction-option-name">
            <span>{gettext('Or')}</span>
          </div>
        )
      }
    ];
  }

  static getActiveConjunctionOption(conjunction) {
    if (conjunction === 'And') {
      return {
        value: { filterConjunction: 'And' },
        label: (
          <div className="select-option-name conjunction-option-name">
            <span>{gettext('And')}</span>
          </div>
        )
      };
    }
    return {
      value: { filterConjunction: 'Or' },
      label: (
        <div className="select-option-name conjunction-option-name">
          <span>{gettext('Or')}</span>
        </div>
      )
    };
  }
}

export default FilterItemUtils;
