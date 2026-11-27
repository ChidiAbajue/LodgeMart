import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Users, MessageCircle } from 'lucide-react';
import { useLodgeMart } from '../context/LodgeMartContext';
import Modal, { TextField, ActionButton } from './ui/Modal';

export default function DelegatePinModal({ isOpen, onClose, order }) {
  const { delegateOrderPin } = useLodgeMart();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [generatedPin, setGeneratedPin] = useState('');

  if (!isOpen || !order) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    const newPin = delegateOrderPin(order.id, name, phone);
    setGeneratedPin(newPin);
  };

  const cleanPhone = phone.replace(/[^0-9]/g, '').replace(/^0/, '234');
  const waText = encodeURIComponent(
    `Hey ${name}, I delegated my LodgeMart order ${order.id} (${order.pickupHub}) to you. Your 4-digit Pickup PIN is ${generatedPin}. Show it to the rider at the junction!`
  );
  const waUrl = `https://wa.me/${cleanPhone}?text=${waText}`;

  return (
    <Modal open onClose={onClose} title="Delegate pickup PIN" subtitle={`Order ${order.id} · ${order.pickupHub}`} icon={Users}>
      {!generatedPin ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <p className="text-[0.95rem] leading-relaxed text-muted">
            Stuck in a lecture? Assign a roommate to collect order{' '}
            <span className="font-semibold text-ink">{order.id}</span>. Your current PIN will be invalidated immediately.
          </p>
          <TextField label="Roommate full name" type="text" required placeholder="e.g. Emeka" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="WhatsApp phone number" type="tel" required placeholder="e.g. 08012345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <ActionButton type="submit">Rotate PIN &amp; delegate to roommate</ActionButton>
        </form>
      ) : (
        <div className="space-y-6 text-center">
          <p className="font-display text-xs font-medium uppercase tracking-[0.25em] text-accent-700">Delegated to {name}</p>
          <div className="flex justify-center gap-2.5">
            {generatedPin.split('').map((d, i) => (
              <motion.span
                key={`${generatedPin}-${i}`}
                className="flex h-20 w-16 items-center justify-center rounded-md bg-ink font-display text-5xl font-semibold text-white"
                initial={{ rotateX: -90, opacity: 0 }}
                animate={{ rotateX: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
                style={{ transformPerspective: 400 }}
              >
                {d}
              </motion.span>
            ))}
          </div>
          <p className="text-sm text-muted">Previous PIN has been invalidated.</p>
          <ActionButton as="a" href={waUrl} target="_blank" rel="noopener noreferrer" className="!bg-[#25D366]">
            <MessageCircle className="h-4 w-4" /> Share PIN via WhatsApp
          </ActionButton>
        </div>
      )}
    </Modal>
  );
}
