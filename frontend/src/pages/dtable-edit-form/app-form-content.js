import React from 'react';
import PropTypes from 'prop-types';
import isHotkey from 'is-hotkey';
import { generatorBase64Code } from 'dtable-utils';
import SettingRowItem from './widgets/setting-row-item';
import EditRemarkContent from './widgets/edit-remark-content';
import FormThemeBackground from '../../components-form/form-theme-background';
import { FORM_ELEMENTS_TYPE, FORM_REMARK_DEFAULT_TEXT_COLOR, FORM_CONFIG_STATE,
  FORM_REMARK_DEFAULT_BACKGROUND_COLOR } from '../../constants/form-constants';
import FormBlankContent from './widgets/form-blank-content';
import FormContentVirtualElement from './widgets/form-content-virtual-element';
import FormContentStaticRemark from './widgets/form-content-static-remark';
import FormContentStaticSplitLine from './widgets/form-content-static-split-line';

const { canUseAdvancedCustomization } = window.shared.pageOptions;

class AppFormContent extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      showAddLogo: false,
    };
    this.formSettingsContainer = null;
    this.formNameInputRef = null;
    this.logo = React.createRef();
  }

  componentDidMount() {
    document.addEventListener('click', this.hideEditor);
  }

  componentWillUnmount() {
    this.formSettingsContainer = null;
    document.removeEventListener('click', this.hideEditor);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.tableId !== this.props.tableId) {
      this.props.updateSettingElement(null);
    }
  }

  hideEditor = (e) => {
    if (e.target.className === 'app-content-container') {
      this.props.updateSettingElement(null);
    }
  };

  onKeyDown = (e) => {
    let { selectionStart, selectionEnd, value } = e.currentTarget;
    if (isHotkey('enter', e)) {
      e.preventDefault();
      this.formNameInputRef.blur();
    } else if ((e.keyCode === 37 && selectionStart === 0) || (e.keyCode === 39 && selectionEnd === value.length)) {
      e.stopPropagation();
    }
  };

  deleteLogo = (e) => {
    e.stopPropagation();
    this.props.deleteLogo();
  };

  uploadLogo = (e) => {
    e.stopPropagation();
    this.logo.current.click();
  };

  onMouseEnter = () => {
    this.setState({ showAddLogo: true });
  };

  onMouseLeave = () => {
    this.setState({ showAddLogo: false });
  };

  // Drag to add new elements(column、static-remark、static-line)
  addItem = (optionSource, optionTarget) => {
    let { elementsOrder, staticElements, currentColumns } = this.props;
    const { type } = optionSource;
    const { idx: targetIndex } = optionTarget;
    if (type === FORM_ELEMENTS_TYPE.COLUMN) {
      const { key } = optionSource;
      const selectedColumnIndex = currentColumns.findIndex(column => column.key === key);
      const currentColumn = currentColumns[selectedColumnIndex];
      const update = { editable: !currentColumn.editable };
      const selectedColumn = { ...currentColumn, ...update };
      currentColumns[selectedColumnIndex] = selectedColumn;
      let newItem = { key, type: FORM_ELEMENTS_TYPE.COLUMN };
      elementsOrder.splice(targetIndex + 1, 0, newItem);
      this.props.onSave({ currentColumns, elementsOrder });
    } else if (type === FORM_ELEMENTS_TYPE.REMARKS) {
      let newItem = { key: generatorBase64Code(4), type: FORM_ELEMENTS_TYPE.REMARKS };
      elementsOrder.splice(targetIndex + 1, 0, newItem);
      staticElements.push({ ...newItem, value: '', text_color: FORM_REMARK_DEFAULT_TEXT_COLOR,
        background_color: FORM_REMARK_DEFAULT_BACKGROUND_COLOR });
      this.props.onSave({ staticElements, elementsOrder });
    } else {
      let newItem = { key: generatorBase64Code(4), type: FORM_ELEMENTS_TYPE.SPLIT_LINE };
      elementsOrder.splice(targetIndex + 1, 0, newItem);
      staticElements.push(newItem);
      this.props.onSave({ staticElements, elementsOrder });
    }
  };

  moveItem = (optionSource, optionTarget) => {
    let { elementsOrder } = this.props;
    const sourceData = elementsOrder[optionSource.idx];
    elementsOrder.splice(optionSource.idx, 1);
    elementsOrder.splice(optionTarget.idx, 0, sourceData);
    this.props.onSave({ elementsOrder });
  };

  renderLogo = () => {
    const { showAddLogo } = this.state;
    return (
      <div className="form-table-logo" onClick={this.uploadLogo}>
        {this.props.logoURL ?
          <div className="position-relative">
            <img src={this.props.logoURL} alt="logo"/>
            <i className="dtable-font dtable-icon-x-" onClick={this.deleteLogo}></i>
          </div>
          :
          <div
            className={`form-table-logo-area ${showAddLogo ? 'form-table-logo-area-add' : ''}`}
            onMouseEnter={this.onMouseEnter}
            onMouseLeave={this.onMouseLeave}
          >
            {showAddLogo ? <span className="dtable-font dtable-icon-enlarge"></span> : <span>LOGO</span>}
          </div>
        }
        <input type="file" className='form-table-logo-upload-image' accept="image/*" ref={this.logo} onChange={this.props.onLogoChange} />
      </div>
    );
  };

  componentDidUpdate() {
    if (this.formSaveTipContentRef) {
      const { width } = this.formSaveTipContentRef.getBoundingClientRect();
      this.formSaveTipContentRef.style.marginLeft = `${-1 * (width / 2)}px`;
    }
  }

  renderHeader = () => {
    const { formName, onRenameToggle, isTopRemarkContentShow, topRemarkContent } = this.props;
    return (
      <div className="form-table-title">
        {canUseAdvancedCustomization && this.renderLogo()}
        {onRenameToggle ? (
          <input
            defaultValue={formName}
            ref={ref => this.formNameInputRef = ref}
            className="edit-form-rename-input form-control"
            onBlur={this.props.onRenameForm}
            onKeyDown={this.onKeyDown}
            autoFocus={true}
          />
        ) : (
          <>
            <span className="edit-form-name">{formName}</span>
            <span onClick={this.props.renameToggle} className="dtable-font dtable-icon-rename"></span>
          </>
        )}
        {isTopRemarkContentShow &&
          <EditRemarkContent
            key="form-note-at-top"
            remarkContent={topRemarkContent}
            remarkType={FORM_CONFIG_STATE.TOP_REMARK_CONTENT}
            onSave={this.props.onSave}
          />
        }
      </div>
    );
  };

  renderFormElements = () => {
    const { currentColumns, settingElement, onColumnChanged, onColumnRequiredChanged, elementsOrder,
      staticElements, formColumnDescriptionColor, onSave } = this.props;
    if (elementsOrder.length === 0) {
      return (
        <FormBlankContent addItem={this.addItem}/>
      );
    }
    return elementsOrder.map((item, index) => {
      if (item.type === FORM_ELEMENTS_TYPE.COLUMN) {
        const column = currentColumns.find(column => column.key === item.key);
        if (!column) return null;
        const isEditing = settingElement && column.key === settingElement.key;
        return (
          <SettingRowItem
            key={column.key}
            index={index}
            isEditing={isEditing}
            column={column}
            formColumnDescriptionColor={formColumnDescriptionColor}
            isReadOnly={true}
            row={{}}
            currentColumns={currentColumns}
            elementsOrder={elementsOrder}
            onColumnRequiredChanged={onColumnRequiredChanged}
            onColumnChanged={onColumnChanged}
            onSave={onSave}
            moveItem={this.moveItem}
            addItem={this.addItem}
            updateSettingElement={this.props.updateSettingElement}
          />
        );
      } else if (item.type === FORM_ELEMENTS_TYPE.SPLIT_LINE) {
        return (
          <FormContentStaticSplitLine
            key={item.key}
            index={index}
            item={item}
            onSave={onSave}
            moveItem={this.moveItem}
            addItem={this.addItem}
            isEditFormPage={true}
            elementsOrder={elementsOrder}
            staticElements={staticElements}
          />
        );
      } else {
        const isEditing = settingElement && item.key === settingElement.key;
        return (
          <FormContentStaticRemark
            key={item.key}
            index={index}
            item={item}
            isEditing={isEditing}
            isEditFormPage={true}
            onSave={onSave}
            moveItem={this.moveItem}
            addItem={this.addItem}
            elementsOrder={elementsOrder}
            staticElements={staticElements}
            updateSettingElement={this.props.updateSettingElement}
          />
        );
      }
    });
  };

  render() {
    const { themeType, themeBackgroundColor, themeBackgroundImageURL,
      isRemarkContentShow, remarkContent, elementsOrder } = this.props;
    const isEmptyForm = elementsOrder && elementsOrder.length === 0;

    return (
      <div className="app-content-container">
        <FormThemeBackground
          themeType={themeType}
          themeBackgroundColor={themeBackgroundColor}
          themeBackgroundImageURL={themeBackgroundImageURL}
        />
        {this.renderHeader()}
        <div className="form-table-line"></div>
        <div className={`form-items-container ${isEmptyForm ? 'empty-container' : ''}`} ref={ref => this.formSettingsContainer = ref}>
          {!isEmptyForm && <FormContentVirtualElement addItem={this.addItem}/>}
          {this.renderFormElements()}
          {isRemarkContentShow &&
            <div className="form-note-bottom-container">
              <EditRemarkContent
                key="form-note-at-bottom"
                remarkContent={remarkContent}
                remarkType={FORM_CONFIG_STATE.REMARK_CONTENT}
                onSave={this.props.onSave}
              />
            </div>
          }
        </div>
      </div>
    );
  }
}

AppFormContent.propTypes = {
  isRemarkContentShow: PropTypes.bool,
  isTopRemarkContentShow: PropTypes.bool,
  onRenameToggle: PropTypes.bool,
  tableId: PropTypes.string.isRequired,
  formColumnDescriptionColor: PropTypes.string,
  currentColumns: PropTypes.array.isRequired,
  elementsOrder: PropTypes.array,
  staticElements: PropTypes.array,
  settingElement: PropTypes.object,
  topRemarkContent: PropTypes.string,
  remarkContent: PropTypes.string,
  formName: PropTypes.string,
  logoURL: PropTypes.string,
  themeType: PropTypes.string,
  themeBackgroundColor: PropTypes.string,
  themeBackgroundImageURL: PropTypes.string,
  onRenameForm: PropTypes.func.isRequired,
  renameToggle: PropTypes.func.isRequired,
  onLogoChange: PropTypes.func.isRequired,
  deleteLogo: PropTypes.func.isRequired,
  onSave: PropTypes.func,
  onColumnChanged: PropTypes.func.isRequired,
  updateSettingElement: PropTypes.func,
  onColumnRequiredChanged: PropTypes.func,
};

export default AppFormContent;
