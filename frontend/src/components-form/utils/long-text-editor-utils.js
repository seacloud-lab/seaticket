import { Utils } from '../../utils/utils';
import { toaster } from 'dtable-ui-component';
import { dtableWebAPI } from '../../api/dtable-web-api';

class LongTextEditorUtils {

  constructor({ editorType, token, dtableWebURL, apiUploadLinkName, workspaceID, taskId }) {
    this.editorType = editorType;
    this.token = token;
    this.taskId = taskId;
    this.dtableWebURL = dtableWebURL ? dtableWebURL.replace(/\/+$/, '') : '';
    this.apiUploadLinkName = apiUploadLinkName;
    this.workspaceID = workspaceID;
  }

  uploadLocalImage = (imageFile) => {
    let parentPath;
    let relativePath;
    const args = [this.token];
    if (this.apiUploadLinkName === 'getUploadLinkViaFormToken') {
      args.push('image');
    } else if (this.apiUploadLinkName === 'getUploadLinkViaWorkflowToken') {
      args.push('image');
      args.push(this.taskId);
    }
    return (
      dtableWebAPI[this.apiUploadLinkName](...args).then(res => {
        const { parent_path, upload_link } = res.data;
        parentPath = parent_path;
        if (this.editorType === 'column-description') {
          relativePath = 'form_long_text_image';
        }
        const newFile = new File([imageFile], this.getImageFileNameWithTimestamp(imageFile), { type: imageFile.type });
        const formData = new FormData();
        formData.append('file', newFile);
        if (relativePath) {
          formData.append('relative_path', relativePath);
        }
        formData.append('parent_dir', parent_path);
        const uploadLink = upload_link + '?ret-json=1';
        return dtableWebAPI.uploadImage(uploadLink, formData);
      }).then ((res) => {
        const { name } = res.data[0];
        const newFileName = encodeURIComponent(name);
        return `${this.dtableWebURL}/workspace/${this.workspaceID}${parentPath}/${relativePath ? relativePath + '/' : ''}${newFileName}`;
      }).catch(err => {
        const error = Utils.getErrorMsg(err);
        toaster.danger(error);
        return '';
      })
    );
  };

  getImageFileNameWithTimestamp(file) {
    return 'image-' + Date.now().toString() + file.name.slice(file.name.lastIndexOf('.'));
  }

  isInternalDirLink(url) {
    var reg = new RegExp(`${this.dtableWebURL}/#[a-z-]*?/lib/[0-9a-f-]{36}.*`);
    return reg.test(url);
  }

  isInternalFileLink(url) {
    var reg = new RegExp(`${this.dtableWebURL}/lib/[0-9a-f-]{36}/file.*`);
    return reg.test(url);
  }

}

export default LongTextEditorUtils;
