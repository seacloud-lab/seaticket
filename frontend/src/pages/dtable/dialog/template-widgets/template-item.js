import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { seatableMarketUrl } from '../../../../utils/constants';
import TemplateDetailDialog from '../template-detail-dialog';

const propTypes = {
  template: PropTypes.object.isRequired,
  addDtableFromExternalLink: PropTypes.func.isRequired,
  isCreatedTemplateLoading: PropTypes.bool,
};

class TemplateItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowDetailDialog: false
    };
  }

  onDetailDialogToggle = () => {
    this.setState({ isShowDetailDialog: !this.state.isShowDetailDialog });
  };

  render() {
    let { template } = this.props;
    let card_image_url = '';
    let card_image_expanded_url = '';
    if (seatableMarketUrl) {
      card_image_url = new URL(template.card_image_url, seatableMarketUrl).href;
      if (template.card_image_expanded_url) {
        card_image_expanded_url = new URL(template.card_image_expanded_url, seatableMarketUrl).href;
      } else {
        card_image_expanded_url = card_image_url;
      }
    } else {
      card_image_url = template.card_image_url;
      card_image_expanded_url = template.card_image_expanded_url || card_image_url;
    }
    return (
      <Fragment>
        <div className="template-item-container">
          <div className="template-container" onClick={this.onDetailDialogToggle}>
            <div className="template-image">
              <img src={`${card_image_url}`} alt={template.display_name} />
            </div>
            <div className="template-info">
              <h2 className="template-name">{template.display_name}</h2>
              <p className="template-description text-truncate">{template.description}</p>
            </div>
          </div>
        </div>
        {this.state.isShowDetailDialog &&
          <TemplateDetailDialog
            template={this.props.template}
            addDtableFromExternalLink={this.props.addDtableFromExternalLink}
            toggle={this.onDetailDialogToggle}
            isCreatedTemplateLoading={this.props.isCreatedTemplateLoading}
            card_image_expanded_url={card_image_expanded_url}
          />
        }
      </Fragment>
    );
  }
}

TemplateItem.propTypes = propTypes;

export default TemplateItem;
