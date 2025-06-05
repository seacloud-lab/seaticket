import React from 'react';
import { COLUMNS_ICON_CONFIG, FORMULA_COLUMN_TYPES, COLLABORATOR_COLUMN_TYPES } from 'dtable-utils';
import { gettext } from './constants';

class OptionUtils {

  static generatorIconColumnOption(column) {
    if (!column) return null;
    const { type, name } = column;
    return {
      value: { column },
      label: (
        <div className="column-option">
          <span className="column-option-icon" style={{ display: 'inline-block', padding: '0 0.3125rem', marginLeft: '-0.3125rem' }}>
            <i className={COLUMNS_ICON_CONFIG[type]} style={{ fontSize: '14px', color: '#aaa' }}></i>
          </span>
          <span className="select-option-name column-option-name">{name}</span>
        </div>
      )
    };
  }

  static generatorIconColumnOptions(columns) {
    if (!Array.isArray(columns) || columns.length === 0) return [];
    return columns.map(column => this.generatorIconColumnOption(column));
  }

  static generatorColumnNameOption(column) {
    if (!column) return null;
    const { name } = column;
    return {
      value: { column },
      label: (
        <span className="select-option-name">{name}</span>
      )
    };
  }

  static generatorColumnNameOptions(columns) {
    if (!Array.isArray(columns) || columns.length === 0) return [];
    return columns.map(column => this.generatorColumnNameOption(column));
  }

  static generatorKeyLabelOption(option) {
    if (!option) return null;
    return {
      value: option.key,
      label: (
        <span className="select-option-name" title={option.name}>
          {option.name}
        </span>
      )
    };
  }

  static generatorKeyLabelOptions(options) {
    if (!Array.isArray(options) || options.length === 0) return [];
    return options.map(option => this.generatorKeyLabelOption(option));
  }

  static generatorCollaboratorColumnOptions = (columns) => {
    if (!Array.isArray(columns) || columns.length === 0) return [];
    return columns.filter(column => {
      if (FORMULA_COLUMN_TYPES.includes(column.type)) {
        return COLLABORATOR_COLUMN_TYPES.includes(column.data.array_type);
      }
      return COLLABORATOR_COLUMN_TYPES.includes(column.type);
    }).map(column => {
      return {
        label: (<span className="select-option-name select-module-name">{column.name}</span>),
        value: column.key,
      };
    });
  };

  static generatorPredicateOption(filterPredicate) {
    return {
      value: { filterPredicate },
      label: (<span className="select-option-name">{gettext(filterPredicate)}</span>)
    };
  }

  static generatorTermModifierOption(filterTermModifier) {
    return {
      value: { filterTermModifier },
      label: (<span className="select-option-name">{gettext(filterTermModifier)}</span>)
    };
  }

  static generatorSingleSelectOption(option) {
    return {
      value: { columnOption: option },
      label: (
        <div className="select-option-name">
          <div
            className="single-select-option"
            style={{ background: option.color, color: option.textColor || null }}
            title={option.name}
            aria-label={option.name}
          >
            {option.name}
          </div>
        </div>
      )
    };
  }

  static generatorMultipleSelectOption(option, filterTerm) {
    return {
      value: { columnOption: option },
      label: (
        <div className='select-option-name multiple-option-name'>
          <div className='multiple-check-icon'>
            {filterTerm.indexOf(option.id) > -1 && <i className="option-edit dtable-font dtable-icon-check-mark"></i>}
          </div>
          <div
            className="multiple-select-option"
            style={{ background: option.color, color: option.textColor }}
            title={option.name}
            aria-label={option.name}
          >
            {option.name}
          </div>
        </div>
      )
    };
  }

  static generatorConjunctionOptions() {
    return [
      {
        value: { filterConjunction: 'And' },
        label: (<span className='select-option-name'>{gettext('And')}</span>)
      },
      {
        value: { filterConjunction: 'Or' },
        label: (<span className='select-option-name'>{gettext('Or')}</span>)
      }
    ];
  }

  static getActiveConjunctionOption(conjunction) {
    if (conjunction === 'And') {
      return {
        value: { filterConjunction: 'And' },
        label: (<span className='select-option-name'>{gettext('And')}</span>)
      };
    }
    return {
      value: { filterConjunction: 'Or' },
      label: (<span className='select-option-name'>{gettext('Or')}</span>)
    };
  }

}

export default OptionUtils;
