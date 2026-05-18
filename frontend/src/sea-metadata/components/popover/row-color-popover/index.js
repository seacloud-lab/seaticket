import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import CustomizePopover from '@/components/customize-popover';
import { ColorSelectorPopover, IconButton } from '@/components';
import CommonAddTool from '@/components/customize-add-tool';
import { gettext, SELECT_OPTION_COLORS } from '@/constants';
import context from '@/sea-metadata/context';
import { CellType } from '@/sea-metadata/constants';
import { getFilterByColumn } from '../../../utils/filter';
import { getDefaultRowColorRule } from '../../../utils/view';
import { FILTER_COLUMN_OPTIONS, ROW_COLOR_TYPE } from '../../../constants';
import { ValidateFilter } from '../../../utils/validate/filter';
import AdvancedFilters from '../filter-popover/advanced-filters';

import './index.css';

const normalizeRule = (rule, update = {}) => {
  return {
    ...rule,
    ...update,
    filter_conjunction: update.filter_conjunction || rule.filter_conjunction || 'Or',
  };
};

const getValidRules = (rules = []) => {
  return rules.filter(rule => Array.isArray(rule?.filters) && rule.filters.length > 0);
};

const RowColorPopover = ({ target, readOnly, columns, colorbys, collaborators = [], hidePopover, modifyRowColor }) => {
  const [editingRuleIndex, setEditingRuleIndex] = useState(null);
  const [colorSelectorIndex, setColorSelectorIndex] = useState(null);

  const excludedColumnKeys = useMemo(() => {
    return new Set([
      context.getSetting('stateColumnKey', 'status'),
      context.getSetting('typeColumnKey', 'type'),
      context.getSetting('tagsColumnKey', 'tags'),
    ]);
  }, []);

  const validColumns = useMemo(() => {
    return (columns || []).filter((column) => {
      return FILTER_COLUMN_OPTIONS[column.type] && column.filter_able && !excludedColumnKeys.has(column.key) && column.type !== CellType.PRIORITY;
    });
  }, [columns, excludedColumnKeys]);

  const colorRules = useMemo(() => {
    return Array.isArray(colorbys?.color_by_rules) ? colorbys.color_by_rules : [];
  }, [colorbys]);

  const [rules, setRules] = useState(colorRules);

  useEffect(() => {
    setRules(colorRules);
  }, [colorRules]);

  const canAddRule = useMemo(() => {
    if (validColumns.length === 0) return false;
    if (rules.length === 0) return true;

    const lastRule = rules[rules.length - 1];
    const hasValidFilters = lastRule?.filters.every((filter) => {
      const { error_message } = ValidateFilter.validate(filter, validColumns);
      return !error_message;
    });
    return Array.isArray(lastRule?.filters) && lastRule.filters.length > 0 && hasValidFilters;
  }, [rules, validColumns]);

  const updateRules = useCallback((updater) => {
    setRules((prevRules) => {
      const newRules = typeof updater === 'function' ? updater(prevRules) : updater;
      modifyRowColor({
        type: newRules.length > 0 ? ROW_COLOR_TYPE.BY_RULES : '',
        color_by_rules: newRules,
      });
      return newRules;
    });
  }, [modifyRowColor]);

  const handleAddRule = useCallback(() => {
    if (!canAddRule) return;
    const defaultColumn = validColumns[0];
    if (!defaultColumn) return;
    const filter = getFilterByColumn(defaultColumn);
    const defaultRule = getDefaultRowColorRule(validColumns, filter, SELECT_OPTION_COLORS[rules.length % SELECT_OPTION_COLORS.length].COLOR);
    if (!defaultRule) return;
    updateRules(prevRules => [...prevRules, defaultRule]);
  }, [canAddRule, validColumns, rules, updateRules]);

  const handleChangeRuleColor = useCallback((ruleIndex, colorOption) => {
    updateRules((prevRules) => {
      const newRules = prevRules.slice();
      newRules[ruleIndex] = { ...newRules[ruleIndex], color: colorOption.COLOR };
      return newRules;
    });
  }, [updateRules]);

  const handleDeleteRule = useCallback((ruleIndex) => {
    updateRules((prevRules) => {
      const newRules = prevRules.slice();
      newRules.splice(ruleIndex, 1);
      return newRules;
    });
  }, [updateRules]);

  // filter - update rule
  const handleUpdateRule = useCallback((ruleIndex, update) => {
    updateRules((prevRules) => {
      const currentRule = prevRules[ruleIndex];
      if (!currentRule) return prevRules;
      const newRules = prevRules.slice();
      newRules[ruleIndex] = normalizeRule(currentRule, update);
      return getValidRules(newRules);
    });
  }, [updateRules]);

  // filter - delete rule
  const handleDeleteRuleFilter = useCallback((ruleIndex, filterIndex) => {
    updateRules((prevRules) => {
      const rule = prevRules[ruleIndex];
      if (!rule) return prevRules;
      const filters = Array.isArray(rule.filters) ? rule.filters.slice() : [];
      filters.splice(filterIndex, 1);
      const newRules = prevRules.slice();
      newRules[ruleIndex] = normalizeRule(rule, { filters });
      return getValidRules(newRules);
    });
  }, [updateRules]);

  // filter - update rule filter
  const handleUpdateRuleFilter = useCallback((ruleIndex, filterIndex, updatedFilter) => {
    if (!updatedFilter) return;
    updateRules((prevRules) => {
      const rule = prevRules[ruleIndex];
      if (!rule) return prevRules;
      const filters = Array.isArray(rule.filters) ? rule.filters.slice() : [];
      filters[filterIndex] = updatedFilter;
      const newRules = prevRules.slice();
      newRules[ruleIndex] = normalizeRule(rule, { filters });
      return newRules;
    });
  }, [updateRules]);

  const handleAddRuleFilter = useCallback((ruleIndex) => {
    const defaultColumn = validColumns[0];
    if (!defaultColumn) return;
    updateRules((prevRules) => {
      const rule = prevRules[ruleIndex];
      if (!rule) return prevRules;
      const filter = getFilterByColumn(defaultColumn);
      const filters = Array.isArray(rule.filters) ? rule.filters.slice() : [];
      filters.push(filter);
      const newRules = prevRules.slice();
      newRules[ruleIndex] = normalizeRule(rule, { filters });
      return newRules;
    });
  }, [validColumns, updateRules]);

  return (
    <CustomizePopover
      target={target}
      className="sea-metadata-row-color-popover"
      hidePopover={hidePopover}
      hidePopoverWithEsc={hidePopover}
      placement="bottom-end"
      modifiers={[
        { name: 'preventOverflow', options: { boundary: document.body } },
        { name: 'offset', options: { offset: [-6, 8] } }
      ]}
    >
      <div className="sea-metadata-row-color-body">
        {rules.length === 0 && <div className="sea-metadata-row-color-empty">{gettext('No rules')}</div>}
        {rules.map((rule, ruleIndex) => {
          const colorTarget = `sea-metadata-row-color-selector-${ruleIndex}`;
          const currentColorOption = SELECT_OPTION_COLORS.find(option => option.COLOR === rule.color);
          return (
            <div
              className={classnames('sea-metadata-row-color-rule', { 'row-color-rule-editing': editingRuleIndex === ruleIndex })}
              key={`row-color-rule-${ruleIndex}`}
              onClick={() => setEditingRuleIndex((prevIndex) => prevIndex === ruleIndex ? null : ruleIndex)}
            >
              <div className="sea-metadata-row-color-rule-header">
                <div className="sea-metadata-row-color-rule-color-wrap">
                  <IconButton
                    id={colorTarget}
                    className="sea-metadata-row-color-rule-color"
                    style={{
                      backgroundColor: rule.color,
                      borderColor: currentColorOption?.BORDER_COLOR,
                      color: currentColorOption?.TEXT_COLOR,
                    }}
                    icon="check-mark"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {e.stopPropagation(); setColorSelectorIndex(colorSelectorIndex === ruleIndex ? null : ruleIndex);}}
                  />
                  {colorSelectorIndex === ruleIndex && (
                    <ColorSelectorPopover
                      target={colorTarget}
                      color={rule.color}
                      onToggle={() => setColorSelectorIndex(null)}
                      onChange={(option) => handleChangeRuleColor(ruleIndex, option)}
                    />
                  )}
                  <div className="sea-metadata-row-color-rule-name text-truncate">{`${gettext('Rule')} ${ruleIndex + 1}`}</div>
                </div>
                {!readOnly && (
                  <IconButton className="sea-metadata-row-color-rule-remove" icon="delete" onClick={(e) => {e.stopPropagation(); handleDeleteRule(ruleIndex);}} />
                )}
              </div>
              {editingRuleIndex === ruleIndex && (
                <div className="sea-metadata-row-color-rule-filters" onClick={(e) => e.stopPropagation()}>
                  <AdvancedFilters
                    readOnly={readOnly}
                    columns={validColumns}
                    collaborators={collaborators}
                    filterConjunction={rule.filter_conjunction || 'And'}
                    filters={Array.isArray(rule.filters) ? rule.filters : []}
                    emptyPlaceholder={gettext('No filters')}
                    updateFilter={(filterIndex, updatedFilter) => handleUpdateRuleFilter(ruleIndex, filterIndex, updatedFilter)}
                    deleteFilter={(filterIndex) => handleDeleteRuleFilter(ruleIndex, filterIndex)}
                    modifyFilterConjunction={(filterConjunction) => handleUpdateRule(ruleIndex, { filter_conjunction: filterConjunction })}
                  />
                  {!readOnly && (
                    <div className="sea-metadata-row-color-rule-filters-footer">
                      <CommonAddTool className="popover-add-tool" callBack={() => handleAddRuleFilter(ruleIndex)} name={gettext('Add condition')} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!readOnly && (
        <div className="sea-metadata-row-color-add-btns">
          <CommonAddTool
            className={`popover-add-tool ${canAddRule ? '' : 'disabled'}`}
            callBack={canAddRule ? handleAddRule : () => {}}
            name={gettext('Add rule')}
          />
        </div>
      )}
    </CustomizePopover>
  );
};

RowColorPopover.propTypes = {
  target: PropTypes.string.isRequired,
  readOnly: PropTypes.bool,
  columns: PropTypes.array,
  colorbys: PropTypes.object,
  collaborators: PropTypes.array,
  hidePopover: PropTypes.func.isRequired,
  modifyRowColor: PropTypes.func.isRequired,
};

export default RowColorPopover;
