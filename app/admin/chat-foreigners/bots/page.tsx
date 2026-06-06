'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Copy, Code, MapPin, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface Bot {
  _id: string;
  name: string;
  username: string;
  avatar?: string;
  bio?: string;
  personalityType?: string;
  speakingStyle?: string;
  mood?: string;
  interests?: string;
  nationality?: string;
  unlockPrice: number;
  isActive: boolean;
  createdAt: string;
}

interface BotFormData {
  name: string;
  username: string;
  avatar: string;
  bio: string;
  personalityType: string;
  speakingStyle: string;
  mood: string;
  interests: string;
  nationality: string;
  unlockPrice: number;
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

export default function BotsAdminPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBot, setEditingBot] = useState<Bot | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [formData, setFormData] = useState<BotFormData>({
    name: '',
    username: '',
    avatar: '',
    bio: '',
    personalityType: '',
    speakingStyle: '',
    mood: '',
    interests: '',
    nationality: '',
    unlockPrice: 100,
  });

  useEffect(() => {
    loadBots();
  }, []);

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  };

  const loadBots = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/chat-foreigners/bots');
      const data = await res.json();
      if (data.success) {
        setBots(
          (data.data || []).map((b: any) => ({
            ...b,
            _id: b._id || b.id,
            avatar: b.avatar || b.avatar_url,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to load persons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingBot
        ? `/api/chat-foreigners/bots/${editingBot._id}`
        : '/api/chat-foreigners/bots';

      const method = editingBot ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        loadBots();
        resetForm();
        setShowForm(false);
        addToast('success', editingBot ? 'Person updated successfully' : 'Person created successfully');
      } else {
        addToast('error', data.error || 'Failed to save person');
      }
    } catch (error) {
      console.error('Failed to save bot:', error);
      addToast('error', 'Failed to save person');
    }
  };

  const handleClone = async (bot: Bot) => {
    if (cloningId) return;
    setCloningId(bot._id);
    try {
      const res = await fetch(`/api/chat-foreigners/bots/${bot._id}/clone`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        addToast(
          'success',
          `Replicated as "${data.data.name}" (@${data.data.username})${data.data.nationality ? ` — ${data.data.nationality}` : ''}`
        );
        loadBots();
      } else {
        addToast('error', data.error || 'Failed to replicate person');
      }
    } catch (error) {
      console.error('Failed to clone person:', error);
      addToast('error', 'Failed to replicate person');
    } finally {
      setCloningId(null);
    }
  };

  const handleTrainingData = async (botId: string) => {
    try {
      const res = await fetch(`/api/chat-foreigners/bots/${botId}/training`);
      const data = await res.json();
      if (data.success) {
        const json = JSON.stringify(data.data.trainingData, null, 2);
        const newData = prompt('Edit person training data (JSON):', json);
        if (newData) {
          try {
            const parsed = JSON.parse(newData);
            const updateRes = await fetch(`/api/chat-foreigners/bots/${botId}/training`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ trainingData: parsed }),
            });
            const updateData = await updateRes.json();
            if (updateData.success) {
              addToast('success', 'Training data updated successfully');
            }
          } catch {
            addToast('error', 'Invalid JSON format');
          }
        }
      }
    } catch (error) {
      console.error('Failed to load training data:', error);
      addToast('error', 'Failed to load training data');
    }
  };

  const handleDelete = async (botId: string) => {
    if (!confirm('Are you sure you want to delete this person?')) return;

    try {
      const res = await fetch(`/api/chat-foreigners/bots/${botId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        loadBots();
        addToast('success', 'Person deleted');
      } else {
        addToast('error', data.error || 'Failed to delete person');
      }
    } catch (error) {
      console.error('Failed to delete bot:', error);
      addToast('error', 'Failed to delete person');
    }
  };

  const handleEdit = (bot: Bot) => {
    setEditingBot(bot);
    setFormData({
      name: bot.name,
      username: bot.username,
      avatar: bot.avatar || '',
      bio: bot.bio || '',
      personalityType: bot.personalityType || '',
      speakingStyle: bot.speakingStyle || '',
      mood: bot.mood || '',
      interests: bot.interests || '',
      nationality: bot.nationality || '',
      unlockPrice: bot.unlockPrice,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingBot(null);
    setFormData({
      name: '',
      username: '',
      avatar: '',
      bio: '',
      personalityType: '',
      speakingStyle: '',
      mood: '',
      interests: '',
      nationality: '',
      unlockPrice: 100,
    });
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-3 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading persons...</span>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-lg shadow-lg text-sm font-medium border ${
              toast.type === 'success'
                ? 'bg-green-50 text-green-800 border-green-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 text-green-500 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Persons</h1>
          <p className="text-gray-600 mt-1">Create and manage foreign personality profiles</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Person
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-2xl font-bold">{editingBot ? 'Edit Person' : 'Create New Person'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingBot}
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Avatar URL</label>
                  <input
                    type="url"
                    value={formData.avatar}
                    onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                  <input
                    type="text"
                    placeholder="e.g. African American, White American"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unlock Price (KSh) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.unlockPrice}
                    onChange={(e) => setFormData({ ...formData, unlockPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Personality Type</label>
                  <input
                    type="text"
                    placeholder="e.g. Friendly, Professional, Witty"
                    value={formData.personalityType}
                    onChange={(e) => setFormData({ ...formData, personalityType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Speaking Style</label>
                  <input
                    type="text"
                    placeholder="e.g. Casual, Formal, Playful"
                    value={formData.speakingStyle}
                    onChange={(e) => setFormData({ ...formData, speakingStyle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mood</label>
                  <input
                    type="text"
                    placeholder="e.g. Energetic, Calm, Mysterious"
                    value={formData.mood}
                    onChange={(e) => setFormData({ ...formData, mood: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interests</label>
                  <input
                    type="text"
                    placeholder="e.g. Travel, Music, Technology"
                    value={formData.interests}
                    onChange={(e) => setFormData({ ...formData, interests: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
                >
                  {editingBot ? 'Update Person' : 'Create Person'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {bots.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No persons created yet. Click &quot;Add Person&quot; to create one.</p>
          </div>
        ) : (
          bots.map((bot) => (
            <div
              key={bot._id}
              className="bg-white rounded-lg shadow border border-gray-200 p-6 flex justify-between items-start hover:shadow-md transition-shadow"
            >
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  {bot.avatar ? (
                    <img
                      src={bot.avatar}
                      alt={bot.name}
                      className="w-16 h-16 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-2xl font-bold border border-gray-200">
                      {bot.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{bot.name}</h3>
                    <p className="text-gray-500 text-sm">@{bot.username}</p>
                    {bot.nationality && (
                      <span className="inline-flex items-center gap-1 mt-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                        <MapPin className="w-3 h-3" />
                        {bot.nationality}
                      </span>
                    )}
                  </div>
                </div>
                {bot.bio && <p className="text-gray-700 text-sm mb-2 line-clamp-2">{bot.bio}</p>}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                  {bot.personalityType && (
                    <div>
                      <span className="font-medium text-gray-700">Personality:</span>
                      <p className="text-gray-600">{bot.personalityType}</p>
                    </div>
                  )}
                  {bot.speakingStyle && (
                    <div>
                      <span className="font-medium text-gray-700">Style:</span>
                      <p className="text-gray-600">{bot.speakingStyle}</p>
                    </div>
                  )}
                  {bot.mood && (
                    <div>
                      <span className="font-medium text-gray-700">Mood:</span>
                      <p className="text-gray-600">{bot.mood}</p>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-gray-700">Unlock Price:</span>
                    <p className="text-gray-600">KSh {bot.unlockPrice}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 ml-4 flex-wrap justify-end">
                <button
                  onClick={() => handleEdit(bot)}
                  className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                  title="Edit person"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleClone(bot)}
                  disabled={cloningId === bot._id}
                  className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 disabled:opacity-50 disabled:cursor-wait"
                  title="Replicate as unique new person"
                >
                  {cloningId === bot._id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => handleTrainingData(bot._id)}
                  className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200"
                  title="Edit training data (JSON)"
                >
                  <Code className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(bot._id)}
                  className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                  title="Delete person"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
