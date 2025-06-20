import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, Input, ModalBody, ModalFooter, Form, FormGroup, Label, Alert } from 'reactstrap';
import { gettext } from '../../../constants';
import { DTableModalHeader } from 'dtable-ui-component';


const propTypes = {
  createWebsite: PropTypes.func.isRequired,
  toggleDialog: PropTypes.func.isRequired
};

class CreateWebsiteDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      websiteUrl: '',
      websiteSiteMapUrl: '',
      errMessage: '',
      isSubmitBtnActive: false
    };
  }

  handleWebsiteUrlChange = (e) => {
    if (!e.target.value.trim()) {
      this.setState({ isSubmitBtnActive: false });
    } else {
      this.setState({ isSubmitBtnActive: true });
    }

    this.setState({ websiteUrl: e.target.value });
  };

  handleWebsiteSiteMapChange = (e) => {
    this.setState({ websiteSiteMapUrl: e.target.value });
  };

  handleSubmit = () => {
    this.props.createWebsite(this.state.websiteUrl.trim(), this.state.websiteSiteMapUrl.trim());
  };

  toggle = () => {
    this.props.toggleDialog();
  };

  render() {
    return (
      <Modal isOpen={true} toggle={this.toggle} autoFocus={false}>
        <DTableModalHeader toggle={this.toggle}>{gettext('New Website')}</DTableModalHeader>
        <ModalBody>
          <Form>
            <FormGroup>
              <Label>{gettext('Url')}</Label>
              <Input
                autoFocus
                value={this.state.websiteUrl}
                onChange={this.handleWebsiteUrlChange}
              />
            </FormGroup>
            <FormGroup>
              <Label>
                {gettext('Sitemap url')}
              </Label>
              <Input
                value={this.state.websiteSiteMapUrl}
                onChange={this.handleWebsiteSiteMapChange}
              />
            </FormGroup>
          </Form>
          {this.state.errMessage && <Alert color="danger">{this.state.errMessage}</Alert>}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.handleSubmit} disabled={!this.state.isSubmitBtnActive}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

CreateWebsiteDialog.propTypes = propTypes;

export default CreateWebsiteDialog;
