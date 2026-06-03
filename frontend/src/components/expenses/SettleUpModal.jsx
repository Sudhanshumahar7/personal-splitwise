import { useState } from 'react';
import { settlementsApi } from '../../api/client';
import useAuthStore from '../../store/authStore';
import useUIStore from '../../store/uiStore';
import Modal from '../ui/Modal';

export default function SettleUpModal({ isOpen, onClose, groupId, members, debts, onSettled }) {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();

  const [payeeId, setPayeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  // Pre-fill amount if we select a payee who we owe money to
  const handlePayeeChange = (e) => {
    const selectedPayeeId = e.target.value;
    setPayeeId(selectedPayeeId);
    
    if (selectedPayeeId) {
      // Find if we have a direct debt to this person
      const directDebt = debts.find(
        (d) => d.debtor.id === user.id && d.creditor.id === selectedPayeeId
      );
      if (directDebt) {
        setAmount(String(directDebt.amount));
      } else {
        setAmount('');
      }
    } else {
      setAmount('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!payeeId || !amount || parseFloat(amount) <= 0) return;
    
    setLoading(true);
    try {
      await settlementsApi.create({
        group_id: groupId,
        payee_id: payeeId,
        amount: parseFloat(amount),
      });
      addToast('Payment recorded successfully!', 'success');
      setPayeeId('');
      setAmount('');
      onSettled();
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to record payment', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Only show members other than ourselves
  const availablePayees = members.filter((m) => m.user_id !== user?.id);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record a Payment" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="settle-payee" className="label">Who did you pay?</label>
          <select
            id="settle-payee"
            value={payeeId}
            onChange={handlePayeeChange}
            className="input"
            required
          >
            <option value="">Select person</option>
            {availablePayees.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.user?.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="settle-amount" className="label">Amount Paid (₹)</label>
          <input
            id="settle-amount"
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
            placeholder="0.00"
            required
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
            {loading ? 'Saving...' : 'Save Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
