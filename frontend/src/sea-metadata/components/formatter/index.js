import React from 'react';
import PropTypes from 'prop-types';
import TextFormatter from '../cell-formatter/text';
import CreatorFormatter from '../cell-formatter/creator';
import CTimeFormatter from '../cell-formatter/ctime';
import DateFormatter from '../cell-formatter/date';
import SingleSelectFormatter from '../cell-formatter/single-select';
import CollaboratorsFormatter from '../cell-formatter/collaborators';
import CheckboxFormatter from '../cell-formatter/checkbox';
import LongTextFormatter from '../cell-formatter/long-text';
import NumberFormatter from '../cell-formatter/number';
import MultipleSelectFormatter from '../cell-formatter/multiple-select';
import RateFormatter from '../cell-formatter/rate';
import TagsFormatter from '../cell-formatter/tags';
import URLFormatter from '../cell-formatter/URL';
import TagFormatter from '../cell-formatter/tag';
import Empty from './empty';
import { CellType } from '../../constants';
import './index.css';

const Formatter = ({ column, value, isSample, queryUserAPI, emptyTip, onClick, row, ...params }) => {
  const { type: columnType } = column || {};
  const className = `sea-metadata-${columnType}-formatter`;
  const props = {
    column: column,
    onClick: () => onClick && onClick(row)
  };
  switch (columnType) {
    case CellType.TEXT: {
      return (
        <TextFormatter value={value} column={column} className={className} { ...props } { ...props }>
          <Empty columnType={columnType} placeholder={emptyTip} />
        </TextFormatter>
      );
    }
    case CellType.URL: {
      return (
        <URLFormatter value={value} className={className} { ...props }>
          <Empty columnType={columnType} placeholder={emptyTip} />
        </URLFormatter>
      );
    }
    case CellType.CTIME:
    case CellType.MTIME: {
      return (
        <CTimeFormatter value={value} className={className} { ...props }>
          <Empty columnType={columnType} placeholder={emptyTip} />
        </CTimeFormatter>
      );
    }
    case CellType.CREATOR:
    case CellType.LAST_MODIFIER: {
      return (
        <CreatorFormatter value={value} className={className} api={queryUserAPI} { ...params } { ...props }>
          <Empty columnType={columnType} placeholder={emptyTip} />
        </CreatorFormatter>
      );
    }
    case CellType.DATE: {
      return (
        <DateFormatter value={value} format={column.data?.format} className={className} { ...props }>
          <Empty columnType={columnType} placeholder={emptyTip} />
        </DateFormatter>
      );
    }
    case CellType.SINGLE_SELECT: {
      return (
        <SingleSelectFormatter value={value} options={column.data?.options || []} row={row} className={className} { ...props }>
          <Empty columnType={columnType} placeholder={emptyTip} />
        </SingleSelectFormatter>
      );
    }
    case CellType.MULTIPLE_SELECT: {
      return (
        <MultipleSelectFormatter value={value} options={column.data?.options || []} className={className} { ...props }>
          <Empty columnType={columnType} placeholder={emptyTip} />
        </MultipleSelectFormatter>
      );
    }
    case CellType.COLLABORATOR: {
      return (
        <CollaboratorsFormatter value={value} className={className} api={queryUserAPI} {...params} { ...props }>
          <Empty columnType={columnType} placeholder={emptyTip} />
        </CollaboratorsFormatter>
      );
    }
    case CellType.CHECKBOX: {
      return (
        <CheckboxFormatter value={value} className={className} { ...props }>
          <Empty columnType={columnType} placeholder={emptyTip} />
        </CheckboxFormatter>
      );
    }
    case CellType.LONG_TEXT: {
      return (
        <LongTextFormatter {...params} value={value} className={className} { ...props }>
          <Empty columnType={columnType} placeholder={emptyTip} />
        </LongTextFormatter>
      );
    }
    case CellType.NUMBER: {
      return (
        <NumberFormatter value={value} formats={column?.data} className={className} { ...props }>
          <Empty columnType={columnType} placeholder={emptyTip} />
        </NumberFormatter>
      );
    }
    case CellType.RATE: {
      return (
        <RateFormatter value={value} data={column?.data} className={className} { ...props }>
          <Empty columnType={columnType} placeholder={emptyTip} />
        </RateFormatter>
      );
    }
    case CellType.TAGS: {
      return (
        <TagsFormatter value={value} className={className} showName={true} { ...props }>
          <Empty columnType={columnType} placeholder={emptyTip} />
        </TagsFormatter>
      );
    }
    case CellType.TAG: {
      return (
        <TagFormatter value={value} row={row} className={className} { ...props }>
          <Empty columnType={columnType} placeholder={emptyTip} />
        </TagFormatter>
      );
    }
    default: {
      return (
        <TextFormatter value={value} column={column} className={className} { ...props }>
          <Empty columnType={columnType} placeholder={emptyTip} />
        </TextFormatter>
      );
    }
  }
};

Formatter.propTypes = {
  isSample: PropTypes.bool,
  column: PropTypes.object.isRequired,
  value: PropTypes.any,
  tagsData: PropTypes.object,
};

export default Formatter;
