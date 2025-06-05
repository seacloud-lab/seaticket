import React from 'react';
import PropTypes from 'prop-types';
import MediaQuery from 'react-responsive';
import { getGeolocationDisplayString } from 'dtable-utils';
import { ClickOutside } from 'dtable-ui-component';
import { gettext } from '../../utils/constants';
import Geolocation from './widgets/geolocation-editor/geolocation';
import GeolocationView from '../cell-viewer-mobile/geolocation-view';
import { getBaiduMapKey } from './widgets/geolocation-editor/map-editor-utils';

import '../cell-css/geolocation-editor.css';

const GeolocationEditorPropTypes = {
  value: PropTypes.object,
  column: PropTypes.object,
  onCommit: PropTypes.func,
  mode: PropTypes.string,
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  isEditorShow: PropTypes.bool,
};

class GeolocationEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
  };

  constructor(props) {
    super(props);
    this.state = {
      isShowEditor: false,
      value: {},
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
    this.setState({ isShowEditor: !this.state.isShowEditor });
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
      <ClickOutside onClickOutside={this.onClickOutside}>
        <div ref={this.editorContainer}>
          <MediaQuery query="(min-width: 768px)">
            <Geolocation
              mapKey={dtableBaiduMapKey}
              value={value}
              column={column}
              onCommitCancel={this.toggleEditor}
              onCommit={this.onCommit}
            />
          </MediaQuery>
          <MediaQuery query="(max-width: 767.8px)">
            <GeolocationView
              mapKey={dtableBaiduMapKey}
              column={column}
              value={value}
              onCommit={this.onCommit}
              closeEditor={this.toggleEditor}
            />
          </MediaQuery>
        </div>
      </ClickOutside>
    );
  };

  renderBtn = () => {
    let isEmpty = this.isEmpty(this.state.value);
    if (isEmpty) {
      return (
        <div className="cell-editor grid-cell-type-geolocation" onClick={this.toggleEditor}>
          <div className="select-editor-add" onClick={this.onFileEditorToggle} >
            {gettext('Edit location')}
          </div>
        </div>
      );
    }
    return (
      <div className="cell-editor grid-cell-type-geolocation" onClick={this.toggleEditor}>
        <div className="geolocation-content">
          {this.getLocationInfo(this.state.value)}
        </div>
      </div>
    );
  };

  render() {
    const { isShowEditor } = this.state;
    return (isShowEditor ? this.renderEditor() : this.renderBtn());
  }
}

GeolocationEditor.propTypes = GeolocationEditorPropTypes;

export default GeolocationEditor;
