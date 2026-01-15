import React, { forwardRef } from 'react';

export function Card({ children, className = '', onClick, ...rest }) {
  return (
    <div 
      className={("rounded shadow-sm bg-white " + className).trim()}
      onClick={onClick}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Button({ children, className = '', variant = 'default', onClick, ...rest }) {
  const base = 'inline-flex items-center justify-center px-3 py-2 rounded transition-colors duration-200';
  const styles = {
    default: 'bg-slate-100 text-slate-800',
    primary: 'bg-[#d9b53f] text-white hover:bg-[#bf9035]',
    ghost: 'bg-transparent',
    outline: 'border bg-white'
  };
  return (
    <button onClick={onClick} className={[base, styles[variant] || styles.default, className].join(' ')} {...rest}>
      {children}
    </button>
  );
}

export const Input = forwardRef((props, ref) => {
  const { className = '', ...rest } = props;
  return <input ref={ref} className={('border rounded px-2 py-1 ' + className).trim()} {...rest} />;
});

export function Badge({ children, className = '' }) {
  return <span className={("inline-block bg-gray-200 text-xs px-2 py-1 rounded " + className).trim()}>{children}</span>;
}

export default { Card, Button, Input, Badge };
