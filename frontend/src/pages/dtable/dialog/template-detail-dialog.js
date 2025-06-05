import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, Button } from 'reactstrap';
import { processor } from '@seafile/seafile-editor';
import Loading from '../../../components/loading';
import { gettext } from '../../../utils/constants';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  template: PropTypes.object.isRequired,
  toggle: PropTypes.func.isRequired,
  addDtableFromExternalLink: PropTypes.func.isRequired,
  isCreatedTemplateLoading: PropTypes.bool,
  card_image_expanded_url: PropTypes.string,
};

class TemplateDetailDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      description: null
    };
  }

  componentDidMount(){
    let { template } = this.props;
    processor.process(template.description).then((result) => {
      let description = String(result);
      this.setState({
        isLoading: false,
        description: description
      });
    });
  }

  toggle = () => {
    this.props.toggle();
  };

  onExternalLinkClick = () => {
    let { template } = this.props;
    window.open(template.link);
  };

  addDtableFromExternalLink = () => {
    let { template } = this.props;
    this.props.addDtableFromExternalLink(template.link);
  };

  render() {
    let { template, isCreatedTemplateLoading, card_image_expanded_url } = this.props;
    let { isLoading, description } = this.state;
    return (
      <Modal isOpen={true} className="template-detail-dialog" toggle={this.toggle} contentClassName={'template-detail-container'}>
        <DTableModalHeader toggle={this.toggle}>{gettext('Template')}</DTableModalHeader>
        <ModalBody className="template-detail-content">
          {isLoading && <Loading />}
          {!isLoading && (
            <Fragment>
              <div className="template-detail-image-container">
                <img src={`${card_image_expanded_url}`} alt={template.display_name} className="template-detail-image" />
              </div>
              <div className="template-detail-info flex-wrap">
                <h4 className="template-detail-name m-0">{template.display_name}</h4>
                <div className="template-link-container">
                  {template.link &&
                    <Fragment>
                      <Button color='secondary' className="mr-3" onClick={this.onExternalLinkClick}>{gettext('View')}</Button>
                      <Button color='primary' onClick={this.addDtableFromExternalLink} className="use-template">
                        {isCreatedTemplateLoading ? <Loading /> : gettext('Use template')}
                      </Button>
                    </Fragment>
                  }
                </div>
              </div>
              <div className="template-detail-instruction" dangerouslySetInnerHTML={{ __html: description }}></div>
            </Fragment>
          )}
        </ModalBody>
      </Modal>
    );
  }
}

TemplateDetailDialog.propTypes = propTypes;

export default TemplateDetailDialog;
