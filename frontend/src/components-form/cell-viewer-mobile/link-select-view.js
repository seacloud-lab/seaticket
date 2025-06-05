import React from 'react';
import PropTypes from 'prop-types';
import { List } from 'antd-mobile';
import { gettext } from '../../utils/constants';
import MobileModal from './mobile-modal';
import { NEED_FORMATTER_COLUMN_TYPES } from '../utils/constants';
import FormatterConfig from '../cell-formatter/formatter-config';

const propTypes = {
  column: PropTypes.object.isRequired,
  linkColumn: PropTypes.object.isRequired,
  records: PropTypes.array.isRequired,
  linkedIdsMap: PropTypes.object.isRequired,
  updateLinkRows: PropTypes.func.isRequired,
  onSearch: PropTypes.func.isRequired,
  scrollToMore: PropTypes.func.isRequired,
  closeEditor: PropTypes.func.isRequired
};

class LinkSelectView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchVal: '',
    };
    this.isInputChinese = false;
  }

  onClick = (e) => {
    e.stopPropagation();
  };

  onMouseDown = (e) => {
    this.onClick(e);
  };

  onCompositionStart = (e) => {
    e.stopPropagation();
    this.isInputChinese = true;
  };

  onCompositionEnd = (e) => {
    e.stopPropagation();
    this.isInputChinese = false;
    this.onChange(e);
  };

  onChange = (e) => {
    e.stopPropagation();
    const value = e.target.value;
    this.setState({ searchVal: value }, () => {
      if (this.isInputChinese) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        const searchValue = value ? value.trim() : '';
        this.props.onSearch(searchValue);
      }, 300);
    });
  };

  onSelectOption = (record, e) => {
    e.stopPropagation();
    this.props.updateLinkRows(record);
  };

  onScroll = (event) => {
    event.stopPropagation();
    this.props.scrollToMore(this.containerRef, this.contentRef);
  };

  renderSearch = () => {
    return (
      <div className="mobile-search-selects">
        <input
          className="form-control"
          type="text"
          placeholder={gettext('Search option')}
          value={this.state.searchVal}
          onClick={this.onClick}
          onMouseDown={this.onMouseDown}
          onCompositionStart={this.onCompositionStart}
          onCompositionEnd={this.onCompositionEnd}
          onChange={this.onChange}
        />
      </div>
    );
  };

  renderList = () => {
    const { records, linkColumn, linkedIdsMap } = this.props;
    if (records.length === 0 && !this.state.searchVal) {
      return <List.Item className="none-search-result">{gettext('No options to choose or find')}</List.Item>;
    }

    if (records.length === 0 && this.state.searchVal) {
      return <List.Item className="none-search-result">{gettext('No options available')}</List.Item>;
    }

    return (
      <div className="options-container" ref={ref => this.containerRef = ref} onScroll={this.onScroll}>
        <div className='options-content' ref={ref => this.contentRef = ref}>
          {records.map((record) => {
            const name = record[linkColumn.key];
            const isSelect = linkedIdsMap[record._id];
            let content = <span className="text-truncate record-content">{name}</span>;
            if (NEED_FORMATTER_COLUMN_TYPES.includes(linkColumn.type)) {
              const formatterProps = {
                value: name,
                column: linkColumn
              };
              const Formatter = FormatterConfig[linkColumn.type];
              content = React.cloneElement(Formatter, { ...formatterProps });
            }

            return (
              <List.Item key={record._id} onClick={this.onSelectOption.bind(this, record)}>
                <div className="select-container">
                  <div className="user-select-none link-record-item">
                    {content}
                    <div className="option-checked mr-2">
                      {isSelect && <i className="dtable-font dtable-icon-check-mark"></i>}
                    </div>
                  </div>
                </div>
              </List.Item>
            );
          })}
        </div>
      </div>
    );
  };

  render() {
    return (
      <MobileModal closeModal={this.props.closeEditor}>
        <List renderHeader={this.props.column.name} className="popup-list mobile-select-editor">
          {this.renderSearch()}
          {this.renderList()}
        </List>
      </MobileModal>
    );
  }
}

LinkSelectView.propTypes = propTypes;

export default LinkSelectView;
