import DigitalSignUtils from './digital-sign-utils';

const WORKFLOW_UPLOAD = 'getUploadLinkViaWorkflowToken';
const FORM_UPLOAD = 'getUploadLinkViaFormToken';

class DigitalService {

  constructor(props) {
    this.init(props);
  }

  init(props) {
    this.dtableWebAPI = props.dtableWebAPI;
    this.workspaceID = props.workspaceID;
    this.fileName = props.fileName;
    this.username = props.username || 'anonymous';
    this.token = props.token;
    this.apiUploadLinkName = props.apiUploadLinkName;
    this.taskId = props.taskId;
  }

  uploadSignImage(signBlob, { successCallback, failedCallback }) {
    const args = [];
    if (this.apiUploadLinkName === 'getTableAssetUploadLink') {
      args.push(this.workspaceID, this.fileName);
    } else if (this.apiUploadLinkName === FORM_UPLOAD) {
      args.push(this.token, 'image');
    } else if (this.apiUploadLinkName === WORKFLOW_UPLOAD) {
      args.push(this.token, 'image');
      if (this.taskId) {
        args.push(this.taskId);
      }
    }
    let relativePath;
    this.dtableWebAPI[this.apiUploadLinkName](...args).then((res) => {
      const assetUploadLinkMessage = res.data;
      const { digital_signs_relative_path, parent_path: parentPath, upload_link } = assetUploadLinkMessage;
      if (this.apiUploadLinkName === 'getTableAssetUploadLink') {
        relativePath = digital_signs_relative_path;
      }
      const uploadLink = upload_link + '?ret-json=1';
      const signName = `${this.username}-${Date.now().toString()}.png`;
      const signImage = new File([signBlob], signName);
      const formData = new FormData();
      formData.append('parent_dir', parentPath);
      if (relativePath) {
        formData.append('relative_path', relativePath);
      }
      formData.append('file', signImage);
      this.dtableWebAPI.uploadImage(uploadLink, formData, () => {}).then(res => {
        const name = res.data[0].name;
        let url;
        if (this.apiUploadLinkName === 'getTableAssetUploadLink') {
          url = `/${relativePath}/` + encodeURIComponent(name);
        } else if (this.apiUploadLinkName === FORM_UPLOAD || this.apiUploadLinkName === WORKFLOW_UPLOAD) {
          url = `/public/forms/${encodeURIComponent(name)}`;
        }
        const signature = DigitalSignUtils.getUpdatedSign({
          username: this.username,
          sign_image_url: url,
        });
        successCallback && successCallback(signature);
      }).catch(error => {
        failedCallback && failedCallback(error);
      });
    });
  }
}

export default DigitalService;
