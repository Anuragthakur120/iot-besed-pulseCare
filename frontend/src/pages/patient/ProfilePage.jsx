import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Key,
  Camera,
  Trash2,
  Smartphone,
  LogOut,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import api from '@/services/api';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { PasswordInput } from '@/components/PasswordInput';
import { Avatar } from '@/components/Avatar';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();

  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Revoke state
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    // Fetch photo url if user has a profileImage
    if (user?.patientId) {
      api
        .get(`/api/patients/${user.patientId}/photo`)
        .then((res) => {
          if (res.data?.data?.url) setPhotoUrl(res.data.data.url);
        })
        .catch(() => {});
    }
  }, [user]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      addToast({ title: 'Invalid File', message: 'Only JPEG, PNG, and WebP images are allowed', type: 'danger' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      addToast({ title: 'File Too Large', message: 'Maximum file size is 2 MB', type: 'danger' });
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);

    setUploadingPhoto(true);
    try {
      await api.post(`/api/patients/${user.patientId}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      addToast({ title: 'Photo Uploaded', message: 'Profile photo updated successfully', type: 'success' });
      if (refreshUser) refreshUser();

      // Refresh photo signed URL
      const photoRes = await api.get(`/api/patients/${user.patientId}/photo`);
      if (photoRes.data?.data?.url) setPhotoUrl(photoRes.data.data.url);
    } catch (err) {
      addToast({
        title: 'Upload Failed',
        message: err.response?.data?.error || err.message,
        type: 'danger'
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    try {
      await api.delete(`/api/patients/${user.patientId}/photo`);
      setPhotoUrl(null);
      addToast({ title: 'Photo Removed', message: 'Profile photo removed', type: 'info' });
      if (refreshUser) refreshUser();
    } catch (err) {
      addToast({ title: 'Failed to Remove Photo', message: err.response?.data?.error || err.message, type: 'danger' });
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      addToast({ title: 'Mismatch', message: 'New password and confirmation do not match', type: 'warning' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await api.post('/api/auth/change-password', {
        currentPassword,
        newPassword
      });

      addToast({ title: 'Password Changed', message: 'Your password has been successfully updated', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      addToast({
        title: 'Password Update Failed',
        message: err.response?.data?.error || err.message,
        type: 'danger'
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    setRevoking(true);
    try {
      await api.post('/api/auth/logout-all');
      addToast({
        title: 'Sessions Terminated',
        message: 'All other active device sessions have been revoked',
        type: 'info'
      });
    } catch (err) {
      addToast({ title: 'Revoke Failed', message: err.response?.data?.error || err.message, type: 'danger' });
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F3A] dark:text-white">
          Account Profile & Security
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your personal identity, biometric avatar, security credentials, and active logins
        </p>
      </div>

      {/* Profile Photo & Identity */}
      <Card className="p-6">
        <h2 className="text-sm font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-teal-500" />
          Personal Demographics
        </h2>

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with upload trigger */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="relative group">
              <Avatar
                src={photoUrl}
                name={user?.name}
                size="lg"
                className="w-24 h-24 text-2xl font-bold ring-4 ring-teal-500/20"
              />
              <label
                className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                title="Change Photo"
              >
                <Camera className="w-6 h-6" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-teal-600 dark:text-teal-400 font-semibold cursor-pointer hover:underline">
                Upload New
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                />
              </label>
              {photoUrl && (
                <>
                  <span className="text-slate-300">•</span>
                  <button
                    onClick={handleDeletePhoto}
                    className="text-xs text-rose-500 hover:underline font-semibold"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
            <span className="text-[10px] text-slate-400">Max 2MB (JPG, PNG, WebP)</span>
          </div>

          {/* User Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full text-xs">
            <div className="p-3.5 rounded-xl bg-[#F6F8FB] dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-mono">Full Legal Name</span>
              <p className="font-semibold text-slate-900 dark:text-white text-sm">{user?.name}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F6F8FB] dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-mono">Hospital Patient ID</span>
              <p className="font-mono font-bold text-teal-600 dark:text-teal-400 text-sm">
                {user?.patientId || 'Staff Account'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F6F8FB] dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-mono">Email Address</span>
              <p className="font-semibold text-slate-900 dark:text-white">{user?.email}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F6F8FB] dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 space-y-1">
              <span className="text-slate-400 text-[10px] uppercase font-mono">Phone</span>
              <p className="font-semibold text-slate-900 dark:text-white">{user?.phone || '--'}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Password Update Card */}
      <Card className="p-6">
        <h2 className="text-sm font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-teal-500" />
          Update Security Password
        </h2>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
          <PasswordInput
            label="Current Password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />

          <PasswordInput
            label="New Password"
            required
            showStrength
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <PasswordInput
            label="Confirm New Password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <div className="pt-2">
            <Button variant="primary" type="submit" isLoading={isChangingPassword}>
              Update Password
            </Button>
          </div>
        </form>
      </Card>

      {/* Active Device Sessions */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-[#0B1F3A] dark:text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-teal-500" />
              Active Login Sessions
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage refresh tokens and authorized browser sessions across all devices
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRevokeAllSessions}
            isLoading={revoking}
            className="text-rose-600 dark:text-rose-400 hover:border-rose-500"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            Revoke All Other Devices
          </Button>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-[#E5EAF1] dark:border-slate-800 text-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white">Current Web Session</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                This Device
              </span>
            </div>
            <p className="text-slate-400 font-mono text-[11px]">
              Last token rotation: Just now • Session encrypted with HTTP-only cookie
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
