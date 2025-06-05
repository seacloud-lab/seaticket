import React from 'react';
import PropTypes from 'prop-types';
import { NEED_FORMATTER_COLUMN_TYPES } from '../../utils/constants';
import FormatterConfig from '../../cell-formatter/formatter-config';

const propTypes = {
  items: PropTypes.array,
  removeLink: PropTypes.func,
  linkColumn: PropTypes.object,
};

class LinkEditorItems extends React.Component {

  onClick = (e, option) => {
    e.stopPropagation();
    this.props.removeLink(option);
  };

  onMouseDown = (e) => {
    e.stopPropagation();
  };

  render() {
    const { items, linkColumn } = this.props;
    const iconClass = 'dtable-font dtable-icon-x link-remove-icon';

    if (NEED_FORMATTER_COLUMN_TYPES.includes(linkColumn.type)) {
      return (
        <div className="link-items-container">
          {items.map((item) => {
            const formatterProps = {
              value: item.name,
              column: linkColumn
            };
            const Formatter = FormatterConfig[linkColumn.type];
            const content = React.cloneElement(Formatter, { ...formatterProps });
            return (
              <div key={item._id} className="link-formatter-item">
                {content}
                <span className={iconClass} onMouseDown={this.onMouseDown} onClick={(e) => this.onClick(e, item)} />
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="link-items-container">
        {items.map((item) => {
          return (
            <div className="link-item" key={item._id}>
              <span className="text-truncate user-select-none link-name">{item.name}</span>
              <span className={iconClass} onMouseDown={this.onMouseDown} onClick={(e) => this.onClick(e, item)} />
            </div>
          );
        })}
      </div>
    );
  }
}

LinkEditorItems.propTypes = propTypes;

export default LinkEditorItems;
