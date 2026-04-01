import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Phone, 
  ExternalLink, 
  Navigation, 
  Search,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { findNearbyVets, VetLocation } from '../services/mapsService';
import { cn } from '../lib/utils';

export default function NearbyVets() {
  const [vets, setVets] = useState<VetLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const getVets = async () => {
    setLoading(true);
    setError(null);
    setPermissionDenied(false);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const results = await findNearbyVets(latitude, longitude);
          setVets(results);
          if (results.length === 0) {
            setError("No veterinary clinics found nearby.");
          }
        } catch (err) {
          setError("Failed to fetch nearby clinics. Please try again.");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionDenied(true);
          setError("Location access denied. Please enable location permissions to find nearby vets.");
        } else {
          setError("Unable to retrieve your location.");
        }
        setLoading(false);
      }
    );
  };

  useEffect(() => {
    getVets();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-3xl border border-[#EEE] shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="text-[#FF4D4D]" /> Nearby Veterinarians
            </h3>
            <p className="text-[#666] text-sm mt-1">Find the closest clinics and emergency care for your pet.</p>
          </div>
          <button 
            onClick={getVets}
            disabled={loading}
            className="p-3 bg-[#F5F5F5] hover:bg-[#EEE] rounded-2xl transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12 flex flex-col items-center justify-center gap-4 text-center"
            >
              <div className="w-12 h-12 bg-[#FFF0F0] rounded-full flex items-center justify-center">
                <Loader2 className="animate-spin text-[#FF4D4D]" size={24} />
              </div>
              <p className="text-[#666] font-medium">Searching for clinics near you...</p>
            </motion.div>
          ) : error ? (
            <motion.div 
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12 flex flex-col items-center justify-center gap-4 text-center"
            >
              <div className="w-12 h-12 bg-[#FFF0F0] rounded-full flex items-center justify-center">
                <AlertCircle className="text-[#FF4D4D]" size={24} />
              </div>
              <div className="max-w-xs mx-auto">
                <p className="text-[#666] font-medium">{error}</p>
                {permissionDenied && (
                  <p className="text-xs text-[#999] mt-2">
                    Check your browser's site settings to allow location access for this app.
                  </p>
                )}
              </div>
              <button 
                onClick={getVets}
                className="mt-2 px-6 py-2.5 bg-[#2D2D2D] text-white rounded-xl text-sm font-bold hover:bg-black transition-all"
              >
                Try Again
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {vets.map((vet, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-5 bg-[#FAFAFA] border border-[#EEE] rounded-2xl hover:border-[#FF4D4D]/30 transition-all group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-[#2D2D2D] group-hover:text-[#FF4D4D] transition-colors">{vet.name}</h4>
                    <div className="flex items-center gap-1 text-[#FFD166]">
                      <Navigation size={14} />
                    </div>
                  </div>
                  
                  {vet.address && (
                    <p className="text-xs text-[#666] mb-4 flex items-start gap-2">
                      <MapPin size={14} className="shrink-0 mt-0.5" />
                      {vet.address}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-auto">
                    <a 
                      href={vet.mapsUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white border border-[#EEE] rounded-xl text-xs font-bold text-[#2D2D2D] hover:bg-[#F5F5F5] transition-all"
                    >
                      <ExternalLink size={14} /> Open Maps
                    </a>
                    {vet.phone && (
                      <a 
                        href={`tel:${vet.phone}`}
                        className="p-2 bg-[#FF4D4D] text-white rounded-xl hover:bg-[#E63939] transition-all"
                      >
                        <Phone size={18} />
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-[#F0F7FF] p-6 rounded-3xl border border-[#D0E7FF]">
        <h4 className="font-bold mb-3 flex items-center gap-2">
          <AlertCircle size={18} className="text-[#007AFF]" /> Emergency Tips
        </h4>
        <ul className="space-y-2 text-sm text-[#0056B3] leading-relaxed">
          <li className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#007AFF] mt-1.5 shrink-0" />
            Keep your vet's number saved in your phone.
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#007AFF] mt-1.5 shrink-0" />
            Know the location of the nearest 24/7 emergency clinic.
          </li>
          <li className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#007AFF] mt-1.5 shrink-0" />
            Have a pet first-aid kit ready at home.
          </li>
        </ul>
      </div>
    </div>
  );
}
