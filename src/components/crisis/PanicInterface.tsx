import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, MapPin, CheckCircle, Wifi, Camera, LogOut, Brain, Loader2 } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError, logout } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { cn } from '../../lib/utils';
import { getCrisisAdvice } from '../../lib/gemini';

export function PanicInterface() {
  const [isActivating, setIsActivating] = useState(false);
  const [incidentsSent, setIncidentsSent] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'medical' | 'fire' | 'security' | 'other'>('security');
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isLoweringAdvice, setIsLoweringAdvice] = useState(false);
  const [lastIncidentId, setLastIncidentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');

  useEffect(() => {
    if (!lastIncidentId) return;

    const q = query(
      collection(db, 'incidents', lastIncidentId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `incidents/${lastIncidentId}/messages`)
    );

    return () => unsubscribe();
  }, [lastIncidentId]);

  const handleSendMessage = async () => {
    if (!lastIncidentId || !messageText.trim() || !auth.currentUser) return;

    const text = messageText;
    setMessageText('');

    const path = `incidents/${lastIncidentId}/messages`;
    try {
      await addDoc(collection(db, path), {
        incidentId: lastIncidentId,
        senderUid: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || 'Staff Member',
        text,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error("Geolocation error", err)
      );
    }
  }, []);

  const triggerPanic = async () => {
    if (!auth.currentUser) return;
    setIsActivating(true);
    setAiAdvice(null);

    const path = 'incidents';
    try {
      const docRef = await addDoc(collection(db, path), {
        reporterUid: auth.currentUser.uid,
        reporterName: auth.currentUser.displayName || 'Staff Member',
        type,
        status: 'active',
        description: description || `Emergency Alert: ${type.toUpperCase()}`,
        location: location || { lat: 0, lng: 0 },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      setLastIncidentId(docRef.id);
      setIncidentsSent(true);
      
      // Get AI Advice for staff
      setIsLoweringAdvice(true);
      const advice = await getCrisisAdvice(type, description || `Emergency Alert: ${type.toUpperCase()}`);
      setAiAdvice(advice);
      setIsLoweringAdvice(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      setIsActivating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userRole');
    logout();
  };

  const resetInterface = () => {
    setIncidentsSent(false);
    setIsActivating(false);
    setDescription('');
    setLastIncidentId(null);
    setMessages([]);
    setAiAdvice(null);
  };

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-white font-mono p-6 flex flex-col items-center justify-between">
      {/* HUD Header */}
      <div className="w-full flex justify-between items-center border-b border-gray-800 pb-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#8E9299] hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Terminate Session</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] uppercase tracking-widest text-[#8E9299]">Uplink Stable</span>
        </div>
      </div>

      <div className="flex-1 w-full max-w-sm flex flex-col justify-center gap-8 py-8 overflow-y-auto no-scrollbar">
        <AnimatePresence mode="wait">
          {!incidentsSent ? (
            <motion.div 
              key="interface"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              <div className="text-center">
                <h2 className="text-2xl font-bold tracking-[0.2em] uppercase mb-1">Crisis Module</h2>
                <p className="text-[10px] text-[#8E9299] uppercase tracking-[0.3em]">Deployment Status: Ready</p>
              </div>

              {/* Big Panic Button */}
              <div className="relative flex justify-center">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => !isActivating && triggerPanic()}
                  disabled={isActivating}
                  className={cn(
                    "relative w-44 h-44 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                    "border-red-500/30 bg-red-500/10 shadow-[0_0_50px_rgba(239,68,68,0.15)]",
                    isActivating && "animate-pulse border-red-500 bg-red-500/20"
                  )}
                >
                  <div className="text-center flex flex-col items-center z-10">
                    <AlertTriangle className={cn("w-10 h-10 mb-2 text-red-500", isActivating && "animate-bounce")} />
                    <span className="text-base font-black tracking-tighter uppercase">
                      {isActivating ? 'Linking...' : 'Broadcast'}
                    </span>
                  </div>
                  <div className="absolute inset-[-10px] border border-red-500/10 rounded-full animate-[spin_10s_linear_infinite]" />
                  <div className="absolute inset-[-20px] border border-dashed border-red-500/5 rounded-full animate-[spin_20s_linear_infinite_reverse]" />
                </motion.button>
              </div>

              {/* Input Controls */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-2">
                  {(['security', 'medical', 'fire', 'other'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={cn(
                        "border p-3 text-[10px] uppercase tracking-widest transition-all",
                        type === t ? "bg-white text-black border-white font-bold" : "border-gray-800 text-[#555] hover:border-gray-600"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="relative group">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide Situation Context..."
                    className="w-full bg-black/40 border border-gray-800 p-4 text-xs focus:border-red-500/50 outline-none h-24 uppercase placeholder:text-gray-700 tracking-wider resize-none"
                  />
                  <div className="absolute bottom-2 right-2 flex gap-2">
                     <Camera className="w-4 h-4 text-[#444] group-hover:text-white cursor-pointer transition-colors" />
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="post-broadcast"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="w-full border border-green-500/50 bg-green-500/5 p-6 flex flex-col items-center justify-center relative overflow-hidden">
                <CheckCircle className="w-12 h-12 text-green-500 mb-2" />
                <span className="text-sm font-black tracking-[0.2em] text-green-500 uppercase">Alert Broadcasted</span>
                <div className="absolute top-0 right-0 w-2 h-2 bg-green-500 animate-ping m-2" />
              </div>

              <div className="border border-blue-500/30 bg-blue-500/5 p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-blue-500/20 pb-2">
                  <Brain className="w-5 h-5 text-blue-400" />
                  <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-blue-400">AI Protocol Matrix</h3>
                </div>

                {isLoweringAdvice ? (
                  <div className="flex flex-col items-center py-6 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                    <p className="text-[9px] uppercase tracking-widest animate-pulse">Calculating Critical Response...</p>
                  </div>
                ) : (
                  <div className="text-[10px] leading-relaxed text-blue-200/80 whitespace-pre-wrap font-medium">
                    {aiAdvice || "Establishing Advisor link..."}
                  </div>
                )}
              </div>

              {/* Chat Log for Staff */}
              <div className="border border-red-500/30 bg-red-500/5 p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-red-500/20 pb-2">
                  <Wifi className="w-5 h-5 text-red-400" />
                  <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-red-400">Dispatch Comms</h3>
                </div>
                
                <div className="max-h-40 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                  {messages.length === 0 ? (
                    <p className="text-[9px] uppercase tracking-widest text-gray-600 italic">No incoming transmissions...</p>
                  ) : (
                    messages.map((msg: any) => (
                      <div key={msg.id} className="border-l border-gray-700 pl-3">
                         <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-bold text-gray-400 uppercase">{msg.senderName}</span>
                         </div>
                         <p className="text-[10px] leading-relaxed">{msg.text}</p>
                      </div>
                    ))
                  )}
                </div>

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
                    placeholder="MSG DISPATCH..."
                    className="flex-1 bg-black/40 border border-red-500/20 p-2 text-[10px] outline-none uppercase tracking-widest focus:border-red-500/50"
                  />
                  <button 
                    type="submit"
                    disabled={!messageText.trim()}
                    className="bg-red-500/20 px-3 py-1 text-[10px] uppercase font-bold text-red-500 disabled:opacity-30"
                  >
                    SEND
                  </button>
                </form>
              </div>

              <button 
                onClick={resetInterface}
                className="w-full py-3 border border-gray-800 text-[10px] uppercase tracking-widest text-gray-500 hover:text-white hover:border-white transition-all"
              >
                Return to Broadcast Hub
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="w-full grid grid-cols-2 gap-4 text-[9px] uppercase tracking-widest text-[#444] pt-6 border-t border-gray-900 mt-auto">
        <div className="flex items-center gap-2">
          <MapPin className="w-3 h-3" />
          <span className="text-gray-600">{location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : 'GPS OFFLINE'}</span>
        </div>
        <div className="text-right">
          UPLINK: SGN-09-V3
        </div>
      </div>
    </div>
  );
}
