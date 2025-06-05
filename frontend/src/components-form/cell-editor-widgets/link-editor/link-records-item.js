import React from 'react';
import PropTypes from 'prop-types';
import FormatterConfig from '../../cell-formatter/formatter-config';
import { NEED_FORMATTER_COLUMN_TYPES } from '../../utils/constants';

const propTypes = {
  isHightLight: PropTypes.bool,
  linkColumn: PropTypes.object.isRequired,
  record: PropTypes.object.isRequired,
  linkedIdsMap: PropTypes.object.isRequired,
  updateLinkRows: PropTypes.func.isRequired,
};

class LinkRecordsItem extends React.Component {

  updateLinkRows = (event) => {
    event.stopPropagation();
    const { record } = this.props;
    this.props.updateLinkRows(record);
  };

  render() {
    const { record, linkColumn, linkedIdsMap, isHightLight } = this.props;
    const name = record[linkColumn.key];
    if (!name) {
      return null;
    }

    const { type } = linkColumn;
    const isSelect = linkedIdsMap[record._id];
    let content = <span className="text-truncate user-select-none record-content" title={name}>{name}</span>;
    if (NEED_FORMATTER_COLUMN_TYPES.includes(type)) {
      const formatterProps = {
        value: name,
        column: linkColumn
      };
      const Formatter = FormatterConfig[type];
      content = React.cloneElement(Formatter, { ...formatterProps });
    }

    return (
      <div className={`user-select-none link-record-item ${isHightLight && 'hovered'}`} onClick={this.updateLinkRows}>
        <div className='option-info'>
          {content}
        </div>
        <div className="option-checked">
          {isSelect && <i className="dtable-font dtable-icon-check-mark"></i>}
        </div>
      </div>
    );
  }

}

LinkRecordsItem.propTypes = propTypes;

export default LinkRecordsItem;
