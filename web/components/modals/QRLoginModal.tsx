"use client";

import { QRLogin } from "@/components/QRLogin";

interface QRLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QRLoginModal({ isOpen, onClose }: QRLoginModalProps) {
  if (!isOpen) return null;

  return <QRLogin onClose={onClose} />;
}
