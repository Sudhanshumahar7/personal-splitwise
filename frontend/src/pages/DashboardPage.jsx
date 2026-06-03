import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, groupsApi } from '../api/client';
import useAuthStore from '../store/authStore';
import useUIStore from '../store/uiStore';
import Modal from '../components/ui/Modal';
import CreateGroupModal from '../components/groups/CreateGroupModal';

const formatAmount = (amount) => {
  const abs = Math.abs(amount);
  return `₹${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const AmountBadge = ({ amount }) => {
  if (amount > 0) return <span className="amount-positive">{formatAmount(amount)} owed to you</span>;
  if (amount < 0) return <span className="amount-negative">{formatAmount(amount)} you owe</span>;
  return <span className="amount-neutral">Settled up ✓</span>;
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const fetchSummary = async () => {
    try {
      const response = await dashboardApi.getSummary();
      setSummary(response.data);
    } catch (err) {
      addToast('Failed to load dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleGroupCreated = (group) => {
    setShowCreateGroup(false);
    addToast(`Group "${group.name}" created!`, 'success');
    fetchSummary();
    navigate(`/groups/${group.id}`);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Skeleton */}
        <div className="skeleton h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const aggregate = summary?.aggregate_net_balance ?? 0;
  const groups = summary?.groups ?? [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Hey, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">Here's your financial overview</p>
        </div>
        <button
          id="create-group-btn"
          onClick={() => setShowCreateGroup(true)}
          className="btn-primary"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Group
        </button>
      </div>

      {/* ── Aggregate Balance Card ─────────────────────────────────────────── */}
      <div className={`rounded-2xl p-8 text-white shadow-xl relative overflow-hidden
        ${aggregate >= 0
          ? 'bg-gradient-to-br from-emerald-500 to-emerald-700'
          : 'bg-gradient-to-br from-rose-500 to-rose-700'
        }`}
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 translate-y-24 -translate-x-24" />

        <div className="relative">
          <p className="text-sm font-medium text-white/75 uppercase tracking-wider mb-2">
            Total Net Balance Across All Groups
          </p>
          <p className="text-5xl font-bold mb-1">
            {aggregate >= 0 ? '+' : '-'}₹{Math.abs(aggregate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-white/75 text-sm mt-3">
            {aggregate > 0
              ? '🟢 Overall, others owe you money'
              : aggregate < 0
              ? '🔴 Overall, you owe money to others'
              : '✅ You are completely settled up!'}
          </p>
        </div>
      </div>

      {/* ── Groups Section ────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Your Groups
          </h2>
          <span className="badge-gray">{groups.length} group{groups.length !== 1 ? 's' : ''}</span>
        </div>

        {groups.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-gray-700 dark:text-slate-300 font-medium mb-2">No groups yet</h3>
            <p className="text-gray-400 dark:text-slate-500 text-sm mb-4">
              Create a group to start splitting expenses with your roommates or friends.
            </p>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="btn-primary mx-auto"
            >
              Create your first group
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => (
              <button
                key={group.group_id}
                id={`group-card-${group.group_id}`}
                onClick={() => navigate(`/groups/${group.group_id}`)}
                className="card p-5 text-left hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800 transition-all duration-200 hover:-translate-y-0.5 group"
              >
                {/* Group icon + name */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-200 dark:group-hover:bg-brand-900/60 transition-colors">
                    <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
                      {group.group_name}
                    </h3>
                    {group.description && (
                      <p className="text-xs text-gray-400 dark:text-slate-500 truncate mt-0.5">{group.description}</p>
                    )}
                  </div>
                </div>

                {/* Balance */}
                <div className={`rounded-xl px-3 py-2 ${
                  group.my_net_balance > 0
                    ? 'bg-emerald-50 dark:bg-emerald-900/20'
                    : group.my_net_balance < 0
                    ? 'bg-red-50 dark:bg-red-900/20'
                    : 'bg-gray-50 dark:bg-slate-700/50'
                }`}>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">Your balance</p>
                  <AmountBadge amount={group.my_net_balance} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={handleGroupCreated}
      />
    </div>
  );
}
