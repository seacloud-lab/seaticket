import React from 'react';
import PropTypes from 'prop-types';
import LinkRecordsItem from './link-records-item';
import LinkRecordsSearch from './link-records-search';
import { gettext } from '../../../utils/constants';
import { Utils } from '../../../utils/utils';

const propTypes = {
  linkColumn: PropTypes.object.isRequired,
  records: PropTypes.array.isRequired,
  popoverStyle: PropTypes.object.isRequired,
  linkedIdsMap: PropTypes.object.isRequired,
  scrollToMore: PropTypes.func.isRequired,
  initDisplayRecords: PropTypes.func.isRequired,
  updateLinkRows: PropTypes.func.isRequired,
  onSearch: PropTypes.func.isRequired,
  closeEditor: PropTypes.func,
};

const RECORD_ITEM_HEIGHT = 30;

class LinkRecordsPicker extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      highlightIndex: -1,
      maxItemNum: 0,
    };
  }

  componentDidMount() {
    if (this.recordsList) {
      const selectContainerStyle = getComputedStyle(this.recordsList, null);
      const maxItemNum = Math.floor(parseInt(selectContainerStyle.height) / RECORD_ITEM_HEIGHT);
      this.setState({ maxItemNum });
    }
    document.addEventListener('keydown', this.onHotKey, true);
  }

  componentWillUnmount() {
    this.props.initDisplayRecords();
    document.removeEventListener('keydown', this.onHotKey, true);
  }

  onHotKey = (e) => {
    if (e.keyCode === Utils.keyCodes.enter) {
      this.onEnter(e);
    } else if (e.keyCode === Utils.keyCodes.up) {
      this.onUpArrow(e);
    } else if (e.keyCode === Utils.keyCodes.down) {
      this.onDownArrow(e);
    } else if (e.keyCode === Utils.keyCodes.esc) {
      this.props.closeEditor();
    }
  };

  onEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { highlightIndex } = this.state;
    const { records } = this.props;
    const record = records[highlightIndex];
    if (record) {
      this.props.updateLinkRows(record);
    }
  };

  onUpArrow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { records, linkColumn } = this.props;
    const { highlightIndex, maxItemNum } = this.state;
    const newHighLightIndex = highlightIndex - 1;
    if (newHighLightIndex <= -1) return;
    const record = records[newHighLightIndex];
    const name = record[linkColumn.key];
    if (name) {
      this.setState({ highlightIndex: newHighLightIndex }, () => {
        const validRecords = records.filter(record => record[linkColumn.key]);
        if (newHighLightIndex < validRecords.length - maxItemNum) {
          this.recordsList.scrollTop -= RECORD_ITEM_HEIGHT;
        }
      });
    }
  };

  onDownArrow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { records, linkColumn } = this.props;
    const { highlightIndex, maxItemNum } = this.state;
    const newHighLightIndex = highlightIndex + 1;
    if (newHighLightIndex >= records.length) return;
    const record = records[newHighLightIndex];
    const name = record[linkColumn.key];
    if (name) {
      this.setState({ highlightIndex: newHighLightIndex }, () => {
        if (newHighLightIndex >= maxItemNum) {
          this.recordsList.scrollTop += RECORD_ITEM_HEIGHT;
        }
      });
    }
  };

  onLinkRecordsScroll = (event) => {
    event.stopPropagation();
    this.props.scrollToMore(this.recordsList, this.recordsContent);
  };

  render() {
    const { highlightIndex } = this.state;
    const { records, popoverStyle, linkColumn, linkedIdsMap } = this.props;
    return (
      <div className="link-records-picker" style={popoverStyle}>
        <div className="link-search-container">
          <LinkRecordsSearch onSearch={this.props.onSearch} />
        </div>
        <div className="link-records-container" ref={ref => this.recordsList = ref} onScroll={this.onLinkRecordsScroll}>
          {records.length === 0 && (
            <div className="records-tips">{gettext('No options to choose or find')}</div>
          )}
          {records.length > 0 &&
            <div className="link-records-content" ref={ref => this.recordsContent = ref}>
              {records.map((record, index) => {
                return (
                  <LinkRecordsItem
                    key={record._id}
                    index={index}
                    isHightLight={index === highlightIndex}
                    linkColumn={linkColumn}
                    linkedIdsMap={linkedIdsMap}
                    record={record}
                    updateLinkRows={this.props.updateLinkRows}
                  />
                );
              })}
            </div>
          }
        </div>
      </div>
    );
  }
}

LinkRecordsPicker.propTypes = propTypes;

export default LinkRecordsPicker;
