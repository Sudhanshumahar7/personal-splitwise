import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import useAuthStore from '../../store/authStore';
import { chatApi, expensesApi } from '../../api/client';
import useUIStore from '../../store/uiStore';

const formatAmount = (amount) => {
  return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function ExpenseDetailDrawer({ expense, isOpen, onClose, onEdit, onDelete }) {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [ws, setWs] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const messagesEndRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Load chat history & connect WebSocket
  useEffect(() => {
    if (!isOpen || !expense) return;

    let socket = null;
    let isMounted = true;

    const initChat = async () => {
      setLoading(true);
      try {
        // 1. Fetch historical messages via REST
        const res = await chatApi.getHistory(expense.id);
        if (isMounted) setMessages(res.data);
        
        // 2. Connect WebSocket for real-time updates
        // We need to pass the token in query param.
        // We can parse it from document.cookie, but HTTP-only cookies cannot be read via JS.
        // Wait, HTTPOnly means JS can't read it.
        // Let's modify the backend to check the session/cookie in the WebSocket route.
        // Actually, FastAPI WebSockets don't easily read cookies cross-origin in some setups, but they can read headers/cookies if same origin.
        // Since we are proxying /ws to backend, the browser will send the HTTPOnly cookie automatically!
        // We don't need to pass the token manually if we are on the same domain or proxy.
        // Let's use the proxy path.
        
        // Use VITE_API_URL for production (Render backend), fallback to local proxy
        const apiBase = import.meta.env.VITE_API_URL || '';
        let wsUrl;
        if (apiBase) {
          const wsBase = apiBase.replace(/^http/, 'ws');
          wsUrl = `${wsBase}/ws/expenses/${expense.id}`;
        } else {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${protocol}//${window.location.host}/ws/expenses/${expense.id}`;
        }
        
        socket = new WebSocket(wsUrl);
        
        socket.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (isMounted) {
            setMessages((prev) => [...prev, msg]);
          }
        };
        
        socket.onerror = (error) => {
          console.error("WebSocket Error:", error);
        };
        
        if (isMounted) setWs(socket);
      } catch (err) {
        console.error("Failed to load chat", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initChat();

    // Lock body scroll
    document.body.style.overflow = 'hidden';

    return () => {
      isMounted = false;
      document.body.style.overflow = '';
      if (socket) {
        socket.close();
      }
    };
  }, [isOpen, expense]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;
    
    ws.send(JSON.stringify({ message_text: newMessage.trim() }));
    setNewMessage('');
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this expense? This cannot be undone.")) return;
    
    try {
      await expensesApi.delete(expense.id);
      addToast("Expense deleted", "success");
      onDelete();
      onClose();
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to delete", "error");
    }
  };

  if (!isOpen || !expense) return null;

  const isPayer = user?.id === expense.paid_by_id;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
      
      {/* Drawer */}
      <div className="fixed top-0 right-0 w-full max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col animate-slide-right border-l border-gray-200 dark:border-slate-800">
        
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-start bg-gray-50/50 dark:bg-slate-900/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{expense.description}</h2>
            <p className="text-2xl font-semibold text-brand-600 dark:text-brand-400 mt-1">
              {formatAmount(expense.total_amount)}
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Paid by <span className="font-medium text-gray-700 dark:text-slate-300">{expense.paid_by?.name}</span> on {format(new Date(expense.created_at), 'MMM d, yyyy')}
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-slate-800 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          
          {/* Split Details Section */}
          <div className="p-4 border-b border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Split Details</h3>
              <span className="badge badge-blue">{expense.split_method}</span>
            </div>
            
            <div className="space-y-2">
              {expense.splits.map((split) => (
                <div key={split.id} className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-slate-400">{split.user?.name} {split.user_id === user?.id ? '(You)' : ''}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatAmount(split.owed_amount)}</span>
                </div>
              ))}
              {expense.rounding_remainder && (
                <div className="flex justify-between items-center text-sm text-amber-600 dark:text-amber-500 mt-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                  <span>Rounding Remainder</span>
                  <span className="font-medium">{formatAmount(expense.rounding_remainder)}</span>
                </div>
              )}
            </div>
            
            {/* Edit / Delete Actions (Only for Payer) */}
            {isPayer && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button onClick={onEdit} className="btn-secondary flex-1 py-1.5 text-xs">Edit Expense</button>
                <button onClick={handleDelete} className="btn-danger flex-1 py-1.5 text-xs">Delete</button>
              </div>
            )}
          </div>

          {/* Chat Section */}
          <div className="flex-1 p-4 bg-gray-50 dark:bg-slate-900/50 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">Expense Chat</h3>
            
            <div className="flex-1 space-y-4 mb-4">
              {loading ? (
                <div className="text-center text-sm text-gray-500 animate-pulse">Loading chat...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-sm text-gray-400 dark:text-slate-500 mt-10">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <span className="text-xs text-gray-400 dark:text-slate-500 mb-1 ml-1 mr-1">
                        {isMe ? 'You' : msg.sender_name} • {format(new Date(msg.sent_at), 'h:mm a')}
                      </span>
                      <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${
                        isMe 
                          ? 'bg-brand-600 text-white rounded-tr-sm' 
                          : 'bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-900 dark:text-slate-100 rounded-tl-sm'
                      }`}>
                        {msg.message_text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Chat Input */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="input flex-1 rounded-full px-5 py-2.5 bg-gray-50 dark:bg-slate-800 border-transparent focus:bg-white"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || !ws}
              className="w-11 h-11 flex-shrink-0 bg-brand-600 hover:bg-brand-700 text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
