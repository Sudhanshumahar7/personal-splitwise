import { useState } from 'react';
import { groupsApi } from '../../api/client';
import useUIStore from '../../store/uiStore';
import Modal from '../ui/Modal';

export default function CreateGroupModal({ isOpen, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useUIStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const response = await groupsApi.create({ name: name.trim(), description: description.trim() || undefined });
      setName('');
      setDescription('');
      onCreated(response.data);
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to create group', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Group" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="group-name" className="label">Group name *</label>
          <input
            id="group-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="e.g. Roommates, Goa Trip 2026"
            required
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="group-desc" className="label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea
            id="group-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input resize-none"
            placeholder="A short description..."
            rows={2}
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={handleClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={loading || !name.trim()}>
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
