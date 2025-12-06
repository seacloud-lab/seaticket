import React from 'react';
import PropTypes from 'prop-types';
import { ProjectIcon } from '../../components';

const gettext = window.gettext;

const propTypes = {
  item: PropTypes.object.isRequired,
  onItemClickHandler: PropTypes.func.isRequired,
  className: PropTypes.string.isRequired,
  path: PropTypes.string,
};

class SearchResultItem extends React.Component {

  onClickHandler = () => {
    this.props.onItemClickHandler(this.props.item);
  };

  render() {
    const { item, className } = this.props;
    const { color, icon, name, group_name } = item;
    const pathName = group_name === 'personal' ? gettext('My projects') : group_name;
    return (
      <div className={className} onClick={this.onClickHandler}>
        <ProjectIcon bgColor={color} icon={icon} />
        <div className="project-name">
          <span>{name}</span>
          {pathName && <span className="share-tip text-truncate">{pathName}</span>}
        </div>
      </div>
    );
  }
}

SearchResultItem.propTypes = propTypes;

export default SearchResultItem;
