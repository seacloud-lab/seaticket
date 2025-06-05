import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { generatorBase64Code } from 'dtable-utils';
import FormSettingStaticNotes from './form-setting-static-remark';
import FormSettingStaticSplitLine from './form-setting-static-split-line';
import { FORM_ELEMENTS_TYPE, FORM_REMARK_DEFAULT_TEXT_COLOR,
  FORM_REMARK_DEFAULT_BACKGROUND_COLOR } from '../../../constants/form-constants';

const gettext = window.gettext;

class FormSettingStatic extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowLabels: true,
    };
  }

  onShowLabelsToggle = () => {
    this.setState({ isShowLabels: !this.state.isShowLabels });
  };

  onAddSplitLine = () => {
    let { staticElements, elementsOrder } = this.props;
    let newItem = { key: generatorBase64Code(4), type: FORM_ELEMENTS_TYPE.SPLIT_LINE };
    elementsOrder.push(newItem);
    staticElements.push(newItem);
    this.props.onSave({ staticElements, elementsOrder });
  };

  onAddNotes = () => {
    let { staticElements, elementsOrder } = this.props;
    let newItem = { key: generatorBase64Code(4), type: FORM_ELEMENTS_TYPE.REMARKS };
    elementsOrder.push(newItem);
    staticElements.push({ ...newItem, value: '', text_color: FORM_REMARK_DEFAULT_TEXT_COLOR,
      background_color: FORM_REMARK_DEFAULT_BACKGROUND_COLOR });
    this.props.onSave({ staticElements, elementsOrder });
  };

  render() {
    const { isShowLabels } = this.state;
    return (
      <div className="table-setting">
        <div className="column-setting-header">
          <div className="title">{gettext('Static elements')}</div>
          <div>
            <span className="mr-1" onClick={this.onShowLabelsToggle}>
              <i className={`dtable-font dtable-icon-right ${isShowLabels ? 'dtable-icon-spin' : ''}`}></i>
            </span>
          </div>
        </div>
        {isShowLabels &&
          <div className="column-setting-container">
            <FormSettingStaticNotes onAddNotes={this.onAddNotes}/>
            <FormSettingStaticSplitLine onAddSplitLine={this.onAddSplitLine}/>
          </div>
        }
      </div>
    );
  }
}

FormSettingStatic.propTypes = {
  elementsOrder: PropTypes.array,
  staticElements: PropTypes.array,
  onSave: PropTypes.func
};

export default FormSettingStatic;
