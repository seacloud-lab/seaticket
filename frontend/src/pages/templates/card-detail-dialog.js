import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, Button } from 'reactstrap';
import { processor } from '@seafile/seafile-editor';
import { Utils } from '../../utils/utils';
import Loading from '../../components/loading';
import { gettext, siteRoot } from '../../utils/constants';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  type: PropTypes.string.isRequired,
  card: PropTypes.object.isRequired,
  toggle: PropTypes.func.isRequired,
};

class CardDetailDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      description: null
    };
  }

  componentDidMount(){
    let { card } = this.props;
    processor.process(card.description).then((result) => {
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
    let { card } = this.props;
    window.open(card.link);
  };

  changeImageURL = (innerValue) => {
    const { card } = this.props;
    if (innerValue.type === 'image') {
      let imageUrl = innerValue.data.src;

      // get image path
      let index = imageUrl.indexOf('/file');
      let index2 = imageUrl.indexOf('?');
      const imagePath = imageUrl.substring(index + 5, index2);
      // change image url
      innerValue.data.src = card.markdown_link + '/asset' + imagePath;
    }
    return innerValue;
  };

  modifyValueBeforeRender = (value) => {
    let newValue = Utils.changeMarkdownValue(value, this.changeImageURL);
    return newValue;
  };

  addDtableFromTemplateBaseId = () => {
    let link = this.props.card.link;
    let templateLinkToken = link.split('/')[5];
    let copyTemplate = siteRoot + 'copy-template/?template_link_token=' + templateLinkToken;
    window.open(copyTemplate);
  };

  getHeaderTitle = (type) => {
    let headerTitle;
    switch (type) {
      case 'plugin':
        headerTitle = gettext('Plugin');
        break;
      case 'template':
        headerTitle = gettext('Template');
        break;
      case 'case':
        headerTitle = gettext('Case');
        break;
      default:
        break;
    }

    return headerTitle;
  };

  render() {
    let { type, card } = this.props;
    let { isLoading, description } = this.state;
    let headerTitle = this.getHeaderTitle(type);
    return (
      <Modal isOpen={true} className="card-detail-dialog" toggle={this.toggle} contentClassName={'card-detail-container'}>
        <DTableModalHeader toggle={this.toggle}>{headerTitle}</DTableModalHeader>
        <ModalBody className="card-detail-content">
          {isLoading && <Loading />}
          {!isLoading && (
            <Fragment>
              <div className={`${type}-card-detail-image-container`}>
                {(type === 'template' && card.card_image_expanded_url) ?
                  <img src={card.card_image_expanded_url} alt={card.display_name} className={`${type}-card-detail-image`} /> :
                  <img src={card.card_image_url} alt={card.display_name} className={`${type}-card-detail-image`} />
                }
              </div>
              <div className="card-detail-info flex-wrap">
                <h4 className="card-detail-name m-0">{card.display_name}</h4>
                <div>
                  {card.link &&
                    <>
                      <Button color='secondary' className="mr-2" onClick={this.onExternalLinkClick}>{gettext('View')}</Button>
                      <Button color='primary' onClick={this.addDtableFromTemplateBaseId}>{gettext('Use template')}</Button>
                    </>
                  }
                </div>
              </div>
              <div className="card-detail-instruction" dangerouslySetInnerHTML={{ __html: description }}></div>
            </Fragment>
          )}
        </ModalBody>
      </Modal>
    );
  }
}

CardDetailDialog.propTypes = propTypes;

export default CardDetailDialog;
