import React from 'react';
import PropTypes from 'prop-types';
import MobileCommonHeader from './mobile-common-header';
import MobileTemplateItemDetail from './mobile-template-item-detail';

const propTypes = {
  isCreatedTemplateLoading: PropTypes.bool,
  category: PropTypes.string,
  templateList: PropTypes.array.isRequired,
  onCancelTemplateDetail: PropTypes.func,
  addDtableFromExternalLink: PropTypes.func,
  onExternalLinkClick: PropTypes.func,
};

class MobileTemplateListDetail extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      addTemplate: null
    };
  }

  onCancelTemplateDetail = () => {
    this.props.onCancelTemplateDetail();
  };

  addDtableFromExternalLink = (template) => {
    this.setState({ addTemplate: template });
    this.props.addDtableFromExternalLink(template.link);
  };

  render() {
    const { category, templateList } = this.props;
    return (
      <div className="add-blank-table">
        <MobileCommonHeader
          title={category}
          leftName={<i className="dtable-font dtable-icon-return"></i>}
          onLeftClick={this.onCancelTemplateDetail}
        />
        <div className="template-list-detail">
          {templateList.map((template, index) => {
            return (
              <MobileTemplateItemDetail
                key={`mobile-template${index}`}
                template={template}
                addDtableFromExternalLink={this.addDtableFromExternalLink}
                onExternalLinkClick={this.props.onExternalLinkClick}
                isCreatedTemplateLoading={this.props.isCreatedTemplateLoading}
                addTemplate={this.state.addTemplate}
              />
            );
          })}
        </div>
      </div>
    );
  }
}

MobileTemplateListDetail.propTypes = propTypes;

export default MobileTemplateListDetail;
