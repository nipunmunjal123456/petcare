/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Dog, 
  Cat, 
  Stethoscope, 
  Syringe, 
  Pill, 
  Info, 
  AlertTriangle,
  ChevronRight,
  Plus,
  History as HistoryIcon,
  Heart,
  Calendar,
  Trash2,
  Clock,
  MessageSquare,
  User as UserIcon,
  LogOut,
  Send,
  ThumbsUp,
  MessageCircle,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { formatDistanceToNow } from 'date-fns';
import { getHealthAdvice, getVaccineSchedule, getDosageAdvice } from './services/geminiService';
import { cn } from './lib/utils';
import { PetInfo, HistoryItem, HistoryType } from './types';
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User } from './firebase';
import Forum from './components/Forum';
import NearbyVets from './components/NearbyVets';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  increment, 
  setDoc, 
  deleteDoc,
  getDoc,
  runTransaction
} from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [pet, setPet] = useState<PetInfo>({
    id: crypto.randomUUID(),
    name: '',
    species: 'dog',
    breed: '',
    age: '',
    weight: '',
    currentMedications: '',
    vetName: '',
    vetPhone: ''
  });
  const [isProfileSet, setIsProfileSet] = useState(false);
  const [symptoms, setSymptoms] = useState('');
  const [medication, setMedication] = useState('');
  const [dosage, setDosage] = useState('');
  const [advice, setAdvice] = useState<string | null>(null);
  const [vaccines, setVaccines] = useState<string | null>(null);
  const [dosageAdvice, setDosageAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'health' | 'vaccines' | 'dosage' | 'history' | 'forum' | 'vets'>('health');
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const loadingMessages = [
    "Consulting veterinary database...",
    "Analyzing symptoms...",
    "Checking for medication interactions...",
    "Reviewing pet history...",
    "Formulating care plan...",
    "Finalizing recommendations..."
  ];

  useEffect(() => {
    let interval: any;
    if (loading) {
      let i = 0;
      setLoadingMessage(loadingMessages[0]);
      interval = setInterval(() => {
        i = (i + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[i]);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('pet_care_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    const savedPet = localStorage.getItem('current_pet');
    if (savedPet) {
      try {
        setPet(JSON.parse(savedPet));
        setIsProfileSet(true);
      } catch (e) {
        console.error("Failed to parse pet", e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('pet_care_history', JSON.stringify(history));
  }, [history]);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Ensure user document exists
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            displayName: currentUser.displayName || 'Anonymous',
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            createdAt: serverTimestamp(),
            role: 'user'
          });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Sign in error", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error", error);
    }
  };

  // Save pet to localStorage
  useEffect(() => {
    if (isProfileSet) {
      localStorage.setItem('current_pet', JSON.stringify(pet));
    }
  }, [pet, isProfileSet]);

  const handleSetProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (pet.name && pet.breed && pet.age) {
      setIsProfileSet(true);
    }
  };

  const addToHistory = (type: HistoryType, content: string, query?: string) => {
    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      petId: pet.id,
      type,
      date: new Date().toISOString(),
      query,
      content
    };
    setHistory(prev => [newItem, ...prev]);
  };

  const handleGetAdvice = async () => {
    if (!symptoms) return;
    setLoading(true);
    try {
      const res = await getHealthAdvice(pet, symptoms);
      if (res) {
        setAdvice(res);
        addToHistory('health', res, symptoms);
      }
    } catch (error) {
      console.error(error);
      setAdvice("Error getting advice. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGetVaccines = async () => {
    setLoading(true);
    try {
      const res = await getVaccineSchedule(pet.species, pet.age);
      if (res) {
        setVaccines(res);
        addToHistory('vaccine', res);
      }
    } catch (error) {
      console.error(error);
      setVaccines("Error getting vaccine schedule.");
    } finally {
      setLoading(false);
    }
  };

  const handleGetDosageAdvice = async () => {
    if (!medication || !dosage) return;
    setLoading(true);
    try {
      const res = await getDosageAdvice(pet, medication, dosage);
      if (res) {
        setDosageAdvice(res);
        addToHistory('dosage', res, `${medication} (${dosage})`);
      }
    } catch (error) {
      console.error(error);
      setDosageAdvice("Error getting dosage advice.");
    } finally {
      setLoading(false);
    }
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear all history?")) {
      setHistory([]);
    }
  };

  useEffect(() => {
    if (isProfileSet && activeTab === 'vaccines' && !vaccines) {
      handleGetVaccines();
    }
  }, [isProfileSet, activeTab]);

  const filteredHistory = history.filter(item => item.petId === pet.id);

  const commonSymptoms = pet.species === 'dog' 
    ? ["Coughing", "Lethargy", "Vomiting", "Diarrhea", "Itching", "Limping", "Loss of appetite", "Bad breath"]
    : ["Sneezing", "Hiding", "Excessive grooming", "Vomiting", "Diarrhea", "Litter box changes", "Loss of appetite", "Eye discharge"];

  const toggleSymptom = (symptom: string) => {
    const currentSymptoms = symptoms.split(',').map(s => s.trim()).filter(s => s !== '');
    if (currentSymptoms.includes(symptom)) {
      setSymptoms(currentSymptoms.filter(s => s !== symptom).join(', '));
    } else {
      setSymptoms(symptoms ? `${symptoms}, ${symptom}` : symptom);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#2D2D2D] font-sans selection:bg-[#FFD166]">
      {/* Navigation */}
      <nav className="border-b border-[#E5E5E5] bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#FFD166] rounded-lg flex items-center justify-center">
              <Heart className="w-5 h-5 text-[#2D2D2D]" fill="currentColor" />
            </div>
            <span className="font-bold text-xl tracking-tight">PetCare AI</span>
          </div>
          {isProfileSet && (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  setIsProfileSet(false);
                  localStorage.removeItem('current_pet');
                  setPet({
                    id: crypto.randomUUID(),
                    name: '',
                    species: 'dog',
                    breed: '',
                    age: '',
                    weight: '',
                    currentMedications: '',
                    vetName: '',
                    vetPhone: ''
                  });
                  setAdvice(null);
                  setVaccines(null);
                }}
                className="text-sm font-medium text-[#666] hover:text-[#2D2D2D] transition-colors"
              >
                New Pet
              </button>
              <button 
                onClick={() => setIsProfileSet(false)}
                className="text-sm font-medium text-[#666] hover:text-[#2D2D2D] transition-colors"
              >
                Edit Profile
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {!isProfileSet ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto"
          >
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold mb-4">Welcome to PetCare</h1>
              <p className="text-[#666]">Tell us about your furry friend to get personalized health advice and vaccine schedules.</p>
            </div>

            <form onSubmit={handleSetProfile} className="bg-white p-8 rounded-3xl shadow-xl shadow-black/5 border border-[#F0F0F0] space-y-6">
              <div className="flex p-1 bg-[#F5F5F5] rounded-xl">
                <button
                  type="button"
                  onClick={() => setPet({ ...pet, species: 'dog' })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all",
                    pet.species === 'dog' ? "bg-white shadow-sm text-[#2D2D2D]" : "text-[#666]"
                  )}
                >
                  <Dog size={18} /> Dog
                </button>
                <button
                  type="button"
                  onClick={() => setPet({ ...pet, species: 'cat' })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all",
                    pet.species === 'cat' ? "bg-white shadow-sm text-[#2D2D2D]" : "text-[#666]"
                  )}
                >
                  <Cat size={18} /> Cat
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#999] mb-1.5">Pet Name</label>
                  <input
                    required
                    type="text"
                    value={pet.name}
                    onChange={(e) => setPet({ ...pet, name: e.target.value })}
                    className="w-full px-4 py-3 bg-[#F9F9F9] border border-[#EEE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD166] transition-all"
                    placeholder="e.g. Buddy"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#999] mb-1.5">Breed</label>
                  <input
                    required
                    type="text"
                    value={pet.breed}
                    onChange={(e) => setPet({ ...pet, breed: e.target.value })}
                    className="w-full px-4 py-3 bg-[#F9F9F9] border border-[#EEE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD166] transition-all"
                    placeholder="e.g. Golden Retriever"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#999] mb-1.5">Age</label>
                    <input
                      required
                      type="text"
                      value={pet.age}
                      onChange={(e) => setPet({ ...pet, age: e.target.value })}
                      className="w-full px-4 py-3 bg-[#F9F9F9] border border-[#EEE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD166] transition-all"
                      placeholder="e.g. 2 years"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#999] mb-1.5">Weight</label>
                    <input
                      required
                      type="text"
                      value={pet.weight}
                      onChange={(e) => setPet({ ...pet, weight: e.target.value })}
                      className="w-full px-4 py-3 bg-[#F9F9F9] border border-[#EEE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD166] transition-all"
                      placeholder="e.g. 25kg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#999] mb-1.5">Current Medications (Optional)</label>
                  <textarea
                    value={pet.currentMedications}
                    onChange={(e) => setPet({ ...pet, currentMedications: e.target.value })}
                    className="w-full px-4 py-3 bg-[#F9F9F9] border border-[#EEE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD166] transition-all resize-none h-20"
                    placeholder="e.g. Heartworm meds, daily vitamins..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#999] mb-1.5">Vet Name (Optional)</label>
                    <input
                      type="text"
                      value={pet.vetName}
                      onChange={(e) => setPet({ ...pet, vetName: e.target.value })}
                      className="w-full px-4 py-3 bg-[#F9F9F9] border border-[#EEE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD166] transition-all"
                      placeholder="e.g. Dr. Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#999] mb-1.5">Vet Phone (Optional)</label>
                    <input
                      type="tel"
                      value={pet.vetPhone}
                      onChange={(e) => setPet({ ...pet, vetPhone: e.target.value })}
                      className="w-full px-4 py-3 bg-[#F9F9F9] border border-[#EEE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD166] transition-all"
                      placeholder="e.g. 555-0123"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-[#2D2D2D] text-white rounded-2xl font-bold hover:bg-[#444] transition-all flex items-center justify-center gap-2"
              >
                Start Care <ChevronRight size={20} />
              </button>
            </form>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Pet Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[#EEE]">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-3 py-1 bg-[#FFD166] text-[#2D2D2D] text-xs font-bold rounded-full uppercase tracking-widest">
                    {pet.species}
                  </span>
                </div>
                <h2 className="text-5xl font-bold mb-2">{pet.name}</h2>
                <p className="text-[#666] text-lg">{pet.breed} • {pet.age} • {pet.weight}</p>
                {pet.currentMedications && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-[#666] bg-[#F5F5F5] px-3 py-1.5 rounded-lg w-fit">
                    <Pill size={14} className="text-[#FFD166]" />
                    <span className="font-medium">Meds:</span> {pet.currentMedications}
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveTab('health')}
                  className={cn(
                    "px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 text-sm",
                    activeTab === 'health' ? "bg-[#2D2D2D] text-white" : "bg-[#F5F5F5] text-[#666] hover:bg-[#EEE]"
                  )}
                >
                  <Stethoscope size={16} /> Health
                </button>
                <button
                  onClick={() => setActiveTab('vaccines')}
                  className={cn(
                    "px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 text-sm",
                    activeTab === 'vaccines' ? "bg-[#2D2D2D] text-white" : "bg-[#F5F5F5] text-[#666] hover:bg-[#EEE]"
                  )}
                >
                  <Syringe size={16} /> Vaccines
                </button>
                <button
                  onClick={() => setActiveTab('dosage')}
                  className={cn(
                    "px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 text-sm",
                    activeTab === 'dosage' ? "bg-[#2D2D2D] text-white" : "bg-[#F5F5F5] text-[#666] hover:bg-[#EEE]"
                  )}
                >
                  <Pill size={16} /> Dosage
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={cn(
                    "px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 text-sm",
                    activeTab === 'history' ? "bg-[#2D2D2D] text-white" : "bg-[#F5F5F5] text-[#666] hover:bg-[#EEE]"
                  )}
                >
                  <HistoryIcon size={16} /> History
                </button>
                <button
                  onClick={() => setActiveTab('forum')}
                  className={cn(
                    "px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 text-sm",
                    activeTab === 'forum' ? "bg-[#2D2D2D] text-white" : "bg-[#F5F5F5] text-[#666] hover:bg-[#EEE]"
                  )}
                >
                  <MessageSquare size={16} /> Forum
                </button>
                <button
                  onClick={() => setActiveTab('vets')}
                  className={cn(
                    "px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 text-sm",
                    activeTab === 'vets' ? "bg-[#2D2D2D] text-white" : "bg-[#F5F5F5] text-[#666] hover:bg-[#EEE]"
                  )}
                >
                  <MapPin size={16} /> Nearby Vets
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <AnimatePresence mode="wait">
                  {activeTab === 'health' ? (
                    <motion.div
                      key="health"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-6"
                    >
                      <div className="bg-white p-8 rounded-3xl border border-[#EEE] shadow-sm">
                        <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                          <Stethoscope className="text-[#FFD166]" /> Symptom Checker
                        </h3>
                        <p className="text-[#666] mb-6">Describe any symptoms or health concerns you have about {pet.name}.</p>
                        
                        <div className="mb-6">
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#999] mb-3">Common Symptoms</label>
                          <div className="flex flex-wrap gap-2">
                            {commonSymptoms.map((symptom) => {
                              const isActive = symptoms.toLowerCase().includes(symptom.toLowerCase());
                              return (
                                <button
                                  key={symptom}
                                  onClick={() => toggleSymptom(symptom)}
                                  className={cn(
                                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                                    isActive 
                                      ? "bg-[#FFD166] border-[#FFD166] text-[#2D2D2D] shadow-sm" 
                                      : "bg-white border-[#EEE] text-[#666] hover:border-[#FFD166] hover:text-[#2D2D2D]"
                                  )}
                                >
                                  {symptom}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <textarea
                          value={symptoms}
                          onChange={(e) => setSymptoms(e.target.value)}
                          className="w-full h-32 px-4 py-3 bg-[#F9F9F9] border border-[#EEE] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FFD166] transition-all resize-none mb-4"
                          placeholder="e.g. My dog has been coughing and seems lethargic today..."
                        />
                        
                        <button
                          onClick={handleGetAdvice}
                          disabled={loading || !symptoms}
                          className="px-8 py-4 bg-[#2D2D2D] text-white rounded-2xl font-bold hover:bg-[#444] transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                          {loading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>Get AI Advice</>
                          )}
                        </button>
                      </div>

                      {loading && activeTab === 'health' && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white p-12 rounded-3xl border border-[#EEE] shadow-sm flex flex-col items-center justify-center text-center gap-6"
                        >
                          <div className="relative">
                            <motion.div 
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ repeat: Infinity, duration: 2 }}
                              className="w-20 h-20 bg-[#FFF9E6] rounded-full flex items-center justify-center"
                            >
                              <Stethoscope size={40} className="text-[#FFD166]" />
                            </motion.div>
                            <motion.div 
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                              className="absolute -inset-2 border-2 border-dashed border-[#FFD166] rounded-full"
                            />
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-bold text-xl">AI is Thinking</h4>
                            <p className="text-[#666] font-medium animate-pulse">{loadingMessage}</p>
                          </div>
                          <div className="w-48 h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ x: "-100%" }}
                              animate={{ x: "100%" }}
                              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                              className="w-full h-full bg-[#FFD166]"
                            />
                          </div>
                        </motion.div>
                      )}

                      {advice && !loading && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white p-8 rounded-3xl border border-[#EEE] shadow-sm prose prose-slate max-w-none"
                        >
                          <div className="flex items-center gap-2 text-[#FF4D4D] mb-4 font-bold uppercase text-xs tracking-widest">
                            <AlertTriangle size={16} /> AI Health Report
                          </div>
                          <div className="markdown-body">
                            <Markdown>{advice}</Markdown>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ) : activeTab === 'vaccines' ? (
                    <motion.div
                      key="vaccines"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-6"
                    >
                      <div className="bg-white p-8 rounded-3xl border border-[#EEE] shadow-sm">
                        <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                          <Syringe className="text-[#FFD166]" /> Vaccination Schedule
                        </h3>
                        <p className="text-[#666] mb-6">Standard recommended vaccines for a {pet.age} old {pet.species}.</p>
                        
                        {loading ? (
                          <div className="py-12 flex flex-col items-center justify-center gap-6 text-center">
                            <div className="relative">
                              <motion.div 
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="w-16 h-16 bg-[#F0F7FF] rounded-full flex items-center justify-center"
                              >
                                <Syringe size={32} className="text-[#007AFF]" />
                              </motion.div>
                              <motion.div 
                                animate={{ rotate: -360 }}
                                transition={{ repeat: Infinity, duration: 5, ease: "linear" }}
                                className="absolute -inset-2 border-2 border-dashed border-[#007AFF]/30 rounded-full"
                              />
                            </div>
                            <div className="space-y-2">
                              <p className="text-[#666] font-medium animate-pulse">{loadingMessage}</p>
                              <div className="w-32 h-1 bg-[#F5F5F5] rounded-full overflow-hidden mx-auto">
                                <motion.div 
                                  initial={{ x: "-100%" }}
                                  animate={{ x: "100%" }}
                                  transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                                  className="w-full h-full bg-[#007AFF]"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="markdown-body prose prose-slate max-w-none">
                            <Markdown>{vaccines || ""}</Markdown>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : activeTab === 'dosage' ? (
                    <motion.div
                      key="dosage"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-6"
                    >
                      <div className="bg-white p-8 rounded-3xl border border-[#EEE] shadow-sm">
                        <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                          <Pill className="text-[#FFD166]" /> Dosage Checker
                        </h3>
                        <p className="text-[#666] mb-6">Enter a medication and the dosage you're considering for {pet.name}.</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#999] mb-1.5">Medication Name</label>
                            <input
                              type="text"
                              value={medication}
                              onChange={(e) => setMedication(e.target.value)}
                              className="w-full px-4 py-3 bg-[#F9F9F9] border border-[#EEE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD166] transition-all"
                              placeholder="e.g. Benadryl"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#999] mb-1.5">Proposed Dosage</label>
                            <input
                              type="text"
                              value={dosage}
                              onChange={(e) => setDosage(e.target.value)}
                              className="w-full px-4 py-3 bg-[#F9F9F9] border border-[#EEE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD166] transition-all"
                              placeholder="e.g. 25mg"
                            />
                          </div>
                        </div>
                        
                        <button
                          onClick={handleGetDosageAdvice}
                          disabled={loading || !medication || !dosage}
                          className="px-8 py-4 bg-[#2D2D2D] text-white rounded-2xl font-bold hover:bg-[#444] transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                          {loading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Checking...
                            </>
                          ) : (
                            <>Check Dosage</>
                          )}
                        </button>
                      </div>

                      {loading && activeTab === 'dosage' && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white p-12 rounded-3xl border border-[#EEE] shadow-sm flex flex-col items-center justify-center text-center gap-6"
                        >
                          <div className="relative">
                            <motion.div 
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ repeat: Infinity, duration: 2 }}
                              className="w-20 h-20 bg-[#FFF9E6] rounded-full flex items-center justify-center"
                            >
                              <Pill size={40} className="text-[#FFD166]" />
                            </motion.div>
                            <motion.div 
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                              className="absolute -inset-2 border-2 border-dashed border-[#FFD166] rounded-full"
                            />
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-bold text-xl">AI is Calculating</h4>
                            <p className="text-[#666] font-medium animate-pulse">{loadingMessage}</p>
                          </div>
                        </motion.div>
                      )}

                      {dosageAdvice && !loading && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white p-8 rounded-3xl border border-[#EEE] shadow-sm prose prose-slate max-w-none"
                        >
                          <div className="flex items-center gap-2 text-[#007AFF] mb-4 font-bold uppercase text-xs tracking-widest">
                            <Pill size={16} /> Dosage Analysis
                          </div>
                          <div className="markdown-body">
                            <Markdown>{dosageAdvice}</Markdown>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="history"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-bold flex items-center gap-2">
                          <HistoryIcon className="text-[#FFD166]" /> Care History
                        </h3>
                        {filteredHistory.length > 0 && (
                          <button 
                            onClick={clearHistory}
                            className="text-xs font-bold text-[#FF4D4D] hover:underline uppercase tracking-widest"
                          >
                            Clear All
                          </button>
                        )}
                      </div>

                      {filteredHistory.length === 0 ? (
                        <div className="bg-white p-12 rounded-3xl border border-dashed border-[#DDD] flex flex-col items-center justify-center text-center">
                          <div className="w-16 h-16 bg-[#F5F5F5] rounded-full flex items-center justify-center mb-4">
                            <Clock className="text-[#CCC]" size={32} />
                          </div>
                          <h4 className="font-bold text-lg mb-1">No history yet</h4>
                          <p className="text-[#999] max-w-xs">Your health reports and vaccine schedules will appear here.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {filteredHistory.map((item) => (
                            <motion.div
                              layout
                              key={item.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-white rounded-3xl border border-[#EEE] shadow-sm overflow-hidden"
                            >
                              <div className="p-6 border-b border-[#F5F5F5] flex items-center justify-between bg-[#FAFAFA]">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center",
                                    item.type === 'health' ? "bg-[#FFF0F0] text-[#FF4D4D]" : 
                                    item.type === 'vaccine' ? "bg-[#F0F7FF] text-[#007AFF]" :
                                    "bg-[#F5F0FF] text-[#8E5AFF]"
                                  )}>
                                    {item.type === 'health' ? <Stethoscope size={20} /> : 
                                     item.type === 'vaccine' ? <Syringe size={20} /> :
                                     <Pill size={20} />}
                                  </div>
                                  <div>
                                    <h4 className="font-bold capitalize">{item.type} Report</h4>
                                    <p className="text-xs text-[#999] flex items-center gap-1">
                                      <Calendar size={12} /> {new Date(item.date).toLocaleDateString()} at {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => deleteHistoryItem(item.id)}
                                  className="p-2 text-[#CCC] hover:text-[#FF4D4D] transition-colors"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                              <div className="p-6">
                                {item.query && (
                                  <div className="mb-4 p-4 bg-[#F5F5F5] rounded-2xl italic text-sm text-[#666]">
                                    {item.type === 'dosage' ? `Checking: ${item.query}` : `"${item.query}"`}
                                  </div>
                                )}
                                <div className="markdown-body prose prose-sm max-w-none line-clamp-6 overflow-hidden relative">
                                  <Markdown>{item.content}</Markdown>
                                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent" />
                                </div>
                                <button 
                                  onClick={() => {
                                    if (item.type === 'health') {
                                      setAdvice(item.content);
                                      setSymptoms(item.query || '');
                                      setActiveTab('health');
                                    } else if (item.type === 'vaccine') {
                                      setVaccines(item.content);
                                      setActiveTab('vaccines');
                                    } else {
                                      setDosageAdvice(item.content);
                                      const [med, dos] = (item.query || '').split(' (');
                                      setMedication(med);
                                      setDosage(dos.replace(')', ''));
                                      setActiveTab('dosage');
                                    }
                                  }}
                                  className="mt-4 text-sm font-bold text-[#2D2D2D] hover:underline flex items-center gap-1"
                                >
                                  View Full Report <ChevronRight size={14} />
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === 'forum' && (
                    <motion.div
                      key="forum"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <div className="mb-8">
                        <h2 className="text-3xl font-black text-[#2D2D2D] mb-2">Community Forum</h2>
                        <p className="text-[#999]">Share advice, experiences, and support with other pet owners.</p>
                      </div>
                      <Forum user={user} />
                    </motion.div>
                  )}

                  {activeTab === 'vets' && (
                    <motion.div
                      key="vets"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <NearbyVets />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Sidebar Info */}
              <div className="space-y-6">
                <div className="bg-[#FFF9E6] p-6 rounded-3xl border border-[#FFE8A3]">
                  <h4 className="font-bold mb-3 flex items-center gap-2">
                    <Info size={18} className="text-[#B28900]" /> Medical Disclaimer
                  </h4>
                  <p className="text-sm text-[#7A5E00] leading-relaxed">
                    This AI assistant provides information based on general veterinary knowledge. It is NOT a replacement for professional veterinary diagnosis or treatment. Always consult a vet for serious health issues.
                  </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#EEE] shadow-sm">
                  <h4 className="font-bold mb-4 flex items-center gap-2">
                    <UserIcon size={18} className="text-[#666]" /> Community Account
                  </h4>
                  {user ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-3 bg-[#FAFAFA] rounded-2xl border border-[#EEE]">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt={user.displayName || ''} className="w-10 h-10 rounded-full border border-[#EEE]" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center text-[#999]">
                            <UserIcon size={20} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{user.displayName}</p>
                          <p className="text-[10px] text-[#999] truncate">{user.email}</p>
                        </div>
                      </div>
                      <button 
                        onClick={handleSignOut}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[#FF4D4D] font-bold text-sm hover:bg-[#FFF0F0] transition-all border border-[#FF4D4D]/10"
                      >
                        <LogOut size={16} /> Sign Out
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-[#999] leading-relaxed">
                        Sign in to share your pet's journey, ask questions, and support other pet owners in our community forum.
                      </p>
                      <button 
                        onClick={handleSignIn}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#2D2D2D] text-white font-bold text-sm hover:bg-black transition-all shadow-lg shadow-[#2D2D2D]/10"
                      >
                        <UserIcon size={16} /> Sign in with Google
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#EEE] shadow-sm">
                  <h4 className="font-bold mb-4 flex items-center gap-2">
                    <HistoryIcon size={18} className="text-[#666]" /> Common Core Vaccines
                  </h4>
                  <ul className="space-y-3">
                    {pet.species === 'dog' ? (
                      <>
                        <li className="flex items-start gap-3 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#FFD166] mt-1.5 shrink-0" />
                          <span>Rabies (Required by law)</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#FFD166] mt-1.5 shrink-0" />
                          <span>Distemper, Adenovirus, Parvovirus (DHPP)</span>
                        </li>
                      </>
                    ) : (
                      <>
                        <li className="flex items-start gap-3 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#FFD166] mt-1.5 shrink-0" />
                          <span>Rabies (Required by law)</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#FFD166] mt-1.5 shrink-0" />
                          <span>Feline Viral Rhinotracheitis, Calicivirus, Panleukopenia (FVRCP)</span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>

                <div className="bg-[#2D2D2D] p-6 rounded-3xl text-white">
                  <h4 className="font-bold mb-2 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-[#FFD166]" /> Emergency Signs
                  </h4>
                  <p className="text-xs text-white/60 mb-4 uppercase tracking-widest font-bold">See a vet immediately if:</p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Plus size={14} className="text-[#FFD166]" /> Difficulty breathing
                    </li>
                    <li className="flex items-center gap-2">
                      <Plus size={14} className="text-[#FFD166]" /> Seizures or collapse
                    </li>
                    <li className="flex items-center gap-2">
                      <Plus size={14} className="text-[#FFD166]" /> Severe bleeding
                    </li>
                    <li className="flex items-center gap-2">
                      <Plus size={14} className="text-[#FFD166]" /> Inability to urinate
                    </li>
                  </ul>
                </div>

                {(pet.vetName || pet.vetPhone) && (
                  <div className="bg-white p-6 rounded-3xl border-2 border-[#FFD166] shadow-lg shadow-[#FFD166]/10">
                    <h4 className="font-bold mb-3 flex items-center gap-2">
                      <Heart size={18} className="text-[#FF4D4D]" fill="#FF4D4D" /> Your Veterinarian
                    </h4>
                    <div className="space-y-2">
                      {pet.vetName && (
                        <p className="text-sm font-bold text-[#2D2D2D]">{pet.vetName}</p>
                      )}
                      {pet.vetPhone && (
                        <a 
                          href={`tel:${pet.vetPhone}`}
                          className="flex items-center gap-2 text-[#007AFF] font-bold hover:underline"
                        >
                          <div className="w-8 h-8 bg-[#F0F7FF] rounded-lg flex items-center justify-center">
                            <Plus size={16} />
                          </div>
                          {pet.vetPhone}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-[#EEE] text-center">
        <p className="text-[#999] text-sm">© 2026 PetCare AI Assistant. Helping you keep your best friends healthy.</p>
      </footer>
      <SpeedInsights />
    </div>
  );
}
