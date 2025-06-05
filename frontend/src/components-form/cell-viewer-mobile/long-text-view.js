import React from 'react';
import PropTypes from 'prop-types';
import { TextareaItem } from 'antd-mobile';
import { getPreviewContent } from '@seafile/seafile-editor';
import * as zIndexes from '../utils/zIndexes';
import { gettext } from '../../utils/constants';
import MobileCommonHeader from './mobile-common-header';

const propTypes = {
  column: PropTypes.object,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onCommit: PropTypes.func,
  closeEditor: PropTypes.func
};

class LongTextView extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      value: props.value && props.value.text ? props.value.text : ''
    };
    const offsetWidth = document.body.offsetWidth;
    this.rowCounts = offsetWidth < 767.8 ? 10 : 20;
  }

  componentDidMount() {
    history.pushState(null, null, '#');
    window.addEventListener('popstate', this.handleHistoryBack, false);
    this.timer = setInterval(() => {
      this.saveValue();
    }, 60000);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    window.removeEventListener('popstate', this.handleHistoryBack, false);
  }

  handleHistoryBack = (e) => {
    e.preventDefault();
    this.closeDialog();
  };

  saveValue = () => {
    const markdownContent = this.state.value;
    const { previewText, images, links } = getPreviewContent(markdownContent);
    const newValue = Object.assign({}, { text: markdownContent, preview: previewText, images: images, links: links });
    this.props.onCommit(newValue);
  };

  closeDialog = () => {
    this.saveValue();
    this.props.closeEditor();
  };

  handleChange = (value) => {
    this.setState({ value });
  };

  render() {
    const { column } = this.props;
    return (
      <div className="row-expand-view long-text-view h-100" style={{ zIndex: zIndexes.ROW_EXPAND_VIEW }}>
        <MobileCommonHeader
          title={column.name}
          onLeftClick={this.closeDialog}
          onRightClick={this.closeDialog}
          leftName={gettext('Cancel')}
          rightName={gettext('Done')}
        />
        <div className="view-partition view-partition-border-bottom"></div>
        <div className="long-text-container">
          <TextareaItem rows={this.rowCounts} value={this.state.value} onChange={this.handleChange} />
        </div>
      </div>
    );
  }
}

LongTextView.propTypes = propTypes;

export default LongTextView;
