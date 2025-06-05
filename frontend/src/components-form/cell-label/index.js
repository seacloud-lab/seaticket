import React from 'react';
import PropTypes from 'prop-types';
import { Tooltip } from 'reactstrap';
import { LongTextEditorDialog } from '@seafile/seafile-editor';
import { gettext } from '../../utils/constants';

import './label.css';

export default class CellLabel extends React.Component {

  static propTypes = {
    column: PropTypes.object,
    isShowHelpIcon: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.state = {
      isTooltipShow: false,
      isShowLongTextEditor: false
    };
  }

  toggleTooltip = () => {
    this.setState({ isTooltipShow: !this.state.isTooltipShow });
  };

  toggleLongTextEditor = () => {
    this.setState({ isShowLongTextEditor: !this.state.isShowLongTextEditor });
  };

  render() {
    const { isTooltipShow, isShowLongTextEditor } = this.state;
    let { column, isShowHelpIcon } = this.props;
    let { name, custom_name, is_required, key, description } = column;
    return (
      <label className="cell-label" >
        {custom_name || name}
        {is_required && (
          <span className="cell-is-required">*</span>
        )}
        {isShowHelpIcon &&
          <>
            <span
              className="dtable-font dtable-icon-use-help ml-2"
              id={`column-description-${key}`}
              onClick={this.toggleLongTextEditor}
            >
            </span>
            <Tooltip
              className='label column-description-tooltip'
              target={`column-description-${key}`}
              isOpen={isTooltipShow}
              placement='right'
              toggle={this.toggleTooltip}
            >
              {gettext('Click to view the help text for this column')}
            </Tooltip>
          </>
        }
        {isShowLongTextEditor && (
          <LongTextEditorDialog
            headerName={gettext('Help text')}
            value={description}
            editorApi={{}}
            autoSave={false}
            onSaveEditorValue={() => {}}
            onCloseEditorDialog={this.toggleLongTextEditor}
          />
        )}
      </label>
    );
  }
}
