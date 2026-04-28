import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Send, MessageCircle, AlertTriangle, ShieldCheck, MapPin, Phone, Loader2, LogOut, ChevronDown } from 'lucide-react';
import { analyzeGuestMessage } from '../../lib/gemini';
import { auth, logout, db, OperationType, handleFirestoreError } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { cn } from '../../lib/utils';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  category?: 'Normal' | 'Mild Concern' | 'Unsafe Situation' | 'Emergency';
  timestamp: Date;
}

export function GuestAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I am your Hospitality SafeLink AI. Your safety and comfort are my top priorities. How can I assist you today?",
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeIncidentId) return;

    const q = query(
      collection(db, 'incidents', activeIncidentId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreMsgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text,
          sender: data.senderUid === auth.currentUser?.uid ? 'user' : 'ai' as 'user' | 'ai',
          timestamp: data.createdAt?.toDate() || new Date()
        };
      });
      
      setMessages(prev => {
        const userAndAiInitial = prev.filter(m => m.id === '1' || m.sender === 'user'); 
        // Note: Simple sync logic for demo
        return [...prev.filter(m => m.id === '1'), ...firestoreMsgs];
      });
    }, (error) => handleFirestoreError(error, OperationType.LIST, `incidents/${activeIncidentId}/messages`));

    return () => unsubscribe();
  }, [activeIncidentId]);

  const triggerSOS = async (reason: string = 'SOS TRIGGERED BY GUEST') => {
    if (!auth.currentUser) return;
    setIsTyping(true);

    try {
      const docRef = await addDoc(collection(db, 'incidents'), {
        reporterUid: auth.currentUser.uid,
        reporterName: auth.currentUser.displayName || 'Guest',
        type: 'security',
        status: 'active',
        description: reason,
        location: { lat: 0, lng: 0 },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      setActiveIncidentId(docRef.id);
      
      const aiMsg: Message = {
        id: Date.now().toString(),
        text: "SOS RECEIVED. Hotel Security has been dispatched to your location. Stay calm. Stay where you are if safe, or move to the nearest exit.",
        sender: 'ai',
        category: 'Emergency',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'incidents');
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userText = input;
    setInput('');
    
    const userMsg: Message = {
      id: Date.now().toString(),
      text: userText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);

    if (activeIncidentId) {
      try {
        await addDoc(collection(db, 'incidents', activeIncidentId, 'messages'), {
          incidentId: activeIncidentId,
          senderUid: auth.currentUser?.uid,
          senderName: auth.currentUser?.displayName || 'Guest',
          text: userText,
          createdAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `incidents/${activeIncidentId}/messages`);
      }
      return;
    }

    setIsTyping(true);

    try {
      const analysis = await analyzeGuestMessage(userText);
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: analysis.ai_response,
        sender: 'ai',
        category: analysis.category,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble connecting to my safety protocols. Please contact the front desk immediately if you feel unsafe.",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const getCategoryStyles = (category?: string) => {
    switch (category) {
      case 'Emergency': return 'border-red-600 bg-red-50 text-red-900 shadow-[0_0_15px_rgba(220,38,38,0.2)]';
      case 'Unsafe Situation': return 'border-orange-500 bg-orange-50 text-orange-900';
      case 'Mild Concern': return 'border-amber-400 bg-amber-50 text-amber-900';
      default: return 'border-gray-200 bg-white text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center p-4 md:p-8 font-sans">
      <div className="w-full max-w-2xl bg-white border border-black/10 shadow-2xl flex flex-col h-[85vh] relative overflow-hidden">
        
        {/* Header */}
        <header className="p-6 bg-black text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-full border border-white/20 animate-pulse">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-[0.2em] uppercase">SafeLink AI</h1>
              <p className="text-[10px] font-mono opacity-50 uppercase">Active Monitoring Enabled</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="p-2 hover:bg-white/10 transition-colors rounded"
          >
            <LogOut className="w-4 h-4 opacity-60" />
          </button>
        </header>

        {/* Status Bar */}
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Environment Secure</span>
        </div>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
        >
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[85%]",
                  msg.sender === 'user' ? "ml-auto items-end" : "items-start"
                )}
              >
                {msg.sender === 'ai' && msg.category && msg.category !== 'Normal' && (
                  <div className="flex items-center gap-1.5 mb-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[9px] font-black uppercase tracking-tighter">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {msg.category} DETECTED
                  </div>
                )}
                
                <div className={cn(
                  "p-4 text-sm leading-relaxed",
                  msg.sender === 'user' 
                    ? "bg-black text-white" 
                    : cn("border border-black/5", getCategoryStyles(msg.category))
                )}>
                  {msg.text}
                </div>
                
                <span className="text-[9px] opacity-30 mt-1 uppercase font-mono">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isTyping && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-gray-400"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[10px] font-mono italic uppercase">AI Analyzing Safety Context...</span>
            </motion.div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="px-6 py-3 border-t border-black/5 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {[
            { icon: AlertTriangle, text: 'SOS', color: 'text-red-600 border-red-200 bg-red-50', action: () => triggerSOS() },
            { icon: Phone, text: 'Room Service', color: 'text-black border-gray-200', action: () => setInput('I would like to order room service') },
            { icon: MapPin, text: 'Safe Navigation', color: 'text-black border-gray-200', action: () => setInput('What is the safest route to the lobby?') },
            { icon: ShieldCheck, text: 'Security Request', color: 'text-black border-gray-200', action: () => setInput('I have a small security concern') },
          ].map((action, i) => (
            <button 
              key={i}
              onClick={action.action}
              className={cn(
                "flex items-center gap-2 px-3 py-2 border text-[10px] font-bold uppercase tracking-widest hover:border-black transition-colors shrink-0",
                action.color
              )}
            >
              <action.icon className="w-3 h-3" />
              {action.text}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="p-6 border-t border-black/10 bg-white">
          <div className="relative flex items-center">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="How can I help you safely?"
              className="w-full pl-4 pr-12 py-4 bg-gray-100 border border-transparent focus:border-black/20 focus:bg-white outline-none text-sm transition-all"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="absolute right-2 p-2 bg-black text-white hover:bg-gray-800 disabled:opacity-30 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-3 text-[9px] text-gray-400 text-center uppercase tracking-[0.2em]">
            Encrypted Session • Verified Safety Channel
          </p>
        </div>

        {/* Geometric Background Detail */}
        <div className="absolute top-[-100px] right-[-100px] w-64 h-64 border border-black/5 rounded-full pointer-events-none" />
        <div className="absolute bottom-[-100px] left-[-100px] w-64 h-64 border border-black/5 rounded-full pointer-events-none" />
      </div>
    </div>
  );
}
