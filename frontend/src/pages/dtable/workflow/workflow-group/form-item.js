import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../../utils/constants';

class FormItem extends React.PureComponent {

  constructor(props) {
    super(props);
    this.state = {
      isMouseEnter: false,
    };
  }

  onMouseEnter = () => {
    this.setState({ isMouseEnter: true });
  };

  onMouseLeave = () => {
    this.setState({ isMouseEnter: false });
  };

  onClickForm = () => {
    window.open(this.props.formItem.form_link);
  };

  render() {
    const { formItem, className, style } = this.props;
    const { isMouseEnter } = this.state;
    const { id, group_id } = formItem;
    let formConfig = {};
    let formName = '';
    try {
      formConfig = JSON.parse(formItem.form_config);
      formName = formConfig.form_name;
    } catch (error) {
      formName = gettext('Form');
    }
    let groupName = formItem.group_name;
    return (
      <>
        <div
          id={`form-item-${group_id}-${id}`}
          className={`workflow-item d-flex ${className}`}
          style={{ ...style, backgroundColor: isMouseEnter ? '#FFE6CC' : '#FFF5EB' }}
          onMouseEnter={this.onMouseEnter}
          onMouseLeave={this.onMouseLeave}
          onClick={this.onClickForm}
        >
          <div className="workflow-item-icon-more d-flex ">
            <div
              className="workflow-item-icon d-flex align-items-center justify-content-center"
              style={{ backgroundColor: '#FF8000' }}
            >
              <i className='workflow-item-icon-font dtable-icon-color-white dtable-font dtable-icon-form'></i>
            </div>
          </div>
          <div className="workflow-item-name" title={formName}>
            {formName}
          </div>
          <div className="workflow-item-group text-truncate">
            <i className='table-workspace-icon dtable-font dtable-icon-collaborator'></i>
            {groupName}
          </div>
        </div>
      </>
    );
  }
}

FormItem.propTypes = {
  formItem: PropTypes.object,
  className: PropTypes.string,
  style: PropTypes.object,
};

export default FormItem;
