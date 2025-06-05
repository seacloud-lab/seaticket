import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { gettext, seatableMarketUrl } from '../../../utils/constants';
import Loading from '../../../components/loading';

const propTypes = {
  addTemplate: PropTypes.object,
  isCreatedTemplateLoading: PropTypes.bool,
  template: PropTypes.object.isRequired,
  addDtableFromExternalLink: PropTypes.func.isRequired,
};

class MobileTemplateItemDetail extends React.Component {

  addDtableFromExternalLink = () => {
    const { template } = this.props;
    this.props.addDtableFromExternalLink(template);
  };

  onExternalLinkClick = () => {
    const { template } = this.props;
    window.open(template.link);
  };

  render() {
    const { template, isCreatedTemplateLoading, addTemplate } = this.props;
    let card_image_url = '';
    if (seatableMarketUrl) {
      card_image_url = new URL(template.card_image_url, seatableMarketUrl).href;
    } else {
      card_image_url = template.card_image_url;
    }
    const isShowLoading = addTemplate && addTemplate.link === template.link;

    return (
      <div className="mobile-template-item-detail">
        <div className="mobile-template-item-wrapper">
          <div className="mobile-template-image">
            <img src={card_image_url} alt={template.display_name} />
          </div>
          <div className="mobile-template-info">
            <span className="mobile-template-name text-truncate">{template.display_name}</span>
            <p className="mobile-template-description mb-0 text-truncate">{template.description}</p>
            <span className="template-btn-container">
              <Button color='secondary' className="mobile-template-btn" onClick={this.onExternalLinkClick}>{gettext('View')}</Button>
              <Button color='primary' onClick={this.addDtableFromExternalLink} className="mobile-template-btn px-3 py-0">
                {(isShowLoading && isCreatedTemplateLoading) ? <Loading /> : gettext('Use template')}
              </Button>
            </span>
          </div>
        </div>
      </div>
    );
  }
}

MobileTemplateItemDetail.propTypes = propTypes;

export default MobileTemplateItemDetail;
