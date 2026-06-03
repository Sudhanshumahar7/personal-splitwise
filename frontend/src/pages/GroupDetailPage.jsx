import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import useAuthStore from '../store/authStore';
import useUIStore from '../store/uiStore';
import { groupsApi, expensesApi } from '../api/client';

import AddMemberModal from '../components/groups/AddMemberModal';
import AddExpenseModal from '../components/expenses/AddExpenseModal';
import SettleUpModal from '../components/expenses/SettleUpModal';
import ExpenseDetailDrawer from '../components/expenses/ExpenseDetailDrawer';

const formatAmount = (amount) => {
  return `₹${Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addToast } = useUIStore();

  const [group, setGroup] = useState(null);
  const [balances, setBalances] = useState({ member_balances: [], debts: [] });
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettleUp, setShowSettleUp] = useState(false);
  
  // Edit & Drawer state
  const [editExpense, setEditExpense] = useState(null);
  const [activeExpenseId, setActiveExpenseId] = useState(null);

  const fetchData = async () => {
    try {
      const [grpRes, balRes, expRes] = await Promise.all([
        groupsApi.get(groupId),
        groupsApi.getBalances(groupId),
        expensesApi.listByGroup(groupId)
      ]);
      setGroup(grpRes.data);
      setBalances(balRes.data);
      setExpenses(expRes.data);
    } catch (err) {
      addToast('Failed to load group details', 'error');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [groupId]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="skeleton h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-2 skeleton h-96 rounded-2xl" />
          <div className="skeleton h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Determine user's role in this group
  const myMemberRecord = group.members.find((m) => m.user_id === user?.id);
  const myRole = myMemberRecord?.role;
  const canManageMembers = myRole === 'CREATOR' || myRole === 'ADMIN';

  // Find active expense for the drawer
  const activeExpense = expenses.find((e) => e.id === activeExpenseId);

  return (
    <div className="animate-fade-in">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <button onClick={() => navigate('/dashboard')} className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            {group.name}
            {myRole === 'CREATOR' && <span className="role-badge-creator">Creator</span>}
            {myRole === 'ADMIN' && <span className="role-badge-admin">Admin</span>}
          </h1>
          {group.description && (
            <p className="text-gray-500 dark:text-slate-400 mt-2 max-w-2xl">{group.description}</p>
          )}
        </div>
        
        <div className="flex gap-2">
          <button onClick={() => setShowSettleUp(true)} className="btn-secondary bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40">
            Settle Up
          </button>
          <button onClick={() => setShowAddExpense(true)} className="btn-primary">
            Add Expense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
        
        {/* ── Left Column: Expenses ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-2">
            Expenses
          </h2>
          
          {expenses.length === 0 ? (
            <div className="card p-12 text-center border-dashed border-2 bg-transparent shadow-none">
              <p className="text-gray-500 dark:text-slate-400 mb-4">No expenses recorded yet.</p>
              <button onClick={() => setShowAddExpense(true)} className="btn-secondary mx-auto">
                Add the first expense
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {expenses.map((expense) => {
                // Determine user's involvement in this expense
                let involvementText = 'Not involved';
                let amountClass = 'amount-neutral';
                let amountText = '';

                if (expense.paid_by_id === user?.id) {
                  const othersOwe = expense.splits
                    .filter((s) => s.user_id !== user.id)
                    .reduce((acc, s) => acc + s.owed_amount, 0);
                  involvementText = 'You lent';
                  amountClass = 'amount-positive';
                  amountText = formatAmount(othersOwe);
                } else {
                  const mySplit = expense.splits.find((s) => s.user_id === user?.id);
                  if (mySplit) {
                    involvementText = `${expense.paid_by.name} lent you`;
                    amountClass = 'amount-negative';
                    amountText = formatAmount(mySplit.owed_amount);
                  }
                }

                return (
                  <button
                    key={expense.id}
                    onClick={() => setActiveExpenseId(expense.id)}
                    className="w-full text-left card p-4 hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800 transition-all group flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      {/* Date Block */}
                      <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-gray-50 dark:bg-slate-800/50 flex-shrink-0">
                        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-widest">{format(new Date(expense.created_at), 'MMM')}</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white leading-none">{format(new Date(expense.created_at), 'd')}</span>
                      </div>
                      
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-lg group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                          {expense.description}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          {expense.paid_by.name} paid <span className="font-medium text-gray-700 dark:text-slate-300">₹{expense.total_amount}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      {amountText ? (
                        <>
                          <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">{involvementText}</p>
                          <p className={`font-semibold ${amountClass}`}>{amountText}</p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400 dark:text-slate-500 italic">Not involved</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right Column: Balances & Members ────────────────────────────── */}
        <div className="space-y-8">
          
          {/* Debts (Who owes whom) */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-2 mb-4">
              Balances
            </h2>
            
            {balances.debts.length === 0 ? (
              <div className="card p-6 text-center text-sm text-gray-500 dark:text-slate-400 bg-gray-50/50 dark:bg-slate-800/20 shadow-none">
                Everyone is settled up! 🎉
              </div>
            ) : (
              <div className="card divide-y divide-gray-100 dark:divide-slate-800">
                {balances.debts.map((debt, i) => {
                  const amDebtor = debt.debtor.id === user?.id;
                  const amCreditor = debt.creditor.id === user?.id;
                  const isMyDebt = amDebtor || amCreditor;
                  
                  return (
                    <div key={i} className={`p-4 flex justify-between items-center ${isMyDebt ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''}`}>
                      <div className="flex items-center gap-2">
                        {amDebtor ? (
                          <span className="font-semibold text-gray-900 dark:text-white">You</span>
                        ) : (
                          <span className="text-gray-700 dark:text-slate-300">{debt.debtor.name}</span>
                        )}
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        {amCreditor ? (
                          <span className="font-semibold text-gray-900 dark:text-white">You</span>
                        ) : (
                          <span className="text-gray-700 dark:text-slate-300">{debt.creditor.name}</span>
                        )}
                      </div>
                      <span className={`font-semibold ${amDebtor ? 'amount-negative' : amCreditor ? 'amount-positive' : 'text-gray-900 dark:text-white'}`}>
                        {formatAmount(debt.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Members List */}
          <div>
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2 mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Members</h2>
              {canManageMembers && (
                <button onClick={() => setShowAddMember(true)} className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline">
                  + Add Member
                </button>
              )}
            </div>
            
            <div className="card divide-y divide-gray-100 dark:divide-slate-800">
              {group.members.map((member) => (
                <div key={member.user_id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center text-sm font-semibold text-brand-700 dark:text-brand-300">
                      {member.user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {member.user.name} {member.user_id === user?.id && '(You)'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{member.user.email}</p>
                    </div>
                  </div>
                  
                  {member.role === 'CREATOR' ? (
                    <span className="role-badge-creator ml-2">Creator</span>
                  ) : member.role === 'ADMIN' ? (
                    <span className="role-badge-admin ml-2">Admin</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals & Drawers ──────────────────────────────────────────────── */}
      
      <AddMemberModal
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        groupId={groupId}
        onAdded={fetchData}
      />

      <AddExpenseModal
        isOpen={showAddExpense || !!editExpense}
        onClose={() => { setShowAddExpense(false); setEditExpense(null); }}
        groupId={groupId}
        members={group.members}
        editExpense={editExpense}
        onSaved={fetchData}
      />

      <SettleUpModal
        isOpen={showSettleUp}
        onClose={() => setShowSettleUp(false)}
        groupId={groupId}
        members={group.members}
        debts={balances.debts}
        onSettled={fetchData}
      />

      {/* Slide-in Chat Drawer */}
      <ExpenseDetailDrawer
        isOpen={!!activeExpenseId}
        onClose={() => setActiveExpenseId(null)}
        expense={activeExpense}
        onEdit={() => {
          setActiveExpenseId(null);
          setEditExpense(activeExpense);
        }}
        onDelete={fetchData}
      />
    </div>
  );
}
