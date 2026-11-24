// FieldError.jsx
const FieldError = ({ error }) => {
  if (!error) return null;
  return <div className="field-error">{Array.isArray(error) ? error[0] : error}</div>;
};

export default FieldError;