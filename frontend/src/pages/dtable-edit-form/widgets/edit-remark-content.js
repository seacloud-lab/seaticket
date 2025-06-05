import React from 'react';
import PropTypes from 'prop-types';
import { FORM_CONFIG_STATE } from '../../../constants/form-constants';
import LongTextEditorPreviewAll from '../../../components-form/cell-editor-widgets/long-text-editor-preview-all';

const propTypes = {
  remarkContent: PropTypes.string,
  remarkType: PropTypes.string,
  onSave: PropTypes.func,
};

class EditRemarkContent extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowDeleteTextBtn: false,
    };
  }

  onMouseEnter = () => {
    this.setState({ isShowDeleteTextBtn: true });
  };

  onMouseLeave = () => {
    this.setState({ isShowDeleteTextBtn: false });
  };

  onDeleteTextBtnClick = () => {
    const { remarkType } = this.props;
    if (remarkType === FORM_CONFIG_STATE.TOP_REMARK_CONTENT) {
      this.props.onSave({ topRemarkContent: '', isTopRemarkContentShow: false });
    } else if (remarkType === FORM_CONFIG_STATE.REMARK_CONTENT) {
      this.props.onSave({ remarkContent: '', isRemarkContentShow: false });
    }
  };

  render() {
    const { remarkContent } = this.props;
    const { isShowDeleteTextBtn } = this.state;
    return (
      <div className="form_mode compose-editor note-editor-content" onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
        {isShowDeleteTextBtn &&
          <span className="dtable-font dtable-icon-delete" onClick={this.onDeleteTextBtnClick}></span>
        }
        <LongTextEditorPreviewAll
          newValue={{ text: remarkContent }}
        />
      </div>
    );
  }
}

EditRemarkContent.propTypes = propTypes;

export default EditRemarkContent;
