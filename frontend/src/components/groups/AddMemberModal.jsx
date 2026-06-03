import { useState } from 'react';
import { groupsApi } from '../../api/client';
import useUIStore from '../../store/uiStore';
import Modal from '../ui/Modal';

export default function AddMemberModal({ isOpen, onClose, groupId, onAdded }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useUIStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await groupsApi.addMember(groupId, { email: email.trim() });
      addToast(`Member added!`, 'success');
      setEmail('');
      onAdded();
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to add member', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { setEmail(''); onClose(); }} title="Add Member" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="member-email" className="label">Member's email address</label>
          <input
            id="member-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="friend@example.com"
            required
            autoFocus
          />
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">
            Only registered users can be added to a group.
          </p>
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={() => { setEmail(''); onClose(); }} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={loading || !email.trim()}>
            {loading ? 'Adding...' : 'Add Member'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
