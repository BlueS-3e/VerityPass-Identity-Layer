import React, { createContext, useContext, useState } from 'react';
import AaveDemoModal from './AaveDemoModal';

const ModalContext = createContext({ openModal: () => {}, closeModal: () => {} });

export function useModal() {
  return useContext(ModalContext);
}

export default function ModalProvider({ children }) {
  const [modal, setModal] = useState(null);

  const openModal = (name, props = {}) => setModal({ name, props });
  const closeModal = () => setModal(null);

  const renderModal = () => {
    if (!modal) return null;
    switch (modal.name) {
      case 'aave-demo':
        return <AaveDemoModal onClose={closeModal} {...modal.props} />;
      default:
        return null;
    }
  };

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      {renderModal()}
    </ModalContext.Provider>
  );
}
