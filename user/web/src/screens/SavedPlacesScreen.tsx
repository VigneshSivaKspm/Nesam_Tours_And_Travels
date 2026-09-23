import React, { useState, useEffect } from 'react';
import { LocationItem } from '../types';
import { subscribeToSavedPlaces, savePlaceInFirestore, deleteSavedPlaceInFirestore } from '../services/userFirestoreService';

export const SavedPlacesScreen: React.FC<{ ownerId: string; onBack: () => void }> = ({ ownerId, onBack }) => {
  const [places, setPlaces] = useState<LocationItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newType, setNewType] = useState<'home' | 'work' | 'favorite' | 'other'>('favorite');

  useEffect(() => {
    const unsub = subscribeToSavedPlaces(ownerId, setPlaces);
    return () => unsub();
  }, [ownerId]);

  const handleAddPlace = () => {
    if (!newName || !newAddress) return;
    const item: LocationItem = {
      id: 'place-' + Date.now(),
      name: newName,
      address: newAddress,
      type: newType as any,
    };
    setPlaces([...places, item]);
    savePlaceInFirestore(item, ownerId);
    setNewName('');
    setNewAddress('');
    setShowAddModal(false);
  };

  const handleDelete = (id: string) => {
    setPlaces(places.filter((p) => p.id !== id));
    deleteSavedPlaceInFirestore(id);
  };

  return (
    <div className="flex-1 bg-[#F7F7F7] overflow-y-auto p-4 space-y-4 max-w-3xl w-full mx-auto">
      {/* Header */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-[#E21B23] mb-4">
        ← Back
      </button>
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-sm font-black text-[#111111] uppercase tracking-wider">SAVED LOCATIONS</h2>
          <p className="text-[10px] text-gray-500">Quick one-tap location selection</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#E31E24] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow hover:bg-[#C41820]"
        >
          + Add New Location
        </button>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="bg-white p-4 rounded-2xl border border-gray-300 shadow-xl space-y-3">
          <h3 className="text-xs font-black text-[#111111]">ADD NEW SAVED PLACE</h3>

          <div>
            <label className="text-[10px] font-bold text-gray-400 block mb-1">Place Name</label>
            <input
              type="text"
              placeholder="e.g. Grandma's House"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 block mb-1">Address</label>
            <input
              type="text"
              placeholder="e.g. 45 Main Road, Erode"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              className="w-full bg-gray-100 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 block mb-1">Category</label>
            <div className="flex gap-2">
              {(['home', 'work', 'favorite', 'other'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setNewType(t)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg capitalize border ${
                    newType === t ? 'bg-[#E31E24] text-white border-[#E31E24]' : 'bg-gray-100 text-gray-600 border-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowAddModal(false)}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-xl text-xs font-bold"
            >
              Cancel
            </button>
            <button
              onClick={handleAddPlace}
              className="flex-1 bg-[#E31E24] text-white py-2 rounded-xl text-xs font-bold"
            >
              Save Location
            </button>
          </div>
        </div>
      )}

      {/* Places List */}
      <div className="space-y-2">
        {places.map((place) => (
          <div
            key={place.id}
            className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-50 text-[#E31E24] flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-black text-[#111111]">{place.name}</div>
                <div className="text-[10px] text-gray-500 max-w-[200px] truncate">{place.address}</div>
              </div>
            </div>

            <button
              onClick={() => handleDelete(place.id)}
              className="text-[10px] font-bold text-gray-400 hover:text-red-600 p-1 uppercase"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
