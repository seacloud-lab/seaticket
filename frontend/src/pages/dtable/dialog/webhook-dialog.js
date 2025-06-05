import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../utils/constants';
import { Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Label, Input, FormFeedback, FormText } from 'reactstrap';
import { toaster, DTableModalHeader } from 'dtable-ui-component';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import Loading from '../../../components/loading';
import { Utils } from '../../../utils/utils';
import DeleteConfirmDialog from '../../../components/dialog/orgadmin-dialog/delete-item-confirm-dialog';

import '../../../css/share-link-dialog.css';

let itemPropTypes = {
  webhook: PropTypes.object.isRequired,
  deleteWebhook: PropTypes.func.isRequired,
  toggleUpdateWebhook: PropTypes.func.isRequired,
};

class Item extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isDeleteDialogShow: false
    };
  }

  toggleDeleteDialog = () => {
    this.setState({ isDeleteDialogShow: !this.state.isDeleteDialogShow });
  };

  deleteWebhook = () => {
    this.props.deleteWebhook(this.props.webhook, this.toggleDeleteDialog);
  };

  toggleUpdateWebhook = () => {
    this.props.toggleUpdateWebhook(this.props.webhook);
  };

  render() {
    let { webhook } = this.props;
    return (
      <Fragment>
        <tr>
          <td>
            {webhook.url}
            {!webhook.is_valid && <span style={{ color: 'red' }}>{' (' + gettext('Invalid') + ')'}</span>}
          </td>
          <td>
            <span
              className="dtable-font dtable-icon-rename cursor-pointer attr-action-icon"
              onClick={this.toggleUpdateWebhook}
            />
          </td>
          <td>
            <span
              className="dtable-font dtable-icon-delete cursor-pointer attr-action-icon"
              onClick={this.toggleDeleteDialog}
            />
          </td>
        </tr>
        {this.state.isDeleteDialogShow &&
        <DeleteConfirmDialog
          headerText={gettext('Delete webhook')}
          toggle={this.toggleDeleteDialog}
          onDelete={this.deleteWebhook}
          itemName={webhook.url}
          isOpen={this.state.isDeleteDialogShow}
        />
        }
      </Fragment>
    );
  }
}

Item.propTypes = itemPropTypes;


let contentPropTypes = {
  webhookList: PropTypes.array.isRequired,
  deleteWebhook: PropTypes.func.isRequired,
  toggleUpdateWebhook: PropTypes.func.isRequired
};

class Content extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    let { webhookList } = this.props;
    let renderWebhookList = webhookList.map((item, index) => {
      return (
        <Item
          key={index}
          webhook={item}
          deleteWebhook={this.props.deleteWebhook}
          toggleUpdateWebhook={this.props.toggleUpdateWebhook}
        />
      );
    });
    return (
      <div className='webhook-dialog-content mx-5 mb-5 h-100'>
        <div className='o-auto h-100'>
          <div className="h-100" style={{ maxHeight: '18rem' }}>
            <table>
              <thead>
                <tr>
                  <th width="90%">{'URL'}</th>
                  <th width="5%">{/* update icon*/}</th>
                  <th width="5%">{/* delete icon*/}</th>
                </tr>
              </thead>
              <tbody>
                {renderWebhookList}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
}

Content.propTypes = contentPropTypes;


const propTypes = {
  currentTable: PropTypes.object.isRequired,
  onWebhookToggle: PropTypes.func.isRequired,
};


class WebhookDialog extends React.Component {
  constructor(props) {
    super(props);
    this.workspaceID = this.props.currentTable.workspace_id;
    this.name = this.props.currentTable.name;
    this.state = {
      webhookList: [],
      isNestedOpen: false,
      nestedUrl: '',
      nestedSecret: '',
      isNestedAdd: true,
      nestedUrlInvalid: false,
      nestedUrlErrorMsg: gettext('URL Invalid'),
      updateWebhook: {},
      loading: true
    };
  }

  componentDidMount() {
    dtableWebAPI.getDTableWebhooks(this.workspaceID, this.name).then(res => {
      this.setState({
        webhookList: res.data.webhook_list,
        loading: false
      });
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  }

  toggleNested = () => {
    this.setState({ isNestedOpen: !this.state.isNestedOpen }, () => {
      if (!this.state.isNestedOpen) {
        this.setState({
          nestedSecret: '',
          nestedUrl: '',
          isNestedAdd: true,
          nestedUrlInvalid: false,
          nestedUrlErrorMsg: gettext('URL Invalid'),
          updateWebhook: {}
        });
      }
    });
  };

  toggleAddWebhook = () => {
    this.setState({
      nestedUrl: '',
      nestedSecret: ''
    });
    this.toggleNested();
  };

  onChangeURL = (e) => {
    this.setState({ nestedUrl: e.target.value, nestedUrlInvalid: false });
  };

  onChangeSecret = (e) => {
    this.setState({ nestedSecret: e.target.value });
  };

  validateInput = () => {
    let { nestedUrl, nestedSecret, webhookList, isNestedAdd, updateWebhook } = this.state;
    nestedUrl = nestedUrl.trim();
    nestedSecret = nestedSecret.trim();
    this.setState({ nestedSecret: nestedSecret, nestedUrl: nestedUrl });
    let reg = /(http|https):\/\/[\w\-_]+(.[\w\-_]+)+([\w\-.,@?^=%&amp;:/~+#]*[\w\-@?^=%&amp;/~+#])?/;
    if (!reg.test(nestedUrl)) {
      this.setState({ nestedUrlInvalid: true });
      return false;
    }
    if (webhookList.filter((item) => {
      if (isNestedAdd) {
        return item.url === nestedUrl;
      } else {
        return item.url === nestedUrl && item.id !== updateWebhook.id;
      }
    }).length > 0) {
      this.setState({
        nestedUrlInvalid: true,
        nestedUrlErrorMsg: gettext('URL exists')
      });
      return false;
    }
    return true;
  };

  addWebhook = () => {
    if (!this.validateInput()) {
      return;
    }
    let { nestedUrl, nestedSecret } = this.state;
    dtableWebAPI.createDTableWebhook(this.workspaceID, this.name, nestedUrl, nestedSecret).then(res => {
      let webhook = res.data.webhook;
      let webhookList = this.state.webhookList.slice();
      webhookList.push(webhook);
      this.setState({ webhookList: webhookList });
      this.toggleNested();
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
      if (error.response || error.response.status === 409) {
        this.setState({
          nestedUrlInvalid: true,
          nestedUrlErrorMsg: gettext('URL exists')
        });
      }
    });
  };

  deleteWebhook = (webhook, cb) => {
    dtableWebAPI.deleteDTableWebhook(this.workspaceID, this.name, webhook.id).then(() => {
      let webhookList = this.state.webhookList.slice();
      webhookList = webhookList.filter((item) => {
        return item.id !== webhook.id;
      });
      this.setState({ webhookList: webhookList });
      cb && cb();
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  };

  toggleUpdateWebhook = (webhook) => {
    this.setState({
      isNestedOpen: true,
      nestedUrl: webhook.url,
      nestedSecret: webhook.settings ? webhook.settings.secret : '',
      isNestedAdd: false,
      updateWebhook: webhook
    });
  };

  updateWebhook = () => {
    if (!this.validateInput()) {
      return;
    }
    let { updateWebhook, nestedSecret, nestedUrl } = this.state;
    let updates = {
      url: nestedUrl,
      secret: nestedSecret
    };
    dtableWebAPI.updateDTableWebhook(this.workspaceID, this.name, updateWebhook.id, updates).then(res => {
      let webhookList = this.state.webhookList.slice();
      webhookList = webhookList.map(item => {
        if (item.id !== updateWebhook.id) {
          return item;
        }
        return res.data.webhook;
      });
      this.setState({
        webhookList: webhookList
      });
      this.toggleNested();
      toaster.success(gettext('Update successful'));
    }).catch(error => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || [403, 409].indexOf(error.response.status) === -1) {
        toaster.danger(errMsg);
      }
      if (error.response || error.response.status === 409) {
        this.setState({
          nestedUrlInvalid: true,
          nestedUrlErrorMsg: gettext('URL exists')
        });
      }
    });
  };

  render() {
    let currentTable = this.props.currentTable;
    let name = currentTable.name;
    return (
      <Modal
        isOpen={true} className="share-dialog" style={{ maxWidth: '720px' }}
        toggle={this.props.onWebhookToggle}
      >
        <DTableModalHeader toggle={this.props.onWebhookToggle}>
          <span className="mr-1">{gettext('Webhooks')}</span>
          <span className="op-target" title={name}>{name}</span>
        </DTableModalHeader>
        <ModalBody className="share-dialog-content">
          <div className="column-flex-direction flex-fill">
            {!this.state.loading && <Content
              webhookList={this.state.webhookList}
              deleteWebhook={this.deleteWebhook}
              toggleUpdateWebhook={this.toggleUpdateWebhook}
            />}
            {this.state.loading && <Loading/>}
          </div>

          <Modal
            isOpen={this.state.isNestedOpen}
            toggle={this.toggleNested}
            className="share-dialog" style={{ maxWidth: '500px' }}
          >
            <DTableModalHeader toggle={this.toggleNested}>
              {this.state.isNestedAdd ? gettext('Add webhook') : gettext('Update webhook')}
            </DTableModalHeader>
            <ModalBody>
              <Form>
                <FormGroup>
                  <Label>{gettext('Input URL')}</Label>
                  <Input value={this.state.nestedUrl} onChange={this.onChangeURL} invalid={this.state.nestedUrlInvalid} />
                  <FormFeedback>{this.state.nestedUrlErrorMsg}</FormFeedback>
                  <FormText>{gettext('URL should start with http(s).')}</FormText>
                </FormGroup>
                <FormGroup>
                  <Label>{gettext('Input secret')}</Label>
                  <Input value={this.state.nestedSecret} onChange={this.onChangeSecret} />
                  <FormText>{gettext('When you set a secret, you\'ll receive the X-SeaTable-Signature header, whose value is the result of SHA256 encryption of the secret key and request.body, in the webhook POST request.')}</FormText>
                </FormGroup>
              </Form>
            </ModalBody>
            <ModalFooter>
              <Button color="secondary" onClick={this.toggleNested}>{gettext('Cancel')}</Button>
              <Button color="primary" onClick={this.state.isNestedAdd ? this.addWebhook : this.updateWebhook}>{gettext('Submit')}</Button>
            </ModalFooter>
          </Modal>

        </ModalBody>
        <ModalFooter className="left-modal-footer cursor-pointer" onClick={this.toggleAddWebhook}>
          <span className="dtable-font dtable-icon-add-table attr-action-icon ml-0 mr-1"/>
          <span>{gettext('Add webhook')}</span>
        </ModalFooter>
      </Modal>
    );
  }
}

WebhookDialog.propTypes = propTypes;

export default WebhookDialog;
