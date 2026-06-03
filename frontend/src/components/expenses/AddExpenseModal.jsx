import { useState, useEffect } from 'react';
import { expensesApi } from '../../api/client';
import useAuthStore from '../../store/authStore';
import useUIStore from '../../store/uiStore';
import Modal from '../ui/Modal';

const SPLIT_METHODS = [
  { value: 'EQUAL', label: 'Equal', desc: 'Split evenly among selected members' },
  { value: 'EXACT', label: 'Exact', desc: 'Specify exact amount per person' },
  { value: 'PERCENT', label: 'Percent', desc: 'Split by percentage (must sum to 100%)' },
  { value: 'SHARE', label: 'Shares', desc: 'Split by share units proportionally' },
];

export default function AddExpenseModal({ isOpen, onClose, groupId, members, onSaved, editExpense = null }) {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();

  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paidById, setPaidById] = useState('');
  const [splitMethod, setSplitMethod] = useState('EQUAL');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [splitValues, setSplitValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Initialize form
  useEffect(() => {
    if (isOpen) {
      if (editExpense) {
        setDescription(editExpense.description);
        setTotalAmount(String(editExpense.total_amount));
        setPaidById(String(editExpense.paid_by_id));
        setSplitMethod(editExpense.split_method);
        const splitUserIds = editExpense.splits.map((s) => String(s.user_id));
        setSelectedMembers(splitUserIds);
        const vals = {};
        editExpense.splits.forEach((s) => {
          vals[String(s.user_id)] = s.user_share_input != null ? String(s.user_share_input) : '';
        });
        setSplitValues(vals);
      } else {
        setDescription('');
        setTotalAmount('');
        setPaidById(user ? String(user.id) : '');
        setSplitMethod('EQUAL');
        setSelectedMembers(members.map((m) => String(m.user_id)));
        setSplitValues({});
      }
      setErrors({});
    }
  }, [isOpen, editExpense, members, user]);

  const toggleMember = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const setSplitValue = (userId, value) => {
    setSplitValues((prev) => ({ ...prev, [userId]: value }));
  };

  const validate = () => {
    const errs = {};
    if (!description.trim()) errs.description = 'Description is required';
    const amount = parseFloat(totalAmount);
    if (!totalAmount || isNaN(amount) || amount <= 0) errs.totalAmount = 'Enter a valid positive amount';
    if (!paidById) errs.paidById = 'Select who paid';
    if (selectedMembers.length === 0) errs.members = 'Select at least one member';

    if (splitMethod === 'EXACT') {
      const sum = selectedMembers.reduce((acc, uid) => acc + (parseFloat(splitValues[uid]) || 0), 0);
      if (Math.abs(sum - amount) > 0.01) {
        errs.splitValues = `Amounts sum to ₹${sum.toFixed(2)} but total is ₹${amount.toFixed(2)}`;
      }
    }
    if (splitMethod === 'PERCENT') {
      const sum = selectedMembers.reduce((acc, uid) => acc + (parseFloat(splitValues[uid]) || 0), 0);
      if (Math.abs(sum - 100) > 0.01) {
        errs.splitValues = `Percentages sum to ${sum.toFixed(2)}%, must equal 100%`;
      }
    }
    if (splitMethod === 'SHARE') {
      const anyZero = selectedMembers.some((uid) => !splitValues[uid] || parseFloat(splitValues[uid]) <= 0);
      if (anyZero) errs.splitValues = 'All share values must be greater than 0';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const splits = selectedMembers.map((uid) => ({
      user_id: uid,
      value: parseFloat(splitValues[uid] || 0),
    }));

    const payload = {
      group_id: groupId,
      description: description.trim(),
      total_amount: parseFloat(totalAmount),
      paid_by_id: paidById,
      split_method: splitMethod,
      splits,
    };

    try {
      if (editExpense) {
        await expensesApi.update(editExpense.id, payload);
        addToast('Expense updated!', 'success');
      } else {
        await expensesApi.create(payload);
        addToast('Expense added!', 'success');
      }
      onSaved();
      onClose();
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to save expense', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getMemberName = (userId) => {
    const m = members.find((m) => String(m.user_id) === userId);
    return m?.user?.name || 'Unknown';
  };

  const getInputLabel = () => {
    if (splitMethod === 'EXACT') return 'Amount (₹)';
    if (splitMethod === 'PERCENT') return 'Percent (%)';
    if (splitMethod === 'SHARE') return 'Shares';
    return '';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editExpense ? 'Edit Expense' : 'Add Expense'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Description + Amount row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="exp-desc" className="label">Description *</label>
            <input
              id="exp-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`input ${errors.description ? 'input-error' : ''}`}
              placeholder="Groceries, Dinner, Rent..."
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
          </div>
          <div>
            <label htmlFor="exp-amount" className="label">Total Amount (₹) *</label>
            <input
              id="exp-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className={`input ${errors.totalAmount ? 'input-error' : ''}`}
              placeholder="0.00"
            />
            {errors.totalAmount && <p className="text-xs text-red-500 mt-1">{errors.totalAmount}</p>}
          </div>
        </div>

        {/* Paid by */}
        <div>
          <label htmlFor="exp-paid-by" className="label">Paid by *</label>
          <select
            id="exp-paid-by"
            value={paidById}
            onChange={(e) => setPaidById(e.target.value)}
            className={`input ${errors.paidById ? 'input-error' : ''}`}
          >
            <option value="">Select person</option>
            {members.map((m) => (
              <option key={m.user_id} value={String(m.user_id)}>
                {m.user?.name}{m.user_id === user?.id ? ' (You)' : ''}
              </option>
            ))}
          </select>
          {errors.paidById && <p className="text-xs text-red-500 mt-1">{errors.paidById}</p>}
        </div>

        {/* Split method */}
        <div>
          <label className="label">Split Method</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SPLIT_METHODS.map((method) => (
              <button
                key={method.value}
                type="button"
                onClick={() => setSplitMethod(method.value)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  splitMethod === method.value
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                    : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                }`}
              >
                <p className={`text-sm font-semibold ${splitMethod === method.value ? 'text-brand-700 dark:text-brand-300' : 'text-gray-700 dark:text-slate-300'}`}>
                  {method.label}
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 leading-tight">{method.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Member subset + split inputs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Split among</label>
            {errors.members && <p className="text-xs text-red-500">{errors.members}</p>}
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {members.map((m) => {
              const uid = String(m.user_id);
              const isSelected = selectedMembers.includes(uid);
              return (
                <div
                  key={uid}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/10'
                      : 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 opacity-50'
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleMember(uid)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-500'
                        : 'border-gray-300 dark:border-slate-500 bg-white dark:bg-slate-900'
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Name */}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-slate-200">
                      {m.user?.name}{uid === String(user?.id) ? ' (You)' : ''}
                    </p>
                    {splitMethod === 'EQUAL' && isSelected && totalAmount && selectedMembers.length > 0 && (
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        ₹{(parseFloat(totalAmount) / selectedMembers.length).toFixed(2)} each
                      </p>
                    )}
                  </div>

                  {/* Split value input (not for EQUAL) */}
                  {splitMethod !== 'EQUAL' && isSelected && (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={splitValues[uid] || ''}
                      onChange={(e) => setSplitValue(uid, e.target.value)}
                      className="input w-24 text-right text-sm"
                      placeholder={splitMethod === 'SHARE' ? '1' : '0'}
                    />
                  )}

                  {splitMethod !== 'EQUAL' && isSelected && (
                    <span className="text-xs text-gray-400 dark:text-slate-500 w-6">
                      {splitMethod === 'PERCENT' ? '%' : splitMethod === 'SHARE' ? '🪙' : '₹'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {errors.splitValues && (
            <p className="text-xs text-red-500 mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
              ⚠️ {errors.splitValues}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={loading}>
            {loading ? 'Saving...' : editExpense ? 'Update Expense' : 'Add Expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
