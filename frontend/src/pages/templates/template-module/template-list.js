import React from 'react';
import PropTypes from 'prop-types';
import TemplateItem from './template-item';

const propTypes = {
  templateList: PropTypes.array,
  searchParams: PropTypes.object,
};

class TemplateList extends React.Component {

  render() {
    let { templateList } = this.props;

    return (
      <div className="template-list-container mt-1">
        {templateList.map((template, index) => {
          return (<TemplateItem key={index} template={template} searchParams={this.props.searchParams} />);
        })}
      </div>
    );
  }
}

TemplateList.propTypes = propTypes;

export default TemplateList;
