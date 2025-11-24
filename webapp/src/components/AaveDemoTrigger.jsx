import React from 'react';
import { useModal } from './ModalProvider';
import '../pages/AaveDemo.css';

export default function AaveDemoTrigger() {
  const { openModal } = useModal();
  return (
    <div className="demo-trigger hidden md:block">
      <button
        type="button"
        onClick={() => openModal('aave-demo')}
        aria-label="Open Aave demo"
        className="demo-trigger-btn"
      >
        <div className="demo-trigger-icon" aria-hidden>🚀</div>
        <span className="demo-trigger-label">Try Aave Demo</span>
      </button>
    </div>
  );
}
