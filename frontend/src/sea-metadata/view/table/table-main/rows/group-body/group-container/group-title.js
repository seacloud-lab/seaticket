import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { gettext } from '@/constants';
import CellFormatter from '@/sea-metadata/components/cell-formatter';
import { getOption, getColumnOptions, getTypesOptions, getOptionDisplayNameByOption, getTagsOptions } from '@/sea-metadata/utils/column';
import { CellType, DELETED_OPTION_BACKGROUND_COLOR, PRIORITY_MAP } from '@/sea-metadata/constants';
import { useTagsData, useTypesData } from '@/sea-metadata/hooks';
import Tag from '@/sea-metadata/components/tag';

const GroupTitle = ({ column, cellValue, originalCellValue }) => {
  const emptyTip = useMemo(() => `(${gettext('Empty')})`, []);
  const deletedOptionTip = useMemo(() => gettext('Deleted option'), []);

  const { typesData } = useTypesData();
  const { tagsData } = useTagsData();

  const renderGroupCellVal = useCallback(() => {
    const { type } = column;
    switch (type) {
      case CellType.CREATOR:
      case CellType.LAST_MODIFIER: {
        if (!originalCellValue) return emptyTip;
        return (<CellFormatter value={originalCellValue} column={column} />);
      }
      case CellType.NUMBER: {
        if (!cellValue && cellValue !== 0) return emptyTip;
        return cellValue;
      }
      case CellType.COLLABORATOR: {
        if (!Array.isArray(cellValue) || cellValue.length === 0) return emptyTip;
        return (<CellFormatter value={cellValue} column={column} />);
      }
      case CellType.CHECKBOX: {
        return <input className="checkbox" type="checkbox" readOnly={true} checked={cellValue} />;
      }
      case CellType.SINGLE_SELECT:
      case CellType.TYPE: {
        const options = type === CellType.SINGLE_SELECT ? getColumnOptions(column) : getTypesOptions(typesData);
        if (options.length === 0 || !originalCellValue) return emptyTip;
        const selectedOption = getOption(options, originalCellValue);
        const style = selectedOption ?
          {
            backgroundColor: selectedOption.color,
            color: selectedOption.text_color
          } :
          { backgroundColor: DELETED_OPTION_BACKGROUND_COLOR };
        const optionName = selectedOption ? getOptionDisplayNameByOption(selectedOption) : deletedOptionTip;
        return (<div className="sea-metadata-single-select-option" style={style} key={cellValue} title={optionName}>{optionName}</div>);
      }
      case CellType.MULTIPLE_SELECT: {
        const options = getColumnOptions(column);
        if (options.length === 0 || !Array.isArray(originalCellValue) || originalCellValue.length === 0) return emptyTip;
        const selectedOptions = options.filter((option) => originalCellValue.includes(option.id) || originalCellValue.includes(option.name));
        const invalidOptionIds = originalCellValue.filter(optionId => optionId && !options.find(o => o.id === optionId || o.name === optionId));
        const invalidOptions = invalidOptionIds.map(optionId => ({
          id: optionId,
          name: deletedOptionTip,
          color: DELETED_OPTION_BACKGROUND_COLOR,
        }));
        return (
          <>
            {selectedOptions.map(option => {
              const style = { backgroundColor: option.color, color: option.text_color };
              return (<div className="sea-metadata-multiple-select-option" style={style} key={option.id} title={option.name}>{option.name}</div>);
            })}
            {invalidOptions.map(option => {
              const style = { backgroundColor: option.color };
              return (<div className="sea-metadata-multiple-select-option" style={style} key={option.id} title={option.name}>{option.name}</div>);
            })}
          </>
        );
      }
      case CellType.TAGS: {
        const options = getTagsOptions(tagsData);
        if (options.length === 0 || !Array.isArray(originalCellValue) || originalCellValue.length === 0) return emptyTip;
        const selectedOptions = options.filter((option) => cellValue.includes(option.id) || cellValue.includes(option.name));
        const invalidOptionIds = cellValue.filter(optionId => optionId && !options.find(o => o.id === optionId || o.name === optionId));
        const invalidOptions = invalidOptionIds.map(optionId => ({
          id: optionId,
          name: gettext('Deleted tag'),
          color: DELETED_OPTION_BACKGROUND_COLOR,
        }));
        return (
          <>
            {selectedOptions.map(tag => (<Tag tag={tag} key={tag.id} />))}
            {invalidOptions.map(tag => (<Tag tag={tag} key={tag.id} />))}
          </>
        );
      }
      case CellType.PRIORITY: {
        const item = PRIORITY_MAP[cellValue];
        if (!cellValue || !item) return emptyTip;
        return (<CellFormatter value={cellValue} column={column}/>);
      }
      default: {
        return cellValue || emptyTip;
      }
    }
  }, [column, cellValue, originalCellValue, emptyTip, deletedOptionTip]);

  return (
    <div className="group-title">
      <div className="color-gray font-size-12 line-height-16">{column.display_name}</div>
      <div className="group-cell-value font-size-14 font-weight-500 line-height-20 d-flex">{renderGroupCellVal()}</div>
    </div>
  );
};

GroupTitle.propTypes = {
  originalCellValue: PropTypes.any,
  cellValue: PropTypes.any,
  column: PropTypes.object,
};

export default GroupTitle;
