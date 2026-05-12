import React, { useCallback, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import CustomizePopover from '@/components/customize-popover';
import { ColorSelectorPopover, Icon, IconButton } from '@/components';
import CommonAddTool from '@/components/customize-add-tool';
import { gettext, SELECT_OPTION_COLORS } from '@/constants';
import { getFilterByColumn } from '../../../utils/filter';
import { getDefaultRowColorRule } from '../../../utils/view';
import { FILTER_COLUMN_OPTIONS, ROW_COLOR_TYPE } from '../../../constants';
import AdvancedFilters from '../filter-popover/advanced-filters';

import './index.css';

const EMPTY_COLLABORATORS = [];

const RowColorPopover = ({ target, readOnly, columns, colorbys, hidePopover, modifyRowColor }) => {
  const [editingRuleIndex, setEditingRuleIndex] = useState(null);
  const [colorSelectorIndex, setColorSelectorIndex] = useState(null);
  const filterTargetsRef = useRef({});

  const validColumns = useMemo(() => {
    return (columns || []).filter((column) => FILTER_COLUMN_OPTIONS[column.type] && column.filter_able);
  }, [columns]);

  const rules = useMemo(() => {
    return Array.isArray(colorbys?.color_by_rules) ? colorbys.color_by_rules : [];
  }, [colorbys]);

  const updateRules = useCallback((newRules) => {
    modifyRowColor({
      type: newRules.length > 0 ? ROW_COLOR_TYPE.BY_RULES : '',
      color_by_rules: newRules,
    });
  }, [modifyRowColor]);

  const handleDelete = useCallback(() => {
    updateRules([]);
    hidePopover();
  }, [updateRules, hidePopover]);

  const handleAddRule = useCallback(() => {
    const defaultColumn = validColumns[0];
    if (!defaultColumn) return;
    const filter = getFilterByColumn(defaultColumn);
    const defaultRule = getDefaultRowColorRule(validColumns, filter, SELECT_OPTION_COLORS[rules.length % SELECT_OPTION_COLORS.length].COLOR);
    if (!defaultRule) return;
    updateRules([...rules, defaultRule]);
  }, [validColumns, rules, updateRules]);

  const handleChangeRuleColor = useCallback((ruleIndex, colorOption) => {
    const newRules = rules.slice();
    newRules[ruleIndex] = { ...newRules[ruleIndex], color: colorOption.COLOR };
    updateRules(newRules);
  }, [rules, updateRules]);

  const handleDeleteRule = useCallback((ruleIndex) => {
    const newRules = rules.slice();
    newRules.splice(ruleIndex, 1);
    updateRules(newRules);
  }, [rules, updateRules]);

  const handleUpdateRule = useCallback((ruleIndex, update) => {
    let newRules = rules.slice();
    newRules[ruleIndex] = {
      ...newRules[ruleIndex],
      ...update,
      filter_conjunction: update.filter_conjunction || newRules[ruleIndex].filter_conjunction || 'And',
    };
    newRules = newRules.filter(rule => rule.filters && rule.filters.length > 0);
    updateRules(newRules);
  }, [rules, updateRules]);

  const handleUpdateRuleFilters = useCallback((ruleIndex, filters) => {
    const rule = rules[ruleIndex];
    if (!rule) return;
    handleUpdateRule(ruleIndex, { filters });
  }, [rules, handleUpdateRule]);

  const handleDeleteRuleFilter = useCallback((ruleIndex, filterIndex) => {
    const rule = rules[ruleIndex];
    if (!rule) return;
    const filters = Array.isArray(rule.filters) ? rule.filters.slice() : [];
    filters.splice(filterIndex, 1);
    handleUpdateRule(ruleIndex, { filters });
  }, [rules, handleUpdateRule]);

  const handleUpdateRuleFilter = useCallback((ruleIndex, filterIndex, updatedFilter) => {
    const rule = rules[ruleIndex];
    if (!rule || !updatedFilter) return;
    const filters = Array.isArray(rule.filters) ? rule.filters.slice() : [];
    filters[filterIndex] = updatedFilter;
    handleUpdateRule(ruleIndex, { filters });
  }, [rules, handleUpdateRule]);

  const handleAddRuleFilter = useCallback((ruleIndex) => {
    const rule = rules[ruleIndex];
    const defaultColumn = validColumns[0];
    if (!rule || !defaultColumn) return;
    const filter = getFilterByColumn(defaultColumn);
    const filters = Array.isArray(rule.filters) ? rule.filters.slice() : [];
    filters.push(filter);
    handleUpdateRule(ruleIndex, { filters });
  }, [rules, validColumns, handleUpdateRule]);

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
        {rules.length === 0 && (
          <div className="sea-metadata-row-color-empty">{gettext('No rules')}</div>
        )}
        {rules.map((rule, ruleIndex) => {
          const colorTarget = `sea-metadata-row-color-selector-${ruleIndex}`;
          const filterTarget = `sea-metadata-row-color-filter-${ruleIndex}`;
          const currentColorOption = SELECT_OPTION_COLORS.find(option => option.COLOR === rule.color);
          return (
            <div
              className={classnames('sea-metadata-row-color-rule', { 'row-color-rule-editing': editingRuleIndex === ruleIndex })}
              key={`row-color-rule-${ruleIndex}`}
              onClick={() => setEditingRuleIndex(editingRuleIndex === ruleIndex ? null : ruleIndex)}
            >
              <div className="sea-metadata-row-color-rule-item">
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
                  <div
                    id={filterTarget}
                    ref={(ref) => {
                      filterTargetsRef.current[ruleIndex] = ref;
                    }}
                    className="sea-metadata-row-color-rule-filter-trigger text-truncate"
                  >
                    {gettext('Define rule')}
                  </div>
                </div>
                {!readOnly && (
                  <IconButton className="sea-metadata-row-color-rule-remove" icon="delete" onClick={(e) => {e.stopPropagation(); handleDeleteRule(ruleIndex);}} style={{ backgroundColor: 'transparent' }} />
                )}
              </div>
              {editingRuleIndex === ruleIndex && (
                <div className="sea-metadata-row-color-rule-filters" onClick={(e) => e.stopPropagation()}>
                  <AdvancedFilters
                    readOnly={readOnly}
                    columns={validColumns}
                    collaborators={EMPTY_COLLABORATORS}
                    filterConjunction={rule.filter_conjunction || 'And'}
                    filters={Array.isArray(rule.filters) ? rule.filters : []}
                    emptyPlaceholder={gettext('No filters')}
                    updateFilter={(filterIndex, updatedFilter) => handleUpdateRuleFilter(ruleIndex, filterIndex, updatedFilter)}
                    deleteFilter={(filterIndex) => handleDeleteRuleFilter(ruleIndex, filterIndex)}
                    modifyFilterConjunction={(filterConjunction) => handleUpdateRule(ruleIndex, { filter_conjunction: filterConjunction })}
                  />
                  {!readOnly && (
                    <div className="sea-metadata-row-color-rule-filters-footer">
                      <CommonAddTool
                        className={`popover-add-tool ${validColumns.length === 0 ? 'disabled' : ''}`}
                        callBack={validColumns.length > 0 ? () => handleAddRuleFilter(ruleIndex) : () => {}}
                        name={gettext('Add filter')}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!readOnly && (
          <div className="sea-metadata-row-color-add-btns">
            <CommonAddTool
              className={'popover-add-tool'}
              callBack={handleAddRule}
              name={gettext('Add rule')}
            />
          </div>
        )}
      </div>
    </CustomizePopover>
  );
};

RowColorPopover.propTypes = {
  target: PropTypes.string.isRequired,
  readOnly: PropTypes.bool,
  columns: PropTypes.array,
  colorbys: PropTypes.object,
  hidePopover: PropTypes.func.isRequired,
  modifyRowColor: PropTypes.func.isRequired,
};

export default RowColorPopover;
