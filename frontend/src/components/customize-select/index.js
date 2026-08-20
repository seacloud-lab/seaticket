import RemoteSelect from './remote-select';
import StaticSelect from './static-select';

const CustomizeSelect = ({ isRemote = false, ...props }) => {
  const CustomizeSelectComponent = isRemote ? RemoteSelect : StaticSelect;
  return (<CustomizeSelectComponent { ...props } />);
};

export default CustomizeSelect;
