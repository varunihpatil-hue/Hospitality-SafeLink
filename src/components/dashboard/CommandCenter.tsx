import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, AlertCircle, CheckCircle2, Clock, MapPin, MessageSquare, ChevronRight, Brain, LogOut } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError, logout } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, serverTimestamp, addDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { getCrisisAdvice } from '../../lib/gemini';
import { cn } from '../../lib/utils';

export function CommandCenter() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const selectedIncident = incidents.find(i => i.id === selectedIncidentId);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isGettingAdvice, setIsGettingAdvice] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    if (!selectedIncident) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'incidents', selectedIncident.id, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `incidents/${selectedIncident.id}/messages`)
    );

    return () => unsubscribe();
  }, [selectedIncident]);

  const handleSendMessage = async () => {
    if (!selectedIncident || !messageText.trim() || !auth.currentUser) return;

    const text = messageText;
    setMessageText('');

    const path = `incidents/${selectedIncident.id}/messages`;
    try {
      await addDoc(collection(db, path), {
        incidentId: selectedIncident.id,
        senderUid: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || 'Security Dispatch',
        text,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'incidents'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setIncidents(data);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'incidents')
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedIncident) {
      setAiAdvice(selectedIncident.aiSummary || null);
    } else {
      setAiAdvice(null);
    }
  }, [selectedIncident]);

  const handleResolve = async (id: string) => {
    try {
      await updateDoc(doc(db, 'incidents', id), {
        status: 'resolved',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `incidents/${id}`);
    }
  };

  const handleGetAiAdvice = async (incident: any) => {
    setIsGettingAdvice(true);
    setAiAdvice(null);
    const advice = await getCrisisAdvice(incident.type, incident.description);
    setAiAdvice(advice);
    setIsGettingAdvice(false);

    // Persist to Firestore
    try {
      await updateDoc(doc(db, 'incidents', incident.id), {
        aiSummary: advice,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `incidents/${incident.id}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userRole');
    logout();
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex flex-col font-sans">
      {/* Header Bar */}
      <div className="bg-white border-b border-black p-4 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-black" />
          <h1 className="text-xl font-bold tracking-tighter uppercase italic serif">Command Center</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
             Live Sync Active
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-mono border border-black px-3 py-1 hover:bg-black hover:text-white transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Logout
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Incident List */}
        <div className="w-1/3 border-right border-black bg-white overflow-y-auto">
          <div className="p-4 border-b border-black bg-gray-50 flex justify-between items-center">
            <span className="text-[10px] font-mono uppercase font-bold text-gray-500">Active Signals</span>
            <span className="text-[10px] bg-red-600 text-white px-2 rounded-full font-mono">
              {incidents.filter(i => i.status === 'active').length} ALERT
            </span>
          </div>
          
          {incidents.map((incident) => (
            <motion.div
              layout
              key={incident.id}
              onClick={() => setSelectedIncidentId(incident.id)}
              className={cn(
                "p-4 border-b border-black cursor-pointer transition-colors group",
                selectedIncidentId === incident.id ? "bg-black text-white" : "hover:bg-gray-100",
                incident.status === 'active' ? "border-l-4 border-l-red-600" : "opacity-60"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                   {incident.status === 'active' ? 
                     <AlertCircle className="w-4 h-4 text-red-600 group-hover:text-red-400" /> : 
                     <CheckCircle2 className="w-4 h-4 text-green-600" />
                   }
                   <span className="font-mono text-xs font-bold uppercase">{incident.type}</span>
                </div>
                <span className="text-[10px] font-mono opacity-50">
                  {incident.createdAt ? format(incident.createdAt.toDate(), 'HH:mm:ss') : '--:--'}
                </span>
              </div>
              <p className="text-sm line-clamp-1 mb-2 font-medium">{incident.description}</p>
              <div className="flex items-center gap-3 text-[10px] font-mono opacity-50 italic">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Area 4-B</span>
                <span>ID: {incident.id.slice(0, 8)}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Right: Detailed View */}
        <div className="flex-1 bg-[#EEEDE9] p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            {selectedIncident ? (
              <motion.div
                key={selectedIncident.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                {/* Meta Header */}
                <div className="flex justify-between items-end border-b border-black pb-4">
                  <div>
                    <h2 className="text-5xl font-black tracking-tighter uppercase italic serif mb-2">
                      {selectedIncident.type} Crisis
                    </h2>
                    <div className="flex gap-4 text-xs font-mono uppercase">
                      <span className="bg-black text-white px-2 py-1">#{selectedIncident.id.slice(0, 8)}</span>
                      <span className="flex items-center gap-1 border border-black px-2 py-1">
                        <Clock className="w-3 h-3" /> 
                        {selectedIncident.createdAt ? format(selectedIncident.createdAt.toDate(), 'PPP p') : 'PENDING'}
                      </span>
                    </div>
                  </div>
                  {selectedIncident.status === 'active' && (
                    <button 
                      onClick={() => handleResolve(selectedIncident.id)}
                      className="bg-green-600 text-white px-6 py-2 uppercase font-mono text-xs font-bold hover:bg-green-700 active:scale-95 transition-all"
                    >
                      Resolve Incident
                    </button>
                  )}
                </div>

                {/* Grid Content */}
                <div className="grid grid-cols-3 gap-6">
                   <div className="col-span-2 space-y-6">
                      <section className="bg-white border border-black p-6">
                         <h3 className="text-[10px] font-mono uppercase font-bold text-gray-500 mb-4 italic serif underline">Situation Report</h3>
                         <p className="text-lg leading-relaxed">{selectedIncident.description}</p>
                      </section>

                      <div className="grid grid-cols-2 gap-6">
                         <div className="bg-white border border-black p-4">
                            <h3 className="text-[10px] font-mono uppercase font-bold text-gray-500 mb-2">Reporter Identity</h3>
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-black flex items-center justify-center text-white">
                                  {selectedIncident.reporterName?.[0]}
                               </div>
                               <div>
                                  <p className="text-sm font-bold uppercase">{selectedIncident.reporterName}</p>
                                  <p className="text-[10px] font-mono opacity-50">Staff ID: {selectedIncident.reporterUid.slice(0, 6)}</p>
                               </div>
                            </div>
                         </div>
                         <div className="bg-white border border-black p-4">
                            <h3 className="text-[10px] font-mono uppercase font-bold text-gray-500 mb-2">Geo-Coordinates</h3>
                            <div className="flex items-center gap-2">
                               <MapPin className="w-5 h-5 text-red-600" />
                               <span className="font-mono text-xs">
                                 {selectedIncident.location?.lat.toFixed(6)}, {selectedIncident.location?.lng.toFixed(6)}
                               </span>
                            </div>
                            <p className="text-[10px] font-mono opacity-50 mt-1 uppercase italic">Accuracy: High-Def Uplink</p>
                         </div>
                      </div>
                   </div>

                   {/* AI Advisor Column */}
                   <div className="space-y-6">
                      <div className="bg-[#151619] text-white p-6 border-2 border-black overflow-hidden relative">
                         <div className="flex items-center gap-2 mb-4 border-b border-gray-800 pb-2">
                           <Brain className="w-6 h-6 text-blue-400" />
                           <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400">AI Crisis Advisor</h3>
                         </div>
                         
                         {aiAdvice ? (
                           <div className="text-[11px] font-mono leading-relaxed space-y-2 whitespace-pre-wrap">
                             {aiAdvice}
                           </div>
                         ) : (
                           <div className="text-center py-8">
                             {isGettingAdvice ? (
                               <div className="flex flex-col items-center gap-3">
                                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                                  <p className="text-[10px] uppercase animate-pulse">Analyzing Vectors...</p>
                               </div>
                             ) : (
                               <button 
                                 onClick={() => handleGetAiAdvice(selectedIncident)}
                                 className="w-full py-3 border border-dashed border-blue-400 text-blue-400 text-[10px] uppercase hover:bg-blue-400 hover:text-black transition-all"
                               >
                                 Generate HQ Matrix Advice
                               </button>
                             )}
                           </div>
                         )}
                         <div className="absolute top-0 right-0 p-2 opacity-10">
                            <Brain className="w-32 h-32" />
                         </div>
                      </div>

                      <div className="bg-white border border-black p-4 flex flex-col h-[300px]">
                         <h3 className="text-[10px] font-mono uppercase font-bold text-gray-500 mb-3 flex items-center justify-between">
                            Communication Log
                            <MessageSquare className="w-3 h-3" />
                         </h3>
                         <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2 custom-scrollbar">
                            {messages.length === 0 ? (
                              <p className="text-[10px] italic opacity-50">Secure channel initialized...</p>
                            ) : (
                              messages.map((msg: any) => (
                                <div key={msg.id} className={cn(
                                  "border-l-2 pl-3 py-1",
                                  msg.senderUid === auth.currentUser?.uid ? "border-black" : "border-red-600"
                                )}>
                                   <div className="flex justify-between items-center mb-1">
                                      <p className="text-[10px] font-bold uppercase">{msg.senderName}</p>
                                      <p className="text-[8px] font-mono opacity-40">
                                        {msg.createdAt ? format(msg.createdAt.toDate(), 'HH:mm:ss') : '...'}
                                      </p>
                                   </div>
                                   <p className="text-[10px] leading-tight">{msg.text}</p>
                                </div>
                              ))
                            )}
                         </div>
                         <div className="mt-auto">
                            <form 
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleSendMessage();
                              }}
                              className="flex gap-2"
                            >
                               <input 
                                 type="text"
                                 value={messageText}
                                 onChange={(e) => setMessageText(e.target.value)}
                                 placeholder="Type message..."
                                 className="flex-1 bg-gray-100 border border-black p-2 text-[10px] outline-none uppercase font-mono"
                               />
                               <button 
                                 type="submit"
                                 disabled={!messageText.trim()}
                                 className="px-3 bg-black text-white text-[10px] font-bold uppercase disabled:opacity-50"
                               >
                                 Send
                               </button>
                            </form>
                         </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                 <Shield className="w-16 h-16 mb-4 opacity-10" />
                 <p className="font-mono text-xs uppercase tracking-widest">Awaiting Signal Input</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Loader2({ className }: { className?: string }) {
  return (
    <svg 
      className={cn("animate-spin", className)} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
