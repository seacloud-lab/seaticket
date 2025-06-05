import React, { Fragment, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody } from 'reactstrap';
import { CellType, generatorBase64Code } from 'dtable-utils';
import { toaster } from 'dtable-ui-component';
import { DTableModalHeader } from 'dtable-ui-component';
import { dtableWebAPI } from '../../../../api/dtable-web-api';
import ShareFormLinksContainer from './share-form-links-container';
import EditLinkContainer from './edit-link-container';
import ObjectUtils from '../../../../utils/object-utils';
import { Utils } from '../../../../utils/utils';
import { getValidColumns, getShareFormLinks, getEmptyFieldItems, getSearchParams, getPresetContent } from '../../../../utils/form-utils';
import { gettext } from '../../../../utils/constants';

import '../../css/prepare-fill-dialog.css';

const { token, canUseAdvancedCustomization } = window.shared.pageOptions;

const propTypes = {
  link: PropTypes.string,
  formName: PropTypes.string,
  columns: PropTypes.array,
  shareFormLinks: PropTypes.array,
  elementsOrder: PropTypes.array,
  onChangeShareFormLinks: PropTypes.func,
  onShareDialogToggle: PropTypes.func
};

/** fieldItem data structure
   * key: '',
   * column_key: ''.
   * value: '',
   * permission: 'rw / r'
*/

const ShareFormDialog = ({ link, formName, columns, elementsOrder, shareFormLinks: shareFormLinksSetting, onChangeShareFormLinks, onShareDialogToggle }) => {
  const [selectedLink, setSelectedLink] = useState('');
  const [formLinkName, setFormLinkName] = useState('');
  const [formCustomUrl, setFormCustomUrl] = useState('');
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [fieldItemsList, setFieldItemsList] = useState([]);
  const [shareFormLinks, setShareFormLinks] = useState(() => getShareFormLinks(shareFormLinksSetting));

  const getFieldItem = (item) => {
    const { column_key: columnKey, value, permission } = item;
    const fieldItem = {
      column_key: columnKey,
      value,
      permission,
    };
    return fieldItem;
  };

  const getPermissionAndPreFill = (key) => {
    let permission; let preFillName;
    if (key.slice(0, 8) === 'prefill_') {
      permission = 'rw';
      preFillName = decodeURIComponent(key.slice(8));
    } else if (key.slice(0, 13) === 'prefillForce_') {
      permission = 'r';
      preFillName = decodeURIComponent(key.slice(13));
    } else if (key && key.slice(0, 12) === 'prefillHide_') {
      permission = 'hidden';
      preFillName = decodeURIComponent(key.slice(12));
    }
    return { permission, preFillName };
  };

  const canModifyLink = () => {
    let canModifyLink = false;
    const newName = formLinkName;
    const newCustomUrlValue = formCustomUrl;
    const emptyFieldItems = getEmptyFieldItems(fieldItemsList, columns);
    if (!selectedLink || emptyFieldItems.length > 0) return canModifyLink;

    const shareFormLink = shareFormLinks.find(item => item.value === selectedLink);
    const oldName = shareFormLink && shareFormLink.name;
    const oldCustomUrlValue = shareFormLink && shareFormLink.custom_url;

    let oldFields = {}; let newFields = {};
    fieldItemsList.forEach(item => {
      const { column_key: columnKey } = getFieldItem(item);
      newFields[columnKey] = getFieldItem(item);
    });

    const searchParams = getSearchParams(selectedLink);
    if (searchParams) {
      for (let query of searchParams) {
        const [key, value] = query;
        const { preFillName, permission } = getPermissionAndPreFill(key);
        let preFillValue = value ? value.trim() : '';
        const column = columns.find(column => column.name === preFillName) || {};
        const { type, key: columnKey } = column;
        if (type === CellType.MULTIPLE_SELECT) {
          preFillValue = value ? value.split(',') : [];
        }
        const fieldItem = {
          column_key: columnKey,
          value: preFillValue,
          permission,
        };
        oldFields[columnKey] = fieldItem;
      }
    }
    if (newName !== oldName || newCustomUrlValue !== oldCustomUrlValue || ObjectUtils.isObjectChanged(oldFields, newFields)) {
      canModifyLink = true;
    }
    return canModifyLink;
  };

  const canGenerateLink = () => {
    return !!formLinkName.trim();
  };

  const onAddFieldItem = () => {
    const newFieldItem = {
      key: generatorBase64Code(4),
      column_key: '',
      value: '',
      permission: 'r',
    };
    let updatedFieldItemsList = [...fieldItemsList];
    updatedFieldItemsList.push(newFieldItem);
    setFieldItemsList(updatedFieldItemsList);
  };

  const onDeleteFieldItem = (fieldItemKey) => {
    const deletedFieldItemsList = [...fieldItemsList];
    const deletedFieldIndex = deletedFieldItemsList.findIndex(item => item.key === fieldItemKey);
    deletedFieldItemsList.splice(deletedFieldIndex, 1);
    setFieldItemsList(deletedFieldItemsList);
  };

  const onUpdateFieldItem = (fieldItemKey, update) => {
    let updatedFieldItemsList = [...fieldItemsList];
    const index = updatedFieldItemsList.findIndex(item => item.key === fieldItemKey);
    let fieldItem = updatedFieldItemsList[index];
    const newFieldItem = { ...fieldItem, ...update };
    updatedFieldItemsList[index] = newFieldItem;
    setFieldItemsList(updatedFieldItemsList);
  };


  const getFormCustomLink = async () => {
    try {
      const res = await dtableWebAPI.addFormCustomUrls(token, formCustomUrl);
      const formCustomLink = res.data.form_custom_link;
      return formCustomLink;
    } catch (error) {
      handleError(error);
    }
  };

  const generateFormLink = async () => {
    let formCustomLink = {
      form_link: link,
      created_at: new Date(),
      custom_url: '',
    };
    if (canUseAdvancedCustomization && formCustomUrl) {
      formCustomLink = await getFormCustomLink();
      if (!formCustomLink) return;
    }
    let fromCustomLink = formCustomLink.form_link;
    const urlCreatedTime = formCustomLink.created_at;
    const customUrl = formCustomLink.custom_url;
    const presetContent = getPresetContent(fieldItemsList, columns);

    // If the user sets a preset content, splice the preset content in the custom url
    if (presetContent) {
      fromCustomLink = `${fromCustomLink}?${presetContent}`;
    }

    const shareFormLink = {
      value: fromCustomLink,
      name: formLinkName,
      created_at: urlCreatedTime,
      custom_url: customUrl,
    };
    const updatedShareFormLinks = [...shareFormLinks];
    updatedShareFormLinks.push(shareFormLink);
    const message = gettext('The form custom share link has been generated');
    onCommit(updatedShareFormLinks, message);
  };

  const deleteFormCustomUrl = async (shareFromLink) => {
    try {
      const res = await dtableWebAPI.deleteFormCustomUrl(token, shareFromLink.custom_url);
      return res;
    } catch (error) {
      handleError(error);
    }
  };

  const onDeleteLink = async (shareFromLink) => {
    const deletedShareFormLinks = [...shareFormLinks];
    const index = deletedShareFormLinks.findIndex(item => item.value === shareFromLink.value);
    const { custom_url: customUrl = '' } = shareFromLink || {};
    if (canUseAdvancedCustomization && customUrl) {
      await deleteFormCustomUrl(shareFromLink);
    }
    deletedShareFormLinks.splice(index, 1);
    setShareFormLinks(deletedShareFormLinks);
    onChangeShareFormLinks(deletedShareFormLinks);
    const message = gettext('The form custom share link has been deleted');
    toaster.success(message);
  };

  const modifyFormLink = async () => {
    const index = shareFormLinks.findIndex(item => item.value === selectedLink);
    let updatedLink = shareFormLinks[index];
    const { custom_url: customUrl } = updatedLink;
    const parts = selectedLink.split('?');
    let formCustomLink = parts[0];

    if (customUrl !== formCustomUrl) {
      if (typeof customUrl === 'string' && customUrl !== '') {
        await deleteFormCustomUrl(updatedLink);
      }
      // If the value of formCustomUrl changes and the value is not empty, should generate new link
      if (typeof formCustomUrl === 'string' && formCustomUrl !== '') {
        const fromCustomLinkItem = await getFormCustomLink();
        if (!fromCustomLinkItem) return;
        formCustomLink = fromCustomLinkItem.form_link;
      }
    }
    const presetContent = getPresetContent(fieldItemsList, columns);
    if (presetContent) {
      formCustomLink = `${formCustomLink}?${presetContent}`;
    }

    updatedLink.value = formCustomLink;
    updatedLink.name = formLinkName;
    updatedLink.custom_url = formCustomUrl;
    let updatedShareFormLinks = shareFormLinks.slice(0);
    updatedShareFormLinks[index] = updatedLink;
    const message = gettext('The form custom share link has been modified');
    onCommit(updatedShareFormLinks, message);
  };

  const onCommit = (shareFormLinks, message) => {
    setShareFormLinks(shareFormLinks);
    onChangeShareFormLinks(shareFormLinks);
    toaster.success(message);
    closeEditLinkContainer();
  };

  const handleError = (error) => {
    const errorMsg = Utils.getErrorMsg(error);
    toaster.danger(errorMsg);
  };

  const onSelectLink = (linkItem) => {
    const updatedFieldItemsList = [...fieldItemsList];
    const { name, value, custom_url } = linkItem;
    const searchParams = getSearchParams(value);
    if (searchParams) {
      for (let query of searchParams) {
        const [key, value] = query;
        const { permission, preFillName } = getPermissionAndPreFill(key);
        let preFillValue = value ? value.trim() : '';
        const column = columns.find(column => column.name === preFillName) || {};
        if (column.type === CellType.MULTIPLE_SELECT) {
          preFillValue = value ? value.split(',') : [];
        }
        const fieldItem = {
          key: generatorBase64Code(4),
          column_key: column.key,
          value: preFillValue,
          permission,
        };
        updatedFieldItemsList.push(fieldItem);
      }
    }
    setIsEditingLink(true);
    setSelectedLink(value);
    setFormLinkName(name);
    setFormCustomUrl(custom_url);
    setFieldItemsList(updatedFieldItemsList);
  };

  const closeEditLinkContainer = () => {
    setSelectedLink('');
    setFormLinkName('');
    setFormCustomUrl('');
    setIsEditingLink(false);
    setFieldItemsList([]);
  };

  const renderHeader = () => {
    return (
      <div className="form-presets-setting-header d-flex align-items-center justify-content-between">
        <div>
          {isEditingLink ? (
            <>
              <span className="form-presets-header-return mr-1" onClick={closeEditLinkContainer}>
                <i className="dtable-font dtable-icon-return"></i>
              </span>
              <span className="form-header-title">{gettext('Add form link')}</span>
            </>
          ) : (
            <span className="form-header-title">{gettext('Form links')}</span>
          )}
        </div>
        {!isEditingLink && (
          <Button color="outline-primary" size="sm" onClick={() => setIsEditingLink(true)}>
            {gettext('Add form link')}
          </Button>
        )}
        {(isEditingLink && selectedLink) && (
          <Button color="outline-primary" size="sm" onClick={modifyFormLink} disabled={!canModifyLink()}>
            {gettext('Submit')}
          </Button>
        )}
        {(isEditingLink && !selectedLink) && (
          <Button color="outline-primary" size="sm" onClick={generateFormLink} disabled={!canGenerateLink()}>
            {gettext('Generate')}
          </Button>
        )}
      </div>
    );
  };

  const renderContent = () => {
    const validColumns = getValidColumns(columns, elementsOrder);
    const defaultLinkItem = {
      created_at: '',
      custom_url: '',
      name: gettext('Default form link'),
      value: link,
    };

    return (
      <div className="form-presets-setting-content">
        {isEditingLink ? (
          <EditLinkContainer
            formLinkName={formLinkName}
            formCustomUrl={formCustomUrl}
            columns={validColumns}
            fieldItemsList={fieldItemsList}
            onChangeLinkName={(e) => setFormLinkName(e.target.value)}
            onChangeFormCustomUrl={(e) => setFormCustomUrl(e.target.value)}
            onAddFieldItem={onAddFieldItem}
            onDeleteFieldItem={onDeleteFieldItem}
            onUpdateFieldItem={onUpdateFieldItem}
          />
        ) : (
          <ShareFormLinksContainer
            shareFormLinks={shareFormLinks}
            defaultLinkItem={defaultLinkItem}
            onDeleteLink={onDeleteLink}
            onSelectLink={onSelectLink}
          />
        )}
      </div>
    );
  };

  return (
    <Fragment>
      <Modal isOpen={true} toggle={onShareDialogToggle} className="pre-fill-dialog">
        <DTableModalHeader toggle={onShareDialogToggle}>
          <span className="header-left">{gettext('Share')}</span>
          <span className="share-form-name ml-2">{formName}</span>
        </DTableModalHeader>
        <ModalBody>
          {renderHeader()}
          <div className="form-preset-divider"></div>
          {renderContent()}
        </ModalBody>
      </Modal>
    </Fragment>
  );
};

ShareFormDialog.propTypes = propTypes;

export default ShareFormDialog;
