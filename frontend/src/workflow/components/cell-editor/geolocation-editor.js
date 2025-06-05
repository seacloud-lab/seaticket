import React from 'react';
import PropTypes from 'prop-types';
import MediaQuery from 'react-responsive';
import { getGeolocationDisplayString } from 'dtable-utils';
import { ClickOutside } from 'dtable-ui-component';
import Geolocation from './widgets/geolocation-editor/geolocation';
import GeolocationView from '../../../components-form/cell-viewer-mobile/geolocation-view';
import ValueEmpty from '../../components/common/value-empty';
import { getBaiduMapKey } from '../../../components-form/cell-editor/widgets/geolocation-editor/map-editor-utils';

import '../../css/cell-editor/geolocation-editor.css';

const gettext = window.gettext;

class GeolocationEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
  };

  constructor(props) {
    super(props);
    this.state = {
      isShowEditor: false,
      value: props.value || {},
    };
    this.editorContainer = React.createRef();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.isEditorShow !== this.props.isEditorShow) {
      this.setState({ isShowEditor: nextProps.isEditorShow });
    }
  }

  onClickOutside = (e) => {
    if (this.state.isShowEditor && !this.editorContainer.current.contains(e.target)) {
      this.setState({ isShowEditor: false });
    }
  };

  toggleEditor = () => {
    if (this.props.isReadOnly || this.props.isSubmitting) return;
    this.setState({ isShowEditor: !this.state.isShowEditor }, () => {
      this.props.updateTabIndex && this.props.updateTabIndex();
    });
  };

  onCommit = (value, column) => {
    this.props.onCommit(value, column);
    this.setState({ value: value[column.key] });
    this.toggleEditor();
  };

  isEmpty = (value) => {
    return Object.keys(value).length === 0;
  };

  getLocationInfo = (value) => {
    const { column } = this.props;
    return getGeolocationDisplayString(value, column.data, { hyphen: ' ' });
  };

  renderEditor = () => {
    const { column } = this.props;
    const { value } = this.state;
    const dtableBaiduMapKey = getBaiduMapKey();
    return (
      <>
        <MediaQuery query="(min-width: 768px)">
          <Geolocation
            mapKey={dtableBaiduMapKey}
            value={value || {}}
            column={column}
            target={`grid-cell-type-geolocation-${column.key}`}
            onCommitCancel={this.toggleEditor}
            onCommit={this.onCommit}
            onGeolocationPopoverToggle={this.toggleEditor}
          />
        </MediaQuery>
        <MediaQuery query="(max-width: 767.8px)">
          <ClickOutside onClickOutside={this.onClickOutside}>
            <div ref={this.editorContainer}>
              <GeolocationView
                mapKey={dtableBaiduMapKey}
                column={column}
                value={value}
                onCommit={this.onCommit}
                closeEditor={this.toggleEditor}
              />
            </div>
          </ClickOutside>
        </MediaQuery>
      </>
    );
  };

  renderBtn = () => {
    const isEmpty = this.isEmpty(this.state.value);
    const { isReadOnly } = this.props;
    if (isEmpty) {
      if (isReadOnly) {
        return (<ValueEmpty />);
      }
      return (
        <div className="select-editor-add" onClick={this.toggleEditor} >
          {gettext('Edit location')}
        </div>
      );
    }
    return (
      <div className={`geolocation-content ${isReadOnly ? 'readOnly' : ''}`}>
        {this.getLocationInfo(this.state.value)}
      </div>
    );
  };

  render() {
    const { column } = this.props;
    const { isShowEditor } = this.state;

    return (
      <>
        <div className="cell-editor grid-cell-type-geolocation" id={`grid-cell-type-geolocation-${column.key}`} onClick={this.toggleEditor}>
          {this.renderBtn()}
        </div>
        {isShowEditor && this.renderEditor()}
      </>
    );
  }
}

GeolocationEditor.propTypes = {
  value: PropTypes.object,
  column: PropTypes.object,
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  isEditorShow: PropTypes.bool,
  onCommit: PropTypes.func,
  updateTabIndex: PropTypes.func,
};

export default GeolocationEditor;
